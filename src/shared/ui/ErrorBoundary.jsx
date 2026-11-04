import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { report } from "@/shared/lib/monitoring";

/** Aísla los errores de un módulo: si una pantalla falla, el resto de la
 *  plataforma sigue funcionando y el error queda registrado. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { report(error, { source: "react", module: this.props.name, componentStack: info?.componentStack?.slice(0, 1500) }); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bwo grid place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-14 text-center text-slate-200">
        <AlertTriangle className="mb-3 size-8 text-red-300" />
        <div className="font-bold text-white">Algo falló en {this.props.name || "este módulo"}</div>
        <p className="mt-1 max-w-md text-sm text-slate-300">El error quedó registrado para el equipo técnico. Puedes reintentar o ir a otro módulo.</p>
        <button onClick={() => this.setState({ error: null })} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">Reintentar</button>
      </div>
    );
  }
}
