-- whitepaper-ai initial schema
-- Tables, indexes, hybrid_search RPC, RLS policies.

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists papers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  source_url text not null,
  pdf_path text,
  total_pages int,
  ingested_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);
create index if not exists papers_slug_idx on papers(slug);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  chunk_index int not null,
  heading_path text,
  content text not null,
  page_number int,
  embedding vector(768),
  fts tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  created_at timestamptz default now(),
  unique (paper_id, chunk_index)
);
create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_fts_idx on chunks using gin(fts);
create index if not exists chunks_paper_id_idx on chunks(paper_id);

create table if not exists queries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  cited_chunk_ids uuid[],
  sufficient_context boolean,
  latency_ms int,
  created_at timestamptz default now()
);

create or replace function hybrid_search(
  query_embedding vector(768),
  query_text text,
  match_count int default 8,
  vector_weight float default 0.6,
  fts_weight float default 0.4,
  paper_filter uuid default null
) returns table (
  id uuid,
  paper_id uuid,
  chunk_index int,
  heading_path text,
  content text,
  page_number int,
  vec_score float,
  fts_score float,
  combined_score float
) language sql stable as $$
  with vector_hits as (
    select c.id, 1 - (c.embedding <=> query_embedding) as vec_score
    from chunks c
    where c.embedding is not null
      and (paper_filter is null or c.paper_id = paper_filter)
    order by c.embedding <=> query_embedding
    limit 30
  ),
  fts_hits as (
    select c.id,
      ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as fts_score
    from chunks c
    where c.fts @@ websearch_to_tsquery('english', query_text)
      and (paper_filter is null or c.paper_id = paper_filter)
    order by fts_score desc
    limit 30
  ),
  combined as (
    select
      c.id, c.paper_id, c.chunk_index, c.heading_path, c.content, c.page_number,
      coalesce(v.vec_score, 0) as vec_score,
      coalesce(f.fts_score, 0) as fts_score,
      coalesce(v.vec_score, 0) * vector_weight + coalesce(f.fts_score, 0) * fts_weight as combined_score
    from chunks c
    left join vector_hits v on v.id = c.id
    left join fts_hits f on f.id = c.id
    where v.id is not null or f.id is not null
  )
  select * from combined order by combined_score desc limit match_count;
$$;

alter table papers enable row level security;
alter table chunks enable row level security;
alter table queries enable row level security;

drop policy if exists "public read papers" on papers;
drop policy if exists "public read chunks" on chunks;
drop policy if exists "service inserts queries" on queries;
drop policy if exists "no read queries" on queries;

create policy "public read papers" on papers for select using (true);
create policy "public read chunks" on chunks for select using (true);
create policy "service inserts queries" on queries for insert with check (true);
create policy "no read queries" on queries for select using (false);
