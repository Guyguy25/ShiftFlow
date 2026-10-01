import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { Check, ArrowRight, ChevronUp, X } from "lucide-react";
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
  const [selected, setSelected] = useState(null);
  useEffect(() => { setExpanded(false); setSelected(null); }, [location.pathname, location.search]);
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
  const completed = tasks.filter(t => t.done).length;
  const descriptions = {
    mission: "Indiquez le lieu, la date et le nombre de personnes nécessaires. Préparer une mission n’envoie aucun message.",
    workers: "Ajoutez les personnes de votre réseau que vous souhaitez solliciter pour vos missions.",
    whatsapp: "Reliez le compte WhatsApp qui enverra vos demandes. Vos intervenants n’ont pas de compte à créer.",
    invite: "Choisissez les intervenants et leur ordre de priorité. Vérifiez le message, puis confirmez le lancement.",
  };
  const task = tasks.find(t => t.id === selected);
  const finished = tasks.length > 0 && completed === tasks.length;
  return <ActivationContext.Provider value={context}>
    {children}
    <Popover.Root open={expanded} onOpenChange={value => { setExpanded(value); if (!value) setSelected(null); }}>
      <Popover.Trigger asChild><button className="onboarding-launcher" aria-label={`Premiers pas : ${tasks.length ? `${completed} étapes sur ${tasks.length}` : "chargement"}`} data-testid="getting-started">
        <span className="flex items-center justify-between gap-6 text-sm font-semibold"><span>{finished ? "Bien démarré !" : "Premiers pas"}</span><span className="flex items-center gap-2 text-gray-500">{tasks.length ? `${completed}/${tasks.length}` : "…"}<ChevronUp size={15} /></span></span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Progression de démarrage" aria-valuemin={0} aria-valuemax={tasks.length || 4} aria-valuenow={tasks.length ? completed : undefined}><span className="block h-full rounded-full bg-emerald-500 motion-safe:transition-all motion-safe:duration-500" style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></span>
      </button></Popover.Trigger>
      <Popover.Portal><Popover.Content side="top" align="end" sideOffset={12} collisionPadding={12} className="onboarding-popover" aria-label="Guide de démarrage">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{finished ? "Votre espace est prêt" : "Votre première équipe, pas à pas"}</h2><p className="mt-1 text-sm text-gray-500">{finished ? "Retrouvez vos repères quand vous en avez besoin." : "Une action à la fois. Votre progression se met à jour toute seule."}</p></div><Popover.Close aria-label="Réduire le guide" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></Popover.Close></div>
        {!tasks.length ? <p className="mt-4 text-sm text-gray-600">{error ? <>Impossible de charger les étapes. <button onClick={context.retry} className="text-blue-700 underline">Réessayer</button></> : "Chargement de vos étapes…"}</p> : <>
          <ol className="mt-4 space-y-1">{tasks.map((t, i) => <li key={t.id}><button onClick={() => setSelected(t.id)} aria-expanded={selected === t.id} className={`flex min-h-12 w-full items-center gap-3 rounded-xl p-2 text-left text-sm hover:bg-blue-50 ${selected === t.id ? "bg-blue-50" : ""}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${t.done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{t.done ? <Check size={17} /> : i + 1}</span><span className={t.done ? "text-gray-500" : "font-medium text-gray-900"}>{t.done && <span className="sr-only">Terminé : </span>}{t.label}</span></button></li>)}</ol>
          <div className="mt-4 rounded-xl bg-blue-50 p-4"><p className="text-sm leading-relaxed text-blue-950">{task ? descriptions[task.id] : finished ? "Vous pouvez retrouver vos missions et leurs réponses depuis l’accueil." : next?.description || "Choisissez une étape pour voir comment faire."}</p><Link onClick={() => setExpanded(false)} to={task?.href || next?.href || "/app/dashboard"} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">{task ? task.shortLabel : next?.label || "Voir mes missions"}<ArrowRight size={16} /></Link></div>
        </>}
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  </ActivationContext.Provider>;
}
