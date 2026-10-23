import NumberFlow, { useCanAnimate } from "@number-flow/react";
import { ArrowUp } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const MotionNumberFlow = motion.create(NumberFlow);
const MotionArrowUp = motion.create(ArrowUp);
const USD = { style: "currency", currency: "USD", maximumFractionDigits: 2 };

/** Cifra que rueda al cambiar. format por defecto: dólares. */
export function AnimatedNumber({ value, format = USD, className, suffix, prefix }) {
  const v = Number.isFinite(value) ? value : 0;
  return <NumberFlow value={v} format={format} suffix={suffix} prefix={prefix} className={cn("tabular-nums", className)} locales="en-US" />;
}

/** Cifra con píldora de variación: verde y flecha arriba si sube, roja y girada si baja.
 *  diff es una fracción (0.05 = 5 %). */
export function PriceWithDiff({ value, diff, format = USD, className, size = "text-5xl" }) {
  const canAnimate = useCanAnimate();
  const d = Number.isFinite(diff) ? diff : 0;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <NumberFlow value={Number.isFinite(value) ? value : 0} className={cn(size, "font-semibold tabular-nums")} format={format} locales="en-US" />
      <motion.span
        className={cn(d >= 0 ? "bg-emerald-400" : "bg-red-500", "inline-flex items-center px-[0.3em] text-white transition-colors duration-300")}
        style={{ borderRadius: 999 }}
        layout={canAnimate}
        transition={{ layout: { duration: 0.9, bounce: 0, type: "spring" } }}
      >
        <MotionArrowUp
          className="mr-0.5 size-[0.75em]"
          absoluteStrokeWidth
          strokeWidth={3}
          transition={{ rotate: { type: "spring", duration: 0.5, bounce: 0 } }}
          animate={{ rotate: d >= 0 ? 0 : -180 }}
          initial={false}
        />
        <MotionNumberFlow
          value={d}
          className="font-semibold"
          format={{ style: "percent", maximumFractionDigits: 2 }}
          layout={canAnimate}
          layoutRoot={canAnimate}
          locales="en-US"
        />
      </motion.span>
    </span>
  );
}
