import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Camera, Copy, LockKeyhole, Send, Users } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function OrganizationSettings() {
  const { user, refresh } = useAuth();
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({ name: "", avatar: "" });
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  const load = async () => {
    const { data } = await api.get("/organization");
    setOrg(data); setForm({ name: data.name, avatar: data.avatar || "" });
  };
  useEffect(() => { let live = true; api.get("/organization").then(({ data }) => { if (live) { setOrg(data); setForm({ name: data.name, avatar: data.avatar || "" }); } }).catch(() => { if (live) setError("Impossible de charger l’organisation. Rechargez la page."); }); return () => { live = false; }; }, [user?.organization?.id]);
  const owner = org?.role === "owner";
  const used = Math.max(0, (org?.members?.length || 1) - 1) + (org?.invitations?.length || 0);
  const canInvite = owner && org?.team_enabled && used < 5;
  async function action(fn) {
    setBusy(true); setError("");
    try { await fn(); } catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { setBusy(false); }
  }
  async function photo(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choisissez une image JPG, PNG ou WebP de moins de 5 Mo."); return; }
    const url = URL.createObjectURL(file); setBusy(true);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 192;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, 192, 192);
      const side = Math.min(image.width, image.height);
      ctx.drawImage(image, (image.width-side)/2, (image.height-side)/2, side, side, 0, 0, 192, 192);
      setForm(previous => ({ ...previous, avatar: canvas.toDataURL("image/jpeg", 0.85) }));
    } catch { setError("Cette photo n’a pas pu être ouverte."); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  }
  return <section className="rounded-xl border border-gray-200 bg-white p-6" data-testid="organization-settings">
    <h2 className="flex items-center gap-2 text-lg font-bold"><Building2 size={20} className="text-blue-600"/> Mon organisation</h2>
    <p className="mt-2 text-sm text-gray-500">Un espace commun pour vos missions, vos intervenants et votre équipe.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!org ? <p className="mt-4 text-sm text-gray-500">Chargement…</p> : <>
      <form onSubmit={event => { event.preventDefault(); action(async () => { await api.put("/organization", form); await load(); await refresh(); toast.success("Organisation enregistrée."); }); }} className="mt-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700">{form.avatar ? <img src={form.avatar} alt="Photo de l’organisation" className="h-full w-full object-cover"/> : <Building2 size={28}/>}</span>
          {owner && <><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={photo} className="hidden"/><button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Camera size={16}/>Changer la photo</button>{form.avatar && <button type="button" onClick={() => setForm({ ...form, avatar: "" })} className="text-xs text-gray-500">Retirer</button>}</>}
        </div>
        <label className="mt-4 block text-sm font-medium">Nom de l’organisation<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required maxLength={120} disabled={!owner || busy} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 disabled:bg-gray-50"/></label>
        {owner ? <button disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Enregistrer l’organisation</button> : <p className="mt-3 text-xs text-gray-500">Le propriétaire gère les informations et les accès de l’organisation.</p>}
      </form>
      <div className="mt-7 border-t border-gray-100 pt-5">
        <h3 className="flex items-center gap-2 font-semibold"><Users size={18}/>Collaborateurs</h3>
        <p className="mt-2 text-sm text-gray-500">Pro Team : le propriétaire + 5 collaborateurs. Les invitations en attente réservent une place.</p>
        {!org.team_enabled && <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><p className="flex items-center gap-2 font-semibold"><LockKeyhole size={16}/>Invitations disponibles avec Pro Team</p><p className="mt-1">89 €/mois ou 747,60 €/an. Missions et intervenants illimités pour toute l’organisation.</p>{owner && <Link to="/pricing#team" className="mt-2 inline-block font-semibold underline">Découvrir Pro Team</Link>}</div>}
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); action(async () => { const { data } = await api.post("/organization/invitations", { email }); setInvite(data); setEmail(""); await load(); }); }}>
          <label className="min-w-0 flex-1"><span className="sr-only">Email du collaborateur</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="collegue@entreprise.fr" required maxLength={254} disabled={!canInvite || busy} className="h-11 w-full rounded-lg border px-3 disabled:bg-gray-50"/></label>
          <button disabled={!canInvite || busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500"><Send size={16}/>Inviter</button>
        </form>
        {owner && org.team_enabled && <p className="mt-2 text-xs text-gray-500">{used}/5 places collaborateurs utilisées ou réservées.</p>}
        {invite && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><p>{invite.email_sent ? `Invitation envoyée à ${invite.email}.` : `Invitation créée pour ${invite.email}. Copiez le lien et transmettez-le à cette personne.`}</p><div className="mt-2 flex gap-2"><input readOnly aria-label="Lien d’invitation" value={invite.url} className="min-w-0 flex-1 rounded border bg-white px-2 text-xs"/><button type="button" className="inline-flex items-center gap-1 rounded bg-white p-2 text-xs" onClick={() => navigator.clipboard.writeText(invite.url).then(() => toast.success("Lien copié.")).catch(() => toast.error("Sélectionnez le lien pour le copier."))}><Copy size={14}/>Copier</button></div></div>}
        <ul className="mt-4 divide-y divide-gray-100">{(org.members || []).map(member => <li key={member.id} className="flex items-center gap-3 py-3 text-sm"><span className="min-w-0 flex-1"><strong className="block truncate">{member.name || member.email}</strong><span className="block truncate text-xs text-gray-500">{member.email}</span></span>{member.role === "owner" ? <span className="text-xs text-blue-700">Propriétaire</span> : owner && <button disabled={busy} className="text-xs text-red-600" onClick={() => { if (window.confirm(`Retirer l’accès de ${member.email} ? Ses données personnelles et les missions de l’organisation seront conservées.`)) action(async () => { await api.delete(`/organization/members/${member.id}`); await load(); }); }}>Retirer</button>}</li>)}</ul>
        {(org.invitations || []).map(pending => <div key={pending.id} className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs"><span className="min-w-0 flex-1 truncate">{pending.email} · Invitation en attente</span><button disabled={busy} className="text-red-600" onClick={() => action(async () => { await api.delete(`/organization/invitations/${pending.id}`); if (invite?.id === pending.id) setInvite(null); await load(); })}>Annuler</button></div>)}
      </div>
    </>}
  </section>;
}
