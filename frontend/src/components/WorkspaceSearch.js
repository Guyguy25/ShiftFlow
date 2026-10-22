import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link, useLocation } from "react-router-dom";
import { CalendarClock, Search, Users, X } from "lucide-react";
import { api } from "../lib/api";
import { workspacePath } from "../lib/workspacePaths";

export default function WorkspaceSearch({ organizationId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); setQuery(""); setResult(null); }, [location.pathname, location.search, organizationId]);
  useEffect(() => {
    const shortcut = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(value => !value); } };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    setResult(null); setError(false);
    if (!open || query.trim().length < 2) { setLoading(false); return; }
    let live = true;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api.get("/workspace/search", { params: { q: query.trim() }, signal: controller.signal })
        .then(({ data }) => { if (live) setResult(data); })
        .catch(() => { if (live) setError(true); })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [open, query, organizationId]);
  const rows = [
    ...(result?.missions || []).map(mission => ({ id: `mission-${mission.id}`, title: mission.name, detail: `${mission.archived ? "Mission archivée" : "Mission"}${mission.location ? ` · ${mission.location}` : ""}`, icon: CalendarClock, to: workspacePath(organizationId, `/app/missions/${encodeURIComponent(mission.id)}`) })),
    ...(result?.workers || []).map(worker => ({ id: `worker-${worker.id}`, title: `${worker.first_name || ""} ${worker.last_name || ""}`.trim(), detail: "Intervenant", icon: Users, to: workspacePath(organizationId, `/app/workers?q=${encodeURIComponent(`${worker.first_name || ""} ${worker.last_name || ""}`.trim())}`) })),
  ];
  return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (!value) { setQuery(""); setResult(null); } }}>
    <Dialog.Trigger asChild><button type="button" aria-label="Rechercher une mission ou un intervenant" className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl text-gray-500 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-64 sm:justify-start sm:border sm:border-gray-200 sm:bg-gray-50 sm:px-3 xl:w-80"><Search size={18}/><span className="hidden text-sm sm:block">Rechercher…</span><kbd className="ml-auto hidden rounded border bg-white px-1.5 text-[10px] text-gray-400 sm:block">⌘ / Ctrl K</kbd></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-gray-950/30 backdrop-blur-sm"/><Dialog.Content className="fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-[81] mx-auto flex max-h-[80dvh] max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl outline-none sm:top-[15vh]">
      <div className="flex items-center gap-3 border-b p-4"><Search size={20} className="shrink-0 text-blue-600"/><Dialog.Title className="sr-only">Rechercher dans l’organisation</Dialog.Title><input aria-label="Rechercher dans l’organisation" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="Mission, lieu, intervenant…" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none"/><Dialog.Close aria-label="Fermer la recherche" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><X size={20}/></Dialog.Close></div>
      <Dialog.Description className="px-4 pt-3 text-xs text-gray-500">Missions et intervenants de votre organisation · 6 résultats maximum par catégorie.</Dialog.Description>
      <div className="overflow-y-auto p-3" aria-live="polite" aria-busy={loading}>
        {query.trim().length < 2 ? <p className="p-4 text-sm text-gray-500">Saisissez au moins 2 caractères.</p> : loading ? <p role="status" className="p-4 text-sm text-gray-500">Recherche en cours…</p> : error ? <p role="alert" className="p-4 text-sm text-red-600">La recherche est indisponible. Modifiez votre recherche pour réessayer.</p> : result && !rows.length ? <p className="p-4 text-sm text-gray-500">Aucun résultat pour « {query.trim()} ».</p> : rows.map(row => <Link key={row.id} to={row.to} onClick={() => setOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl p-3 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500"><row.icon size={18}/></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900">{row.title}</span><span className="block truncate text-xs text-gray-500">{row.detail}</span></span></Link>)}
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
