import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2, Edit2, X, Info, MessageCircle, Smartphone, Check, RefreshCw, ArrowRight, UserPlus } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast, Toaster } from "sonner";
import UpgradeModal from "../components/UpgradeModal";
import WhatsAppQrGuide from "../components/WhatsAppQrGuide";

const SKILLS = ["montage", "demontage", "technique", "electricite", "manutention"];
const NAME_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'\-]{1,39}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function isPhoneValid(raw) { const digits = (raw || "").replace(/[\s.\-()]/g, ""); if (!digits) return false; if (digits.startsWith("+33")) return /^\+33[1-9]\d{8}$/.test(digits); if (digits.startsWith("0")) return /^0[1-9]\d{8}$/.test(digits); if (digits.startsWith("+")) return /^\+\d{10,15}$/.test(digits); return false; }
function validateWorker(f) { const errs = {}; if (!NAME_RE.test((f.first_name || "").trim())) errs.first_name = "Prénom : 2 à 40 lettres (accents, tirets, apostrophes OK)."; if (!NAME_RE.test((f.last_name || "").trim())) errs.last_name = "Nom : 2 à 40 lettres."; if (!isPhoneValid(f.phone)) errs.phone = "Téléphone invalide (ex : +33612345678 ou 0612345678)."; if (f.email && !EMAIL_RE.test(f.email.trim())) errs.email = "Email invalide."; return errs; }
function WorkerForm({ initial, onClose, onSaved, onQuota }) { const [form, setForm] = useState(initial || { first_name: "", last_name: "", phone: "", email: "", skills: [], note: "", active: true }); const [saving, setSaving] = useState(false); const [errors, setErrors] = useState({}); const [serverError, setServerError] = useState(""); const set = (key, value) => setForm({ ...form, [key]: value }); const toggleSkill = (skill) => set("skills", form.skills.includes(skill) ? form.skills.filter((item) => item !== skill) : [...form.skills, skill]); const submit = async (event) => { event.preventDefault(); const errs = validateWorker(form); setErrors(errs); if (Object.keys(errs).length > 0) return; setSaving(true); setServerError(""); try { if (initial?.id) { await api.put(`/workers/${initial.id}`, form); toast.success("Intervenant modifié"); } else { await api.post("/workers", form); toast.success("Intervenant ajouté"); } onSaved(); } catch (err) { const status = err.response?.status; const detail = formatApiError(err.response?.data?.detail) || err.message; if (status === 402) { onQuota(detail); onClose(); } else setServerError(detail); } finally { setSaving(false); } }; const inputCls = (err) => `mt-1 w-full h-11 px-3 rounded-md border ${err ? "border-red-400 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"} focus:outline-none focus:ring-2 bg-white`; return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}><div onClick={(event) => event.stopPropagation()} className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90dvh] overflow-y-auto" data-testid="worker-form-modal"><div className="flex items-center justify-between"><h3 className="font-display font-bold text-xl">{initial ? "Modifier l'intervenant" : "Nouvel intervenant"}</h3><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button></div><form onSubmit={submit} noValidate className="mt-4 space-y-4"><div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Prénom *</label><input required data-testid="wf-first" className={inputCls(errors.first_name)} value={form.first_name} onChange={(event) => set("first_name", event.target.value)} />{errors.first_name && <div className="text-xs text-red-600 mt-1">{errors.first_name}</div>}</div><div><label className="text-sm font-medium">Nom *</label><input required data-testid="wf-last" className={inputCls(errors.last_name)} value={form.last_name} onChange={(event) => set("last_name", event.target.value)} />{errors.last_name && <div className="text-xs text-red-600 mt-1">{errors.last_name}</div>}</div></div><div><label className="text-sm font-medium">Téléphone *</label><input required data-testid="wf-phone" className={inputCls(errors.phone)} value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+33612345678 ou 0612345678" />{errors.phone && <div className="text-xs text-red-600 mt-1">{errors.phone}</div>}</div><div><label className="text-sm font-medium">Email <span className="text-gray-400 text-xs">(facultatif)</span></label><input type="text" inputMode="email" className={inputCls(errors.email)} value={form.email} onChange={(event) => set("email", event.target.value)} />{errors.email && <div className="text-xs text-red-600 mt-1">{errors.email}</div>}</div><div><label className="text-sm font-medium">Compétences</label><div className="mt-2 flex flex-wrap gap-2">{SKILLS.map((skill) => <button key={skill} type="button" onClick={() => toggleSkill(skill)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.skills.includes(skill) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>{skill}</button>)}</div></div><div><label className="text-sm font-medium">Note interne</label><textarea rows={2} maxLength={500} className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={form.note} onChange={(event) => set("note", event.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} className="w-4 h-4 accent-blue-600" />Actif</label>{serverError && <div className="text-sm text-red-600">{serverError}</div>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300">Annuler</button><button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button></div></form></div></div>; }
function isContactPickerSupported() { return typeof navigator !== "undefined" && "contacts" in navigator && typeof navigator.contacts?.select === "function" && typeof window !== "undefined" && "ContactsManager" in window; }
function isIPhoneDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  return /iPhone|iPod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1 && window.innerWidth < 768);
}
function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}
function splitFullName(fullName) { const parts = (fullName || "").trim().split(/\s+/).filter(Boolean); if (parts.length === 0) return { first_name: "", last_name: "" }; if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] }; return { first_name: parts[0], last_name: parts.slice(1).join(" ") }; }
function PhoneContactsUnsupportedModal({ onClose }) { return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}><div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl text-center"><div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center"><Smartphone className="w-7 h-7 text-amber-700" /></div><h3 className="mt-4 font-display font-bold text-xl">Répertoire non accessible depuis ce navigateur</h3><p className="mt-2 text-sm text-gray-600">Sur iPhone, Safari ne donne actuellement pas aux sites web l'accès au sélecteur natif de contacts. iOS n'affiche donc aucune demande d'autorisation, même si ShiftFlow est ouvert dans Safari.</p><p className="mt-2 text-sm text-gray-600">Pour le moment, utilisez <strong>« Depuis WhatsApp »</strong> sur iPhone. L'import direct du répertoire reste disponible sur les navigateurs mobiles qui exposent cette fonction.</p><button type="button" onClick={onClose} className="mt-5 w-full px-4 py-2.5 rounded-md bg-blue-600 text-white font-medium">Compris</button></div></div>; }
function PhoneContactsImportModal({ onClose, onDone, onQuota }) { const [rows, setRows] = useState([]); const [selected, setSelected] = useState(new Set()); const [search, setSearch] = useState(""); const [picking, setPicking] = useState(false); const [importing, setImporting] = useState(false); const pickFromDevice = async () => { if (picking) return; setPicking(true); try { const picked = await navigator.contacts.select(["name", "tel", "email"], { multiple: true }); const built = picked.map((c, idx) => { const { first_name, last_name } = splitFullName((c.name && c.name[0]) || ""); const phone = (c.tel && c.tel[0]) || ""; const email = (c.email && c.email[0]) || ""; const errs = validateWorker({ first_name, last_name, phone, email }); return { key: `${idx}-${phone || first_name}`, first_name, last_name, phone, email, valid: Object.keys(errs).length === 0, reason: errs.phone || errs.first_name || errs.last_name || "" }; }); setRows(built); setSelected(new Set(built.filter((r) => r.valid).map((r) => r.key))); } catch (err) { if (err?.name !== "AbortError") toast.error("Impossible d'accéder aux contacts du téléphone."); } finally { setPicking(false); } }; const toggle = (key) => setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); const filteredRows = rows.filter((r) => `${r.first_name} ${r.last_name} ${r.phone}`.toLowerCase().includes(search.toLowerCase())); const submit = async () => { const workers = rows.filter((r) => r.valid && selected.has(r.key)).map(({ first_name, last_name, phone, email }) => ({ first_name, last_name, phone, email, skills: [], note: "", active: true })); if (workers.length === 0) return toast.error("Sélectionnez au moins un contact."); setImporting(true); try { const { data } = await api.post("/workers/bulk", { workers }); if (data.quota_hit) onQuota(`${data.created} contact(s) ajouté(s). La limite du plan gratuit a été atteinte.`); else toast.success(`${data.created} intervenant${data.created > 1 ? "s" : ""} ajouté${data.created > 1 ? "s" : ""}`); onDone(); onClose(); } catch (err) { const statusCode = err.response?.status; const detail = formatApiError(err.response?.data?.detail) || "Erreur pendant l'import des contacts."; if (statusCode === 402) { onQuota(detail); onClose(); } else toast.error(detail); } finally { setImporting(false); } }; const invalidCount = rows.filter((r) => !r.valid).length; return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}><div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto flex flex-col"><div className="flex items-center justify-between"><div><h3 className="font-display font-bold text-xl">Importer les contacts</h3><p className="text-sm text-gray-500 mt-1">Choisissez les contacts à ajouter comme intervenants.</p></div><button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button></div>{rows.length === 0 ? <div className="py-12 text-center"><div className="w-14 h-14 mx-auto rounded-full bg-blue-50 flex items-center justify-center"><Smartphone className="w-7 h-7 text-blue-600" /></div><h4 className="mt-4 font-semibold text-gray-900">Ouvrir le répertoire du téléphone</h4><p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">Le navigateur exige que l'ouverture des contacts parte directement d'un clic. Appuyez sur le bouton ci-dessous pour afficher le sélecteur natif.</p><button type="button" onClick={pickFromDevice} disabled={picking} className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60"><Smartphone className="w-4 h-4" />{picking ? "Ouverture…" : "Choisir dans mes contacts"}</button></div> : <><div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full h-10 pl-9 pr-3 rounded-md border border-gray-300" /></div>{invalidCount > 0 && <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{invalidCount} contact{invalidCount > 1 ? "s" : ""} ignoré{invalidCount > 1 ? "s" : ""} (numéro manquant ou invalide).</div>}<div className="mt-3 border border-gray-200 rounded-lg overflow-y-auto flex-1">{filteredRows.map((row) => { const checked = row.valid && selected.has(row.key); return <label key={row.key} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 ${row.valid ? "cursor-pointer hover:bg-gray-50" : "opacity-50"}`}><input type="checkbox" checked={checked} disabled={!row.valid} onChange={() => toggle(row.key)} className="w-4 h-4 accent-blue-600" /><div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-600">{`${row.first_name}${row.last_name}`.slice(0, 2).toUpperCase() || "?"}</div><div className="flex-1 min-w-0"><div className="font-medium truncate">{row.first_name} {row.last_name}</div><div className="text-sm text-gray-500 truncate">{row.phone || row.reason}</div></div></label>; })}</div><div className="mt-5 flex items-center justify-between"><button type="button" onClick={pickFromDevice} disabled={picking} className="text-sm text-blue-700 font-medium disabled:opacity-60">{picking ? "Ouverture…" : "Modifier la sélection"}</button><div className="flex gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300">Annuler</button><button type="button" onClick={submit} disabled={importing || selected.size === 0} className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60">{importing ? "Import…" : `Importer ${selected.size} contact(s)`}</button></div></div></>}</div></div>; }

function WhatsAppImportModal({ onClose, onDone, onQuota }) {
  const mobile = isMobileViewport();
  const [status, setStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [contactsReady, setContactsReady] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [startingSession, setStartingSession] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [pairPhone, setPairPhone] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState("");
  const refreshLockRef = useRef(false);
  const sessionStartLockRef = useRef(false);

  const startWhatsAppSession = useCallback(async () => {
    if (sessionStartLockRef.current) return;
    sessionStartLockRef.current = true;
    setStartingSession(true);
    try {
      await api.post("/whatsapp/session/start");
    } catch (err) {
      console.error("Erreur démarrage WhatsApp :", err);
    } finally {
      sessionStartLockRef.current = false;
      setStartingSession(false);
    }
  }, []);

  const fetchStatusAndContacts = useCallback(async () => {
    try {
      const { data } = await api.get("/whatsapp/status");
      setStatus(data);
      if (data.refreshCooldown > 0) setRefreshCooldown(data.refreshCooldown);
      if (!data.connected) {
        setContactsReady(false);
        setLoading(false);
        if (!data.hasQR && !data.starting) await startWhatsAppSession();
        return;
      }
      setPairError("");
      setLoading(false);
      try {
        const { data: loadedContacts } = await api.get("/whatsapp/contacts");
        setContacts(Array.isArray(loadedContacts) ? loadedContacts : []);
        setContactsReady(true);
      } catch (contactsError) {
        console.error("Erreur récupération contacts :", contactsError);
        setContactsReady(true);
      }
    } catch (err) {
      console.error("Erreur statut WhatsApp :", err);
      const statusCode = err.response?.status;
      if (statusCode !== 400 && statusCode !== 503) toast.error(formatApiError(err.response?.data?.detail) || "Impossible de contacter WhatsApp.");
      setLoading(false);
    }
  }, [startWhatsAppSession]);

  const requestPairCode = async () => {
    if (pairing) return;
    const phone = pairPhone.trim();
    if (!phone) {
      setPairError("Renseignez le numéro utilisé sur WhatsApp.");
      return;
    }
    setPairing(true);
    setPairError("");
    setPairCode("");
    try {
      const { data } = await api.post("/whatsapp/session/pair-code", { phone });
      if (data?.connected) {
        await fetchStatusAndContacts();
        return;
      }
      if (!data?.code) throw new Error("Aucun code reçu.");
      setPairCode(String(data.code));
    } catch (err) {
      setPairError(formatApiError(err.response?.data?.detail || err.response?.data?.error) || "Impossible de générer le code. Réessayez dans quelques secondes.");
    } finally {
      setPairing(false);
    }
  };

  const refreshContacts = async () => {
    if (refreshLockRef.current || refreshing || refreshCooldown > 0) return;
    refreshLockRef.current = true;
    setRefreshing(true);
    try {
      const { data } = await api.post("/whatsapp/refresh");
      if (data && typeof data.refreshCooldown === "number") setRefreshCooldown(data.refreshCooldown || 60);
      else setRefreshCooldown(60);
      if (data && typeof data.count === "number") setStatus((prev) => prev ? { ...prev, contactCount: data.count, refreshCooldown: data.refreshCooldown || 60 } : prev);
      const { data: loadedContacts } = await api.get("/whatsapp/contacts");
      setContacts(Array.isArray(loadedContacts) ? loadedContacts : []);
      setContactsReady(true);
    } catch (err) {
      const statusCode = err.response?.status;
      const retryAfter = err.response?.data?.retryAfter || err.response?.data?.detail?.match?.(/(\\d+)s/)?.[1];
      if (statusCode === 429) {
        setRefreshCooldown(Number(retryAfter) || 60);
        toast.error(`Actualisation disponible dans ${retryAfter || 60}s.`);
      } else toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'actualiser les contacts.");
    } finally {
      refreshLockRef.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => {
    startWhatsAppSession();
    fetchStatusAndContacts();
  }, [fetchStatusAndContacts, startWhatsAppSession]);

  useEffect(() => {
    if (refreshCooldown <= 0) return undefined;
    const timer = setInterval(() => setRefreshCooldown((previous) => Math.max(0, previous - 1)), 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

  useEffect(() => {
    if (status?.connected || status === null) return undefined;
    const interval = setInterval(fetchStatusAndContacts, 2000);
    return () => clearInterval(interval);
  }, [fetchStatusAndContacts, status]);

  useEffect(() => {
    if (!status?.connected || contactsReady) {
      setLoadingSeconds(0);
      return undefined;
    }
    const interval = setInterval(() => setLoadingSeconds((previous) => previous + 1), 1000);
    return () => clearInterval(interval);
  }, [status?.connected, contactsReady]);

  const toggle = (id) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const importContacts = async () => {
    if (selected.size === 0) return toast.error("Sélectionnez au moins un contact.");
    setImporting(true);
    try {
      const { data } = await api.post("/whatsapp/import", { contacts: Array.from(selected) });
      if (data.quota_hit) onQuota(`${data.created} contact(s) ajouté(s). La limite du plan gratuit a été atteinte.`);
      else toast.success(`${data.created} intervenant(s) ajouté(s).`);
      onDone();
      onClose();
    } catch (err) {
      const statusCode = err.response?.status;
      const detail = formatApiError(err.response?.data?.detail) || "Erreur pendant l'import WhatsApp.";
      if (statusCode === 402) {
        onQuota(detail);
        onClose();
      } else toast.error(detail);
    } finally {
      setImporting(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => `${contact.name || ""} ${contact.number || ""}`.toLowerCase().includes(search.toLowerCase()));
  const refreshDisabled = refreshing || refreshCooldown > 0;
  const refreshLabel = refreshing ? "Actualisation..." : refreshCooldown > 0 ? `Actualiser (${refreshCooldown}s)` : "Actualiser";

  return <div className={`fixed inset-0 bg-black/40 z-50 flex justify-center ${mobile ? "items-end" : "items-center p-4"}`} onClick={onClose}>
    <div onClick={(event) => event.stopPropagation()} className={`bg-white w-full shadow-xl max-h-[92dvh] overflow-y-auto ${mobile ? "rounded-t-2xl p-5" : "max-w-3xl rounded-xl p-6"}`}>
      {mobile && <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-xl">Importer depuis WhatsApp</h3>
          <p className="text-sm text-gray-500 mt-1">{mobile ? "Connectez WhatsApp puis choisissez vos intervenants." : "Sélectionnez les contacts à ajouter à vos intervenants."}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
      </div>

      {!status?.connected && <div className="mt-6">
        {mobile ? <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
              <div>
                <h4 className="font-semibold text-gray-900">Lier avec un numéro de téléphone</h4>
                <p className="text-xs text-gray-500 mt-0.5">Pas besoin de scanner un QR code.</p>
              </div>
            </div>

            {!pairCode ? <>
              <label className="block text-sm font-medium text-gray-800 mt-5">Votre numéro WhatsApp</label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={pairPhone}
                onChange={(e) => setPairPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="mt-2 w-full h-12 rounded-xl border border-gray-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={requestPairCode}
                disabled={pairing || startingSession}
                className="mt-3 w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
              >
                {pairing ? "Génération du code…" : "Obtenir mon code"}
              </button>
            </> : <div className="mt-5">
              <div className="text-xs uppercase tracking-widest font-bold text-gray-500 text-center">Votre code de liaison</div>
              <div className="mt-2 rounded-xl border-2 border-green-200 bg-white px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.18em] text-gray-950 break-all">
                {pairCode}
              </div>
              <button type="button" onClick={() => { setPairCode(""); setPairError(""); }} className="mt-2 w-full text-sm font-medium text-blue-700">
                Utiliser un autre numéro
              </button>
            </div>}

            {pairError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pairError}</div>}
          </div>

          <div>
            <img
              src="/phone-link-guide.png"
              alt="Étapes pour connecter WhatsApp avec un numéro de téléphone"
              className="block w-full h-auto rounded-xl border border-gray-200 shadow-sm"
            />
            <p className="mt-2 px-1 text-xs leading-relaxed text-gray-500">
              Dans WhatsApp : <strong>Appareils connectés</strong> → <strong>Connecter un appareil</strong> → <strong>Connecter plutôt avec un numéro de téléphone</strong>, puis saisissez le code affiché dans ShiftFlow.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            {pairCode ? "En attente de la connexion WhatsApp…" : "Préparation de WhatsApp…"}
          </div>
        </div> : <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          {status?.hasQR && status?.qr ? <WhatsAppQrGuide qr={status.qr} /> : <>
            <RefreshCw className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <h4 className="font-semibold">Préparation de WhatsApp...</h4>
            <p className="text-sm text-gray-500 mt-2">Nous préparons votre session WhatsApp.</p>
            {status?.starting && <p className="text-xs text-gray-400 mt-3">Connexion au service en cours...</p>}
          </>}
        </div>}
      </div>}

      {status?.connected && <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-green-700 font-medium"><Check className="w-4 h-4" />WhatsApp connecté</div>
            <p className="text-sm text-gray-500 mt-1">{contacts.length} contact{contacts.length > 1 ? "s" : ""} disponibles</p>
          </div>
          <button type="button" onClick={refreshContacts} disabled={refreshDisabled} title={refreshDisabled ? `Disponible dans ${refreshCooldown}s` : "Actualiser les contacts WhatsApp"} className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />{refreshLabel}
          </button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un contact..." className="w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            {filteredContacts.length === 0 && <div className="p-8 text-center text-gray-500">{contacts.length === 0 ? "Aucun contact disponible pour le moment." : "Aucun contact trouvé."}</div>}
            {filteredContacts.map((contact) => {
              const checked = selected.has(contact.id);
              return <label key={contact.id} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${checked ? "bg-blue-50" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(contact.id)} className="w-4 h-4 accent-blue-600" />
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-600">{(contact.name || "?").slice(0, 2).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{contact.name}</div>
                  <div className="text-sm text-gray-500">+{contact.number}</div>
                </div>
              </label>;
            })}
          </div>
        </div>
        <div className={`mt-5 flex ${mobile ? "flex-col gap-3" : "items-center justify-between"}`}>
          <div className="text-sm text-gray-500">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</div>
          <div className={`flex gap-2 ${mobile ? "w-full" : ""}`}>
            <button type="button" onClick={onClose} className={`${mobile ? "flex-1" : ""} px-4 py-2.5 rounded-md border border-gray-300`}>Annuler</button>
            <button type="button" onClick={importContacts} disabled={importing || selected.size === 0} className={`${mobile ? "flex-[1.4]" : ""} px-4 py-2.5 rounded-md bg-blue-600 text-white disabled:opacity-60`}>{importing ? "Import..." : `Importer ${selected.size} contact(s)`}</button>
          </div>
        </div>
      </div>}
    </div>
  </div>;
}
function AddWorkersChoiceModal({ onClose, onPickWhatsapp, onPickPhone, onPickManual }) {
  const mobile = isMobileViewport();
  const iPhone = isIPhoneDevice();

  const options = [
    {
      key: "whatsapp",
      icon: MessageCircle,
      iconClass: "bg-green-50 text-green-600",
      title: "Depuis WhatsApp",
      badge: mobile ? "Recommandé" : null,
      desc: mobile
        ? "Connectez WhatsApp puis importez plusieurs intervenants directement depuis votre téléphone."
        : "Connectez votre WhatsApp une fois et importez vos contacts existants en quelques clics.",
      onClick: onPickWhatsapp,
    },
    ...(!mobile || !iPhone ? [{
      key: "phone",
      icon: Smartphone,
      iconClass: "bg-blue-50 text-blue-600",
      title: "Depuis le répertoire du téléphone",
      badge: "Mobile uniquement",
      desc: "Ouvrez le carnet de contacts natif de votre téléphone et cochez qui ajouter.",
      onClick: onPickPhone,
    }] : []),
    {
      key: "manual",
      icon: UserPlus,
      iconClass: "bg-gray-100 text-gray-700",
      title: "Manuellement",
      desc: "Renseignez vous-même le nom, le téléphone et les compétences d'un intervenant.",
      onClick: onPickManual,
    },
  ];

  return <div className={`fixed inset-0 bg-black/40 z-50 flex justify-center ${mobile ? "items-end" : "items-center p-4"}`} onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className={`bg-white w-full shadow-xl max-h-[92dvh] overflow-y-auto ${mobile ? "rounded-t-2xl p-5" : "max-w-md rounded-xl p-6"}`}>
      {mobile && <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-xl text-gray-900">Ajouter des intervenants</h3>
          <p className="text-sm text-gray-500 mt-1">{mobile ? "Choisissez la méthode la plus simple sur votre téléphone." : "Choisissez comment vous voulez procéder."}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
      </div>
      <div className="mt-5 space-y-3">
        {options.map((opt) => <button key={opt.key} type="button" onClick={opt.onClick} className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 active:bg-blue-50 transition-colors text-left group">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${opt.iconClass}`}><opt.icon className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
              {opt.title}
              {opt.badge && <span className={`text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${opt.key === "whatsapp" ? "text-green-700 bg-green-100" : "text-amber-700 bg-amber-100"}`}>{opt.badge}</span>}
            </div>
            <div className="text-sm text-gray-500 mt-0.5 leading-snug">{opt.desc}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 mt-1" />
        </button>)}
      </div>
      {mobile && iPhone && <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
        Sur iPhone, l'import direct depuis le répertoire n'est pas encore disponible. Utilisez WhatsApp ou l'ajout manuel.
      </div>}
    </div>
  </div>;
}
export default function Workers() { const nav = useNavigate(); const [searchParams] = useSearchParams(); const returnToParam = searchParams.get("returnTo"); const returnTo = returnToParam && returnToParam.startsWith("/app/") ? returnToParam : null; const [workers, setWorkers] = useState([]); const [loadError, setLoadError] = useState(""); const [loadingWorkers, setLoadingWorkers] = useState(true); const [q, setQ] = useState(""); const [skillFilter, setSkillFilter] = useState(""); const [editing, setEditing] = useState(null); const [creating, setCreating] = useState(false); const [phoneContactsOpen, setPhoneContactsOpen] = useState(false); const [addChoiceOpen, setAddChoiceOpen] = useState(searchParams.get("add") === "1"); const [phoneContactsUnsupported, setPhoneContactsUnsupported] = useState(false); const [upgrade, setUpgrade] = useState(null); const [whatsappOpen, setWhatsappOpen] = useState(false); const openPhoneContacts = () => { if (isContactPickerSupported()) setPhoneContactsOpen(true); else setPhoneContactsUnsupported(true); }; const load = useCallback(async () => { const params = {}; if (q) params.q = q; if (skillFilter) params.skill = skillFilter; try { const { data } = await api.get("/workers", { params }); setWorkers(data); setLoadError(""); } catch { setLoadError("Impossible de charger les intervenants."); } finally { setLoadingWorkers(false); } }, [q, skillFilter]); useEffect(() => { load(); }, [load]); const finishAdd = useCallback(async () => { await load(); if (returnTo) nav(returnTo); }, [load, nav, returnTo]); const remove = async (id) => { if (!window.confirm("Supprimer cet intervenant ?")) return; await api.delete(`/workers/${id}`); toast.success("Supprimé"); load(); }; return <div data-testid="workers-page"><Toaster position="top-right" richColors /><UpgradeModal open={!!upgrade} onClose={() => setUpgrade(null)} message={upgrade} /><div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Intervenants</div><h1 className="mt-1.5 text-[28px] leading-tight sm:text-3xl font-display font-bold tracking-tight">Votre équipe</h1></div><button onClick={() => setAddChoiceOpen(true)} data-testid="add-worker-btn" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-md font-semibold sm:font-medium"><Plus className="w-4 h-4" />Ajouter des intervenants</button></div><div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2"><Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" /><div><strong>Astuce :</strong>{" "}sur mobile, WhatsApp est la méthode la plus rapide pour importer plusieurs intervenants.</div></div><div className="mt-6 flex flex-col sm:flex-row gap-3"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Rechercher un intervenant…" className="w-full h-11 pl-10 pr-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div><select value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} className="h-11 px-3 rounded-md border border-gray-300 bg-white"><option value="">Toutes compétences</option>{SKILLS.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></div><div className="mt-5 sm:mt-6">{loadError ? <div role="alert">{loadError}<button onClick={load} className="ml-2 underline text-blue-700">Réessayer</button></div> : loadingWorkers ? <p>Chargement…</p> : workers.length === 0 ? <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-500">{q || skillFilter ? "Aucun intervenant ne correspond à ces filtres." : <><p>Ajoutez les personnes à contacter pour votre première recherche de disponibilités.</p><button type="button" onClick={() => setCreating(true)} className="mt-4 px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold">Ajouter un intervenant</button></>}</div> : <ul className="grid gap-3 sm:block sm:bg-white sm:border sm:border-gray-200 sm:rounded-xl sm:overflow-hidden sm:divide-y sm:divide-gray-100">{workers.map((worker) => <li key={worker.id} className="bg-white border border-gray-200 rounded-2xl sm:border-0 sm:rounded-none px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shadow-sm sm:shadow-none"><div className="min-w-0"><div className="font-semibold sm:font-medium text-gray-900 truncate">{worker.first_name} {worker.last_name}</div><div className="text-xs text-gray-500 mt-0.5 truncate">{worker.phone}{worker.email ? ` · ${worker.email}` : ""}</div><div className="mt-2 flex gap-1 flex-wrap">{worker.skills.map((skill) => <span key={skill} className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">{skill}</span>)}</div></div><div className="flex gap-1 shrink-0"><button onClick={() => setEditing(worker)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 border border-gray-200 sm:border-0"><Edit2 className="w-4 h-4" /></button><button onClick={() => remove(worker.id)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600 border border-gray-200 sm:border-0"><Trash2 className="w-4 h-4" /></button></div></li>)}</ul>}</div>{creating && <WorkerForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); finishAdd(); }} onQuota={(message) => setUpgrade(message)} />}{editing && <WorkerForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} onQuota={(message) => setUpgrade(message)} />}{addChoiceOpen && <AddWorkersChoiceModal onClose={() => setAddChoiceOpen(false)} onPickWhatsapp={() => { setAddChoiceOpen(false); setWhatsappOpen(true); }} onPickPhone={() => { setAddChoiceOpen(false); openPhoneContacts(); }} onPickManual={() => { setAddChoiceOpen(false); setCreating(true); }} />}{phoneContactsOpen && <PhoneContactsImportModal onClose={() => setPhoneContactsOpen(false)} onDone={finishAdd} onQuota={(message) => setUpgrade(message)} />}{phoneContactsUnsupported && <PhoneContactsUnsupportedModal onClose={() => setPhoneContactsUnsupported(false)} />}{whatsappOpen && <WhatsAppImportModal onClose={() => setWhatsappOpen(false)} onDone={finishAdd} onQuota={(message) => setUpgrade(message)} />}</div>; }
