import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { activationNext } from "../lib/activation";
import { useAuth } from "../context/AuthContext";
import "./GettingStarted.css";
import { ActivationContext } from "../context/ActivationContext";

export default function GettingStarted({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const refresh = useCallback(async (signal) => {
    const results = await Promise.allSettled([
      api.get("/dashboard/summary", { signal }),
      api.get("/whatsapp/status", { signal }),
      api.get("/plan/quota", { signal }),
    ]);
    if (signal.aborted) return;
    if (results[0].status !== "fulfilled") { setState(null); return; }
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
  }, [refresh, location.pathname, location.search]);
  const next = state?.owner === user.id && activationNext(state.summary, state.whatsapp, state.quota);
  const context = { ...(state?.owner === user.id ? state : {}), next };
  if (!next) return <ActivationContext.Provider value={context}>{children}</ActivationContext.Provider>;
  const { summary, whatsapp } = state;
  const nextHref = next.connect ? "/app/workers?connect=1" : next.href;
  const tasks = [
    { label: "Créer votre compte", done: true },
    { label: "Créer votre première mission", done: summary.missions_total > 0, href: "/app/missions/new" },
    { label: "Ajouter vos intervenants", done: summary.activation.active_workers > 0, href: "/app/workers?add=1" },
    { label: whatsapp ? "Connecter WhatsApp" : "Vérifier la connexion WhatsApp", done: !!whatsapp?.connected, href: "/app/workers?connect=1" },
    { label: "Envoyer votre première demande", done: !!summary.activation.first_invite_sent, href: nextHref },
  ];
  const completed = tasks.filter(t => t.done).length;
  return <ActivationContext.Provider value={context}><div className="getting-started-layout">
    <aside className={`getting-started ${location.pathname === nextHref.split("?")[0] ? "on-current-step" : ""}`} aria-label="Vos premiers pas" data-testid="getting-started">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider"><Sparkles size={16} aria-hidden="true" /> Vos premiers pas</div>
        <span className="text-sm font-semibold text-gray-600" aria-live="polite">{completed}/{tasks.length}</span>
      </div>
      <h2 className="getting-started-title mt-3 font-display font-bold text-xl text-gray-900">Votre équipe, prête à démarrer.</h2>
      <div className="mt-4 h-1.5 rounded-full bg-blue-100 overflow-hidden" role="progressbar" aria-label="Configuration terminée" aria-valuemin={0} aria-valuemax={5} aria-valuenow={completed}>
        <div className="h-full bg-blue-600 motion-safe:transition-all" style={{ width: `${completed / 5 * 100}%` }} />
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
