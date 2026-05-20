"use client";

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } }
};

const card = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

export default function PapersLoading() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-8 space-y-2">
        <motion.div variants={card} className="h-7 w-32 rounded shimmer" />
        <motion.div variants={card} className="h-3 w-48 rounded shimmer" />
      </div>
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-2 sm:grid-cols-2"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.li key={i} variants={card} className="h-20 rounded-xl shimmer" />
        ))}
      </motion.ul>
    </motion.div>
  );
}
