import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const OFFSET = { up: { y: 20 }, down: { y: -20 }, left: { x: 20 }, right: { x: -20 } };

/** Texto que se revela al entrar en pantalla, por palabra (por defecto),
 *  por letra (letterAnime) o por línea (lineAnime). Respeta "reducir movimiento"
 *  a través del MotionConfig global. */
export default function TextAnimation({
  text, as = "h2", classname, className, variants, direction = "up",
  letterAnime = false, lineAnime = false, once = true, stagger,
}) {
  const Tag = motion[as] || motion.h2;
  const base = variants || {
    hidden: { filter: "blur(10px)", opacity: 0, ...OFFSET[direction] },
    visible: { filter: "blur(0px)", opacity: 1, x: 0, y: 0, transition: { ease: "easeOut", duration: 0.45 } },
  };
  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger ?? (letterAnime ? 0.025 : lineAnime ? 0.18 : 0.08) } },
  };
  const parts = lineAnime ? String(text).split("\n") : letterAnime ? Array.from(String(text)) : String(text).split(" ");
  return (
    <Tag
      className={cn(classname, className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.4 }}
      variants={container}
      aria-label={text}
    >
      {parts.map((p, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          variants={base}
          className={cn(lineAnime ? "block" : "inline-block", "will-change-transform")}
          style={letterAnime && p === " " ? { width: "0.28em" } : undefined}
        >
          {letterAnime ? p : lineAnime ? p : `${p} `}
        </motion.span>
      ))}
    </Tag>
  );
}
