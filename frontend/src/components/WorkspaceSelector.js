import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function WorkspaceSelector({ compact = false }) {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const org = user?.organization;
  useEffect(() => {
    let live = true;
    if (user) api.get("/organization").then(({ data }) => { if (live) setSpaces(data.spaces || []); }).catch(() => {});
    return () => { live = false; };
  }, [user?.id, org?.id, org?.name]);
  async function switchSpace(event) {
    setBusy(true);
    try {
      await api.post("/organization/switch", { organization_id: event.target.value });
      // Clear all workspace-scoped component state, caches and pending views together.
      window.location.assign("/app/dashboard");
    } catch (error) { toast.error(formatApiError(error.response?.data?.detail)); setBusy(false); }
  }
  return <div className={"flex min-w-0 items-center gap-2 " + (compact ? "max-w-[220px]" : "w-full")} data-testid="workspace-selector">
    <Link to="/app/settings" aria-label="Paramètres de l’organisation" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-blue-700">
      {org?.avatar ? <img src={org.avatar} alt="" className="h-full w-full object-cover"/> : <Building2 size={18}/>}
    </Link>
    <div className="min-w-0 flex-1">
      {!compact && <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Organisation</p>}
      {spaces.length > 1 ? <select aria-label="Espace de travail" value={org?.id || ""} onChange={switchSpace} disabled={busy} className="w-full min-w-0 truncate bg-transparent py-1 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select> : <Link to="/app/settings" className="block truncate py-1 text-sm font-semibold text-gray-900">{org?.name || user?.agency_name || "Mon organisation"}</Link>}
    </div>
  </div>;
}
