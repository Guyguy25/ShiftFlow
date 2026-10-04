import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { Check, ArrowRight, ChevronUp, X } from "lucide-react";
import { api } from "../lib/api";
import { activationNext, activationSteps } from "../lib/activation";
import { useAuth } from "../context/AuthContext";
import "./GettingStarted.css";
import OnboardingCoach from "./OnboardingCoach";
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
  const creatingMission = location.pathname === "/app/missions/new";
  const missionInProgress = creatingMission && tasks.some(t => t.id === "mission" && !t.done);
  const actionHref = task?.href || next?.href || "/app/dashboard";
  const alreadyOnAction = creatingMission && actionHref.split("?")[0] === location.pathname;
  const finished = tasks.length > 0 && completed === tasks.length;
  const progressPercent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const onPageTask = tasks.find(t => !t.done && t.href?.split("?")[0] === location.pathname);
  const nextTask = tasks.find(t => !t.done);
  return <ActivationContext.Provider value={context}>
    {children}
    <OnboardingCoach />
    {!state?.summary?.activation?.first_invite_sent && <Popover.Root open={expanded} onOpenChange={value => {
      setExpanded(value);
      if (value) setSelected(onPageTask?.id || nextTask?.id || null);
      else setSelected(null);
    }}>
      <Popover.Trigger asChild><button className="onboarding-launcher" aria-label={`Premiers pas : ${tasks.length ? `${completed} étapes sur ${tasks.length}` : "chargement"}`} data-testid="getting-started">
        <span className="flex items-center justify-between gap-6 text-sm font-semibold"><span>{finished ? "Bien démarré !" : "Premiers pas"}</span><span className="flex items-center gap-2 text-gray-500">{tasks.length ? `${completed}/${tasks.length}` : "…"}<ChevronUp size={15} /></span></span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Progression de démarrage" aria-valuemin={0} aria-valuemax={tasks.length || 4} aria-valuenow={tasks.length ? completed : undefined}><span className="block h-full rounded-full bg-emerald-500 motion-safe:transition-all motion-safe:duration-500" style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></span>
      </button></Popover.Trigger>
      <Popover.Portal><Popover.Content side="top" align="end" sideOffset={12} collisionPadding={12} className="onboarding-popover" aria-label="Guide de démarrage">
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100">{finished ? "Objectif atteint" : "Votre lancement"}</p>
              <h2 className="mt-1 text-lg font-bold">{finished ? "Votre espace est prêt" : "Votre première équipe, pas à pas"}</h2>
              <p className="mt-1 text-sm leading-relaxed text-blue-100">{finished ? "Vos bases sont en place. Vous pouvez garder ce guide comme repère." : completed ? `${completed} étape${completed > 1 ? "s" : ""} validée${completed > 1 ? "s" : ""} · continuez jusqu’à votre première demande.` : "4 étapes simples pour aller jusqu’à votre première demande envoyée."}</p>
            </div>
            <Popover.Close aria-label="Réduire le guide" className="rounded-lg p-2 text-blue-100 hover:bg-white/10 hover:text-white"><X size={18} /></Popover.Close>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold"><span>Progression</span><span>{progressPercent}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Progression détaillée du démarrage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><span className="block h-full rounded-full bg-white motion-safe:transition-all motion-safe:duration-500" style={{ width: `${progressPercent}%` }} /></div>
          {!!tasks.length && <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden="true">{tasks.map((t, i) => <span key={t.id} className={`h-1.5 rounded-full ${t.done ? "bg-emerald-300" : onPageTask?.id === t.id ? "bg-white animate-pulse" : i === completed ? "bg-blue-200" : "bg-white/20"}`} />)}</div>}
        </div>
        {!tasks.length ? <p className="mt-4 text-sm text-gray-600">{error ? <>Impossible de charger les étapes. <button onClick={context.retry} className="text-blue-700 underline">Réessayer</button></> : "Chargement de vos étapes…"}</p> : <>
          <ol className="mt-4 space-y-2">{tasks.map((t, i) => {
            const inProgress = onPageTask?.id === t.id;
            const isSelected = selected === t.id;
            return <li key={t.id}><button onClick={() => setSelected(t.id)} aria-expanded={isSelected} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border p-2.5 text-left text-sm transition-all ${inProgress ? "border-blue-300 bg-blue-50 shadow-sm shadow-blue-100" : isSelected ? "border-gray-200 bg-gray-50" : "border-transparent hover:border-blue-100 hover:bg-blue-50/60"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${t.done ? "bg-emerald-100 text-emerald-700" : inProgress ? "bg-blue-600 text-white shadow-sm shadow-blue-200" : "bg-gray-100 text-gray-500"}`}>{t.done ? <Check size={18} /> : i + 1}</span><span className="min-w-0 flex-1"><span className={`block ${t.done ? "text-gray-500 line-through decoration-gray-300" : inProgress ? "font-bold text-blue-950" : "font-medium text-gray-900"}`}>{t.done && <span className="sr-only">Terminé : </span>}{t.label}</span>{inProgress && <span className="mt-0.5 block text-xs font-medium text-blue-700">Vous êtes ici · terminez cette action pour avancer</span>}</span>{t.done ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">Fait</span> : inProgress ? <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />En cours</span> : null}</button></li>;
          })}</ol>
          <div className={`mt-4 rounded-2xl border p-4 ${task && onPageTask?.id === task.id && !task.done ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50" : "border-gray-200 bg-gray-50"}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${task?.done ? "text-emerald-700" : task && onPageTask?.id === task.id ? "text-blue-700" : "text-gray-500"}`}>{task?.done ? "Étape terminée" : task && onPageTask?.id === task.id ? "Étape en cours" : finished ? "Terminé" : "Prochaine étape"}</span>
              {!!task && <span className="text-xs font-semibold text-gray-500">{Math.min(tasks.findIndex(t => t.id === task.id) + 1, tasks.length)}/{tasks.length}</span>}
            </div>
            <p className={`text-sm leading-relaxed ${task && onPageTask?.id === task.id && !task.done ? "font-medium text-blue-950" : "text-gray-700"}`}>{missionInProgress && (!task || task.id === "mission") ? "Vous êtes au bon endroit. Continuez le formulaire : cette étape sera validée quand votre mission sera créée." : task ? descriptions[task.id] : finished ? "Vous pouvez retrouver vos missions et leurs réponses depuis l’accueil." : next?.description || "Choisissez une étape pour voir comment faire."}</p>
            {!alreadyOnAction && <Link onClick={() => setExpanded(false)} to={actionHref} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">{task ? task.shortLabel : next?.label || "Voir mes missions"}<ArrowRight size={16} /></Link>}
          </div>
        </>}
        <div className="mt-3 flex flex-wrap gap-x-4 border-t border-gray-100 pt-2">
          <button onClick={() => { setExpanded(false); window.dispatchEvent(new CustomEvent("shiftflow:replay-guide", { detail: { mode: "action" } })); }} className="min-h-11 text-sm font-semibold text-blue-700">Me guider sur cette page</button>
          <button onClick={() => { setExpanded(false); window.dispatchEvent(new CustomEvent("shiftflow:replay-guide", { detail: { mode: "sections" } })); }} className="min-h-11 text-sm text-gray-600 underline">Découvrir les sections</button>
        </div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>}
  </ActivationContext.Provider>;
}
