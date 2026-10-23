import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const Ctx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, tone = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
              className={"rounded-xl border px-4 py-2 text-sm font-semibold shadow-2xl backdrop-blur-xl " + (t.tone === "error" ? "border-red-400/30 bg-red-500/20 text-red-100" : "border-white/15 bg-bwo-ink/90 text-white")}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
