"use client";

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 }
  }
};

const bar = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

const LINE_WIDTHS = ["100%", "95%", "88%", "92%", "60%"] as const;

export function AnswerSkeleton() {
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
        {LINE_WIDTHS.map((w) => (
          <motion.div key={w} variants={bar} className="h-3 rounded shimmer" style={{ width: w }} />
        ))}
      </div>
      <div className="space-y-2 pt-3">
        <motion.div variants={bar} className="h-3 w-[80%] rounded shimmer" />
        <motion.div variants={bar} className="h-3 w-[70%] rounded shimmer" />
      </div>
      <div className="grid gap-2 pt-4 sm:grid-cols-2">
        <motion.div variants={bar} className="h-16 rounded-xl shimmer" />
        <motion.div variants={bar} className="h-16 rounded-xl shimmer" />
      </div>
    </motion.div>
  );
}
