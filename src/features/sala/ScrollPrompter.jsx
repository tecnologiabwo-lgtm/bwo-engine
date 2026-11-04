import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, FlipHorizontal2, FlipVertical2, Camera, CameraOff, Circle, Square, Download, Minus, Plus, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/* Teleprompter continuo con cámara y grabación (estilo CuePrompter):
   el guion sube solo a la velocidad elegida, con espejo para cristal de
   teleprompter, guía de lectura y grabación directa desde el navegador.
   El video se queda en el dispositivo (se descarga); nada sube a internet. */

const MIME = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const pickMime = () => (typeof MediaRecorder === "undefined" ? null : MIME.find((m) => MediaRecorder.isTypeSupported(m)) || "");
const KEY = "bwo.prompter";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export function scriptOf(piece) {
  return (piece?.blocks || []).map((b) => ({ head: [b.k, b.t].filter(Boolean).join(" · "), text: b.x || "" })).filter((b) => b.text.trim());
}

export default function ScrollPrompter({ piece, onClose }) {
  const saved = load();
  const [speed, setSpeed] = useState(saved.speed ?? 40);       // px por segundo
  const [size, setSize] = useState(saved.size ?? 44);
  const [width, setWidth] = useState(saved.width ?? 70);       // % del ancho
  const [mirrorX, setMirrorX] = useState(!!saved.mirrorX);
  const [mirrorY, setMirrorY] = useState(!!saved.mirrorY);
  const [orient, setOrient] = useState(saved.orient || "vertical");
  const [playing, setPlaying] = useState(false);
  const [count, setCount] = useState(0);
  const [cam, setCam] = useState(null);                         // MediaStream
  const [camErr, setCamErr] = useState("");
  const [rec, setRec] = useState(null);                         // { recorder, t0 }
  const [takes, setTakes] = useState([]);
  const [now, setNow] = useState(Date.now());
  const box = useRef(null), video = useRef(null), raf = useRef(0), last = useRef(0), chunks = useRef([]);
  const blocks = scriptOf(piece);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ speed, size, width, mirrorX, mirrorY, orient })); } catch {} }, [speed, size, width, mirrorX, mirrorY, orient]);

  // Desplazamiento suave
  useEffect(() => {
    if (!playing) return;
    const step = (t) => {
      const el = box.current; if (!el) return;
      const dt = last.current ? (t - last.current) / 1000 : 0; last.current = t;
      el.scrollTop += speed * dt;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(step);
    };
    last.current = 0; raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed]);

  // Cuenta regresiva 3-2-1
  useEffect(() => {
    if (!count) return;
    const h = setTimeout(() => { if (count === 1) { setCount(0); setPlaying(true); } else setCount(count - 1); }, 800);
    return () => clearTimeout(h);
  }, [count]);

  useEffect(() => { if (!rec) return; const h = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(h); }, [rec]);

  // Pantalla encendida mientras se usa
  useEffect(() => { let w; navigator.wakeLock?.request("screen").then((x) => (w = x)).catch(() => {}); return () => { try { w?.release(); } catch {} }; }, []);

  const stopCam = useCallback(() => { cam?.getTracks().forEach((t) => t.stop()); setCam(null); }, [cam]);
  useEffect(() => () => cam?.getTracks().forEach((t) => t.stop()), [cam]);
  useEffect(() => { if (video.current && cam) video.current.srcObject = cam; }, [cam]);

  const startCam = async () => {
    setCamErr("");
    try {
      const v = orient === "vertical" ? { width: { ideal: 1080 }, height: { ideal: 1920 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } };
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", ...v }, audio: { echoCancellation: true, noiseSuppression: true } });
      setCam(s);
    } catch (e) {
      setCamErr(e.name === "NotAllowedError" ? "Permite el acceso a la cámara y al micrófono en el navegador." : e.name === "NotFoundError" ? "No se encontró cámara en este dispositivo." : e.message);
    }
  };

  const startRec = () => {
    if (!cam) return;
    const mime = pickMime();
    if (mime === null) { setCamErr("Este navegador no permite grabar. Prueba con Chrome, Edge o Safari actualizados."); return; }
    chunks.current = [];
    const r = new MediaRecorder(cam, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const type = r.mimeType || "video/webm";
      const blob = new Blob(chunks.current, { type });
      setTakes((t) => [...t, { url: URL.createObjectURL(blob), ext: type.includes("mp4") ? "mp4" : "webm", secs: Math.round((Date.now() - r._t0) / 1000), kb: Math.round(blob.size / 1024) }]);
    };
    r._t0 = Date.now(); r.start(1000);
    setRec({ recorder: r, t0: r._t0 });
    if (box.current) box.current.scrollTop = 0;
    setCount(3);
  };
  const stopRec = () => { rec?.recorder.stop(); setRec(null); setPlaying(false); };
  useEffect(() => () => takes.forEach((t) => URL.revokeObjectURL(t.url)), []); // eslint-disable-line

  const restart = () => { setPlaying(false); if (box.current) box.current.scrollTop = 0; };
  const toggle = () => (playing ? setPlaying(false) : setCount(3));

  useEffect(() => {
    const k = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "Escape") { stopRec(); onClose(); }
      else if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowUp") setSpeed((s) => Math.min(200, s + 5));
      else if (e.key === "ArrowDown") setSpeed((s) => Math.max(5, s - 5));
      else if (e.key === "+" || e.key === "=") setSize((s) => Math.min(96, s + 4));
      else if (e.key === "-") setSize((s) => Math.max(20, s - 4));
      else if (e.key.toLowerCase() === "m") setMirrorX((m) => !m);
      else if (e.key.toLowerCase() === "r") (rec ? stopRec() : startRec());
      else if (e.key === "Home") restart();
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const secs = rec ? Math.floor((now - rec.t0) / 1000) : 0;
  const slug = (piece?.title || "toma").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const ctl = "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-semibold hover:bg-white/20";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Teleprompter con cámara">
      {cam && <video ref={video} autoPlay muted playsInline className="absolute inset-0 size-full object-cover opacity-45" style={{ transform: "scaleX(-1)" }} />}

      <div className="relative z-10 flex flex-wrap items-center gap-2 bg-black/60 px-3 py-2 backdrop-blur">
        <div className="mr-auto min-w-0 truncate text-sm font-semibold">{piece?.title}{rec && <span className="ml-3 inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-bold"><Circle className="size-2.5 fill-white" />REC {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>}</div>
        <label className="flex items-center gap-2 text-xs">Velocidad<input type="range" min="5" max="200" step="5" value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-24 accent-bwo-cerise" aria-label="Velocidad" /><span className="w-8 tabular-nums">{speed}</span></label>
        <button className={ctl} onClick={() => setSize((s) => Math.max(20, s - 4))} aria-label="Letra más pequeña"><Minus className="size-3.5" /></button>
        <span className="text-xs tabular-nums">{size}px</span>
        <button className={ctl} onClick={() => setSize((s) => Math.min(96, s + 4))} aria-label="Letra más grande"><Plus className="size-3.5" /></button>
        <label className="hidden items-center gap-2 text-xs md:flex">Ancho<input type="range" min="40" max="100" value={width} onChange={(e) => setWidth(+e.target.value)} className="w-20 accent-bwo-cerise" aria-label="Ancho del texto" /></label>
        <button className={cn(ctl, mirrorX && "bg-bwo-violet")} onClick={() => setMirrorX(!mirrorX)} title="Espejo horizontal (M)"><FlipHorizontal2 className="size-3.5" /></button>
        <button className={cn(ctl, mirrorY && "bg-bwo-violet")} onClick={() => setMirrorY(!mirrorY)} title="Espejo vertical"><FlipVertical2 className="size-3.5" /></button>
        <button className={ctl} onClick={() => { stopRec(); stopCam(); onClose(); }} aria-label="Cerrar"><X className="size-4" /></button>
      </div>

      <div ref={box} className="relative z-10 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }} onWheel={() => setPlaying(false)}>
        <div className="mx-auto py-[45vh]" style={{ width: `${width}%`, transform: `scale(${mirrorX ? -1 : 1}, ${mirrorY ? -1 : 1})` }}>
          {blocks.length ? blocks.map((b, i) => (
            <div key={i} className="mb-[1.2em]" style={{ fontSize: size, lineHeight: 1.35 }}>
              {b.head && <div className="mb-1 text-[0.4em] font-bold uppercase tracking-widest text-bwo-cerise">{b.head}</div>}
              <div className="whitespace-pre-wrap font-semibold [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">{b.text}</div>
            </div>
          )) : <p className="text-center text-xl opacity-70">Esta pieza no tiene texto en sus tomas.</p>}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[38%] z-20 h-[3.2em] border-y-2 border-bwo-amber/50 bg-bwo-amber/5" style={{ fontSize: size }} aria-hidden="true" />
      {count > 0 && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center text-[30vh] font-black text-white/90">{count}</div>}

      <div className="relative z-10 flex flex-wrap items-center gap-2 bg-black/70 px-3 py-3 backdrop-blur">
        <button className={cn(ctl, "h-11 bg-bwo-violet px-5 text-sm")} onClick={toggle}>{playing ? <><Pause className="size-4" />Pausar</> : <><Play className="size-4" />Iniciar</>}</button>
        <button className={cn(ctl, "h-11")} onClick={restart}><RotateCcw className="size-4" />Inicio</button>
        <div className="mx-2 h-8 w-px bg-white/20" />
        {!cam ? <>
          <select value={orient} onChange={(e) => setOrient(e.target.value)} className="h-11 rounded-lg bg-white/10 px-2 text-xs" aria-label="Formato del video">
            <option value="vertical" className="text-black">Vertical 9:16 (Reels)</option><option value="horizontal" className="text-black">Horizontal 16:9</option>
          </select>
          <button className={cn(ctl, "h-11")} onClick={startCam}><Camera className="size-4" />Activar cámara</button>
        </> : <>
          {!rec ? <button className={cn(ctl, "h-11 bg-red-600 px-5 text-sm hover:bg-red-500")} onClick={startRec}><Circle className="size-4 fill-white" />Grabar (R)</button>
            : <button className={cn(ctl, "h-11 bg-red-600 px-5 text-sm")} onClick={stopRec}><Square className="size-4 fill-white" />Detener</button>}
          <button className={cn(ctl, "h-11")} onClick={stopCam} disabled={!!rec}><CameraOff className="size-4" />Apagar cámara</button>
        </>}
        {camErr && <span className="text-xs text-red-300">{camErr}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {takes.map((t, i) => <a key={t.url} href={t.url} download={`${slug}-toma-${i + 1}.${t.ext}`} className={cn(ctl, "h-11 bg-bwo-turquoise/20 text-bwo-turquoiseLt")}><Download className="size-4" />Toma {i + 1} · {t.secs}s</a>)}
        </div>
        <div className="w-full text-[10px] text-white/50">Espacio: iniciar/pausar · ↑↓ velocidad · +/− tamaño · M espejo · R grabar · Esc salir. Las tomas se guardan en tu dispositivo al descargarlas.</div>
      </div>
    </div>
  );
}
