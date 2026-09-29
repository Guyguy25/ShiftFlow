import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { activationNext, activationSteps } from "../lib/activation";
import { useAuth } from "../context/AuthContext";
import "./GettingStarted.css";
import { ActivationContext } from "../context/ActivationContext";

export default function GettingStarted({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [retryIndex, setRetryIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const refresh = useCallback(async (signal) => {
    setError(null);
    const results = await Promise.allSettled([
      api.get("/dashboard/summary", { signal }),
      api.get("/whatsapp/status", { signal }),
      api.get("/plan/quota", { signal }),
    ]);
    if (signal.aborted) return;
    if (results[0].status !== "fulfilled") { setState(null); setError("unavailable"); return; }
    setState({ owner: user.id, summary: results[0].value.data,
      whatsapp: results[1].status === "fulfilled" ? results[1].value.data : null,
      quota: results[2].status === "fulfilled" ? results[2].value.data : null });
  }, [user.id]);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const update = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try { await refresh(controller.signal); } finally { busy = false; }
    };
    update();
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [refresh, location.pathname, location.search, retryIndex]);
  const next = state?.owner === user.id && activationNext(state.summary, state.whatsapp, state.quota);
  const tasks = state?.owner === user.id ? activationSteps(state.summary, state.whatsapp, state.quota) : [];
  const context = { ...(state?.owner === user.id ? state : {}), next, steps: tasks, error, retry: () => setRetryIndex(index => index + 1) };
  // Settings has its own prominent activation card; do not duplicate it in a side rail.
  if (!next || ["/app/settings", "/app/dashboard", "/app/missions/new", "/app/workers"].includes(location.pathname)) return <ActivationContext.Provider value={context}>{children}</ActivationContext.Provider>;
  const nextHref = next.href || "/app/workers?connect=1";
  const completed = tasks.filter(t => t.done).length;
  return <ActivationContext.Provider value={context}><div className="getting-started-layout">
    <aside className={`getting-started ${location.pathname === nextHref.split("?")[0] ? "on-current-step" : ""}`} aria-label="Vos premiers pas" data-testid="getting-started">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider"><Sparkles size={16} aria-hidden="true" /> Vos premiers pas</div>
        <span className="text-sm font-semibold text-gray-600" aria-live="polite">{completed}/{tasks.length}</span>
      </div>
      <h2 className="getting-started-title mt-3 font-display font-bold text-xl text-gray-900">Vers votre première équipe confirmée.</h2>
      <div className="mt-4 h-1.5 rounded-full bg-blue-100 overflow-hidden" role="progressbar" aria-label="Actions de démarrage réalisées" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completed}>
        <div className="h-full bg-blue-600 motion-safe:transition-all" style={{ width: `${completed / 4 * 100}%` }} />
      </div>
      <button type="button" className="getting-started-toggle" aria-expanded={expanded} aria-controls="getting-started-tasks" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Masquer les étapes" : "Voir les étapes"}<ChevronDown size={16} className={expanded ? "rotate-180" : ""} />
      </button>
      <ol id="getting-started-tasks" className={`getting-started-tasks ${expanded ? "is-expanded" : ""}`}>
        {tasks.map((task, i) => <li key={task.label} className="flex items-center gap-3 py-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${task.done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`} aria-hidden="true">{task.done ? <Check size={17} /> : i + 1}</span>
          {task.done ? <span className="text-sm text-gray-500 line-through"><span className="sr-only">Terminé : </span>{task.label}</span> : <Link className="text-sm font-medium text-gray-800 hover:text-blue-700 focus-visible:outline-blue-600" to={task.href}>{task.label}</Link>}
        </li>)}
      </ol>
      <div className="getting-started-next mt-4 border-t border-gray-100 pt-4">
        <p className="text-sm leading-relaxed text-gray-600">{next.description}</p>
        <Link to={nextHref} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">{next.label}<ArrowRight size={16} className="shrink-0" /></Link>
      </div>
    </aside>
    <div className="min-w-0">{children}</div>
  </div></ActivationContext.Provider>;
}
