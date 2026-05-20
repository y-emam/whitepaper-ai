-- Switch embedding dimension from 768 (Gemini) to 1024 (Voyage voyage-3-large).
-- Voyage and Gemini live in incompatible vector spaces, so we drop existing
-- rows and re-ingest from scratch.

truncate table chunks restart identity cascade;
truncate table papers restart identity cascade;

drop index if exists chunks_embedding_idx;
alter table chunks drop column if exists embedding;
alter table chunks add column embedding vector(1024);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

drop function if exists hybrid_search(vector(768), text, int, float, float, uuid);

create or replace function hybrid_search(
  query_embedding vector(1024),
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
