import React, { useEffect, useRef, useState } from "react";
import { Camera, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { UserAvatar } from "../components/ProfileMenu";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", agency_name: "", phone: "", avatar: "" });
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const photo = useRef(null);
  useEffect(() => { setForm({ name: user.name || "", agency_name: user.agency_name || "", phone: user.phone || "", avatar: user.avatar || "" }); }, [user]);
  const choosePhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error("Choisissez une image JPG, PNG ou WebP de moins de 5 Mo."); return; }
    setProcessing(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 192;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 192, 192);
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 192, 192);
      setForm(prev => ({ ...prev, avatar: canvas.toDataURL("image/jpeg", 0.85) }));
    } catch { toast.error("Cette image n’a pas pu être ouverte. Essayez une autre photo."); }
    finally { URL.revokeObjectURL(url); setProcessing(false); }
  };
  const save = async event => {
    event.preventDefault(); setSaving(true);
    try { await api.put("/auth/me", form); await refresh(); toast.success("Votre profil a été enregistré."); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail) || "Impossible d’enregistrer votre profil."); }
    finally { setSaving(false); }
  };
  return <div className="mx-auto max-w-2xl" data-testid="profile-page">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Mon compte</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">Mon profil</h1>
    <p className="mt-2 text-gray-500">Votre photo et les coordonnées de votre agence.</p>
    <form onSubmit={save} className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-5"><UserAvatar user={form} className="h-20 w-20 text-2xl" /><div><input ref={photo} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="sr-only" tabIndex={-1} aria-label="Photo de profil" /><button type="button" disabled={processing || saving} onClick={() => photo.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"><Camera size={16} />{processing ? "Préparation…" : "Changer ma photo"}</button><p className="mt-2 text-xs text-gray-500">JPG, PNG ou WebP · 5 Mo maximum</p>{form.avatar && <button type="button" disabled={saving || processing} onClick={() => setForm(prev => ({ ...prev, avatar: "" }))} className="mt-1 min-h-9 text-xs text-gray-600 underline">Retirer la photo</button>}</div></div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">{[["name", "Votre nom"], ["agency_name", "Agence / structure"], ["phone", "Téléphone"]].map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}<input required={key !== "phone"} type={key === "phone" ? "tel" : "text"} autoComplete={key === "name" ? "name" : key === "phone" ? "tel" : "organization"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>)}<label className="block text-sm font-medium">Email<input value={user.email} disabled className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500" /></label></div>
      <button disabled={saving || processing} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save size={17} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  </div>;
}
