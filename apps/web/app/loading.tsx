"use client";

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } }
};

const bar = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

export default function Loading() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mt-8 space-y-4"
      aria-busy="true"
      aria-live="polite"
    >
      <motion.div variants={bar} className="h-2 w-1/3 rounded shimmer" />
      <div className="space-y-2">
        <motion.div variants={bar} className="h-3 w-full rounded shimmer" />
        <motion.div variants={bar} className="h-3 w-[92%] rounded shimmer" />
        <motion.div variants={bar} className="h-3 w-[85%] rounded shimmer" />
      </div>
      <div className="grid gap-2 pt-4 sm:grid-cols-2">
        <motion.div variants={bar} className="h-14 rounded-xl shimmer" />
        <motion.div variants={bar} className="h-14 rounded-xl shimmer" />
      </div>
    </motion.div>
  );
}
