import { readPageData } from "../lib/pageData";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Building2, Check, ChevronDown, Settings, Users, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { workspacePath } from "../lib/workspacePaths";
import { toast } from "sonner";

export default function WorkspaceSelector({ compact = false }) {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const org = user?.organization;
  const settings = workspacePath(org?.id, "/app/settings");
  useEffect(() => {
    let live = true;
    setSpaces([]);
    if (user?.id) readPageData(api, "/organization").then(({ data }) => { if (live) setSpaces(data.spaces || []); }).catch(() => {});
    return () => { live = false; };
  }, [user?.id, org?.id, org?.name]);
  async function switchSpace(id) {
    setBusy(true);
    try {
      await api.post("/organization/switch", { organization_id: id });
      window.location.assign(workspacePath(id));
    } catch (error) { toast.error(formatApiError(error.response?.data?.detail) || "Impossible de changer d’espace."); setBusy(false); }
  }
  const item = "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-gray-700 outline-none focus:bg-blue-50 focus:text-blue-700";
  return <Menu.Root><Menu.Trigger asChild><button type="button" disabled={busy} aria-label={`Ouvrir le menu de l’organisation ${org?.name || user?.agency_name || "Mon organisation"}`} data-testid="workspace-selector" className={`group flex min-w-0 items-center gap-2 rounded-xl border border-transparent text-left transition-colors hover:border-gray-200 hover:bg-gray-50 data-[state=open]:border-blue-100 data-[state=open]:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${compact ? "w-full max-w-[min(55vw,260px)] p-1.5" : "w-full p-2"}`}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">{org?.avatar ? <img src={org.avatar} alt="" className="h-full w-full object-cover"/> : <Building2 size={18}/>}</span>
    <span className="min-w-0 flex-1">{!compact && <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Organisation</span>}<span className="block truncate text-sm font-semibold text-gray-900">{org?.name || user?.agency_name || "Mon organisation"}</span></span>
    <ChevronDown size={16} className="shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true"/>
  </button></Menu.Trigger><Menu.Portal><Menu.Content align="start" sideOffset={8} className="z-[70] max-h-[var(--radix-dropdown-menu-content-available-height)] w-72 max-w-[calc(100vw-24px)] overflow-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
    <Menu.Label className="break-words px-3 py-2 text-xs text-gray-500">{org?.name || "Mon organisation"}</Menu.Label>
    <Menu.Item asChild><Link to={settings} className={item}><Settings size={17}/>Paramètres de l’organisation</Link></Menu.Item>
    <Menu.Item asChild><Link to={`${settings}#collaborateurs`} className={item}><Users size={17}/>Membres et invitations</Link></Menu.Item>
    {spaces.length > 1 && <><Menu.Separator className="my-2 h-px bg-gray-100"/><Menu.Label className="px-3 py-2 text-xs text-gray-500">Mes espaces</Menu.Label>{spaces.map(space => <Menu.Item key={space.id} disabled={busy} onSelect={() => { if (space.id !== org?.id) switchSpace(space.id); }} className={item}><Building2 size={16} className="shrink-0"/><span className="min-w-0 flex-1 truncate">{space.name}</span>{space.id === org?.id && <Check size={16} className="shrink-0 text-blue-600"/>}</Menu.Item>)}</>}
    {user?.can_create_organization && <><Menu.Separator className="my-2 h-px bg-gray-100"/><Menu.Item asChild><Link to="/organizations/new" className={item}><Plus size={17}/>Créer une organisation</Link></Menu.Item><p className="px-3 pb-2 text-[11px] text-gray-500">Données séparées, abonnement partagé entre vos espaces.</p></>}
  </Menu.Content></Menu.Portal></Menu.Root>;
}
