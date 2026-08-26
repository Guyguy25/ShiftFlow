import React, { useEffect, useState } from "react";
import { Plus, Search, Trash2, Edit2, X, Upload, Info, MessageCircle, Smartphone, Check, RefreshCw, } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast, Toaster } from "sonner";
import UpgradeModal from "../components/UpgradeModal";

const SKILLS = ["montage", "demontage", "technique", "electricite", "manutention"];

// ---------- Validation helpers ----------
const NAME_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'\-]{1,39}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function isPhoneValid(raw) {
  const digits = (raw || "").replace(/[\s.\-()]/g, "");
  if (!digits) return false;
  if (digits.startsWith("+33")) return /^\+33[1-9]\d{8}$/.test(digits);
  if (digits.startsWith("0")) return /^0[1-9]\d{8}$/.test(digits);
  if (digits.startsWith("+")) return /^\+\d{10,15}$/.test(digits);
  return false;
}

function validateWorker(f) {
  const errs = {};
  if (!NAME_RE.test((f.first_name || "").trim()))
    errs.first_name = "Prénom : 2 à 40 lettres (accents, tirets, apostrophes OK).";
  if (!NAME_RE.test((f.last_name || "").trim()))
    errs.last_name = "Nom : 2 à 40 lettres.";
  if (!isPhoneValid(f.phone))
    errs.phone = "Téléphone invalide (ex : +33612345678 ou 0612345678).";
  if (f.email && !EMAIL_RE.test(f.email.trim()))
    errs.email = "Email invalide.";
  return errs;
}

function WorkerForm({ initial, onClose, onSaved, onQuota }) {
  const [form, setForm] = useState(initial || {
    first_name: "", last_name: "", phone: "", email: "", skills: [], note: "", active: true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const set = (k, v) => setForm({ ...form, [k]: v });
  const toggleSkill = (s) => set("skills", form.skills.includes(s) ? form.skills.filter(x => x !== s) : [...form.skills, s]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateWorker(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true); setServerError("");
    try {
      if (initial?.id) {
        await api.put(`/workers/${initial.id}`, form);
        toast.success("Intervenant modifié");
      } else {
        await api.post("/workers", form);
        toast.success("Intervenant ajouté");
      }
      onSaved();
    } catch (err) {
      const status = err.response?.status;
      const detail = formatApiError(err.response?.data?.detail) || err.message;
      if (status === 402) { onQuota(detail); onClose(); }
      else setServerError(detail);
    } finally { setSaving(false); }
  };

  const inputCls = (err) => `mt-1 w-full h-11 px-3 rounded-md border ${err ? "border-red-400 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"} focus:outline-none focus:ring-2 bg-white`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" data-testid="worker-form-modal">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl">{initial ? "Modifier l'intervenant" : "Nouvel intervenant"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Prénom *</label>
              <input required data-testid="wf-first" className={inputCls(errors.first_name)} value={form.first_name} onChange={(e)=>set("first_name", e.target.value)}/>
              {errors.first_name && <div className="text-xs text-red-600 mt-1" data-testid="wf-err-first">{errors.first_name}</div>}
            </div>
            <div>
              <label className="text-sm font-medium">Nom *</label>
              <input required data-testid="wf-last" className={inputCls(errors.last_name)} value={form.last_name} onChange={(e)=>set("last_name", e.target.value)}/>
              {errors.last_name && <div className="text-xs text-red-600 mt-1" data-testid="wf-err-last">{errors.last_name}</div>}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Téléphone *</label>
            <input required data-testid="wf-phone" className={inputCls(errors.phone)} value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="+33612345678 ou 0612345678"/>
            {errors.phone && <div className="text-xs text-red-600 mt-1" data-testid="wf-err-phone">{errors.phone}</div>}
          </div>
          <div>
            <label className="text-sm font-medium">Email <span className="text-gray-400 text-xs">(facultatif)</span></label>
            <input type="text" inputMode="email" data-testid="wf-email" className={inputCls(errors.email)} value={form.email} onChange={(e)=>set("email", e.target.value)}/>
            {errors.email && <div className="text-xs text-red-600 mt-1" data-testid="wf-err-email">{errors.email}</div>}
          </div>
          <div>
            <label className="text-sm font-medium">Compétences</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SKILLS.map(s => (
                <button key={s} type="button" onClick={()=>toggleSkill(s)} data-testid={`wf-skill-${s}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.skills.includes(s) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Note interne</label>
            <textarea rows={2} data-testid="wf-note" maxLength={500} className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={form.note} onChange={(e)=>set("note", e.target.value)}/>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-testid="wf-active" checked={form.active} onChange={(e)=>set("active", e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            Actif
          </label>
          {serverError && <div className="text-sm text-red-600" data-testid="wf-error">{serverError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300">Annuler</button>
            <button type="submit" disabled={saving} data-testid="wf-submit" className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkImportModal({ onClose, onDone, onQuota }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const parse = (t) => {
    const rows = [];
    for (const raw of t.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[,;\t]/).map(x => x.trim()).filter(Boolean);
      if (parts.length < 3) continue;
      const [first_name, last_name, phone, email = ""] = parts;
      const errs = validateWorker({ first_name, last_name, phone, email });
      rows.push({ first_name, last_name, phone, email, valid: Object.keys(errs).length === 0, errors: errs });
    }
    return rows;
  };

  const onText = (v) => { setText(v); setPreview(parse(v)); };

  const submit = async () => {
    const valid = preview.filter(r => r.valid).map(({ first_name, last_name, phone, email }) => ({ first_name, last_name, phone, email, skills: [], note: "", active: true }));
    if (valid.length === 0) { toast.error("Aucune ligne valide à importer."); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/workers/bulk", { workers: valid });
      if (data.quota_hit) {
        onQuota(`${data.created} ajoutés, ${data.skipped_quota} ignorés (limite plan gratuit à ${data.limit} intervenants).`);
      } else {
        toast.success(`${data.created} intervenant${data.created > 1 ? "s" : ""} ajouté${data.created > 1 ? "s" : ""}`);
      }
      onDone();
    } catch (err) {
      const status = err.response?.status;
      const detail = formatApiError(err.response?.data?.detail) || "Erreur d'import";
      if (status === 402) { onQuota(detail); onClose(); }
      else toast.error(detail);
    } finally { setSubmitting(false); }
  };

  const validCount = preview.filter(r => r.valid).length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="bg-white rounded-xl w-full max-w-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" data-testid="bulk-import-modal">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl">Import rapide d'intervenants</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5"/></button>
        </div>

        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900" data-testid="bulk-whatsapp-hint">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 mt-0.5 shrink-0"/>
            <div>
              <div className="font-semibold">Astuce WhatsApp — 2 clics</div>
              <div>Sur WhatsApp Web ou votre téléphone, ouvrez un contact, tapez sur son nom pour voir la fiche puis <em>Partager le contact</em>. Vous pouvez aussi copier plusieurs contacts depuis Google Contacts / iCloud et les coller ici. Format : <code className="bg-white px-1 rounded">Prénom, Nom, Téléphone[, Email]</code></div>
            </div>
          </div>
        </div>

        <textarea rows={8} value={text} onChange={(e)=>onText(e.target.value)} data-testid="bulk-textarea"
          placeholder={"Thomas, Dupont, +33612345678, thomas@mail.com\nLucas, Martin, 0623456789\nKevin, Bernard, 0634567890"}
          className="mt-4 w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono text-sm"/>

        {preview.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden" data-testid="bulk-preview">
            <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600 uppercase tracking-widest font-semibold flex justify-between">
              <span>Aperçu {preview.length} ligne{preview.length > 1 ? "s" : ""}</span>
              <span className="text-green-700">{validCount} valide{validCount > 1 ? "s" : ""}</span>
            </div>
            <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 text-sm">
              {preview.map((r, i) => (
                <li key={i} className={`px-3 py-2 flex items-center justify-between ${r.valid ? "" : "bg-red-50"}`}>
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{r.first_name} {r.last_name}</span>
                    <span className="text-gray-500 ml-2">{r.phone}</span>
                    {r.email && <span className="text-gray-400 ml-2">{r.email}</span>}
                  </div>
                  {r.valid ? (
                    <span className="text-xs text-green-700 font-semibold shrink-0">OK</span>
                  ) : (
                    <span className="text-xs text-red-600 truncate ml-2" title={Object.values(r.errors).join(" ")}>{Object.values(r.errors)[0]}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300">Annuler</button>
          <button onClick={submit} disabled={submitting || validCount === 0} data-testid="bulk-submit-btn"
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60 inline-flex items-center gap-2">
            <Upload className="w-4 h-4"/>{submitting ? "Import…" : `Importer ${validCount} intervenant${validCount > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppImportModal({ onClose, onDone, onQuota }) {
  const [status, setStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [contactsReady, setContactsReady] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/whatsapp/status");

      setStatus(data);

      // WhatsApp n'est pas encore connecté
      if (!data.connected) {
        setContactsReady(false);
        return;
      }

      // WhatsApp connecté : on récupère les contacts
      const contactsResponse =
        await api.get("/whatsapp/contacts");

      const loadedContacts = contactsResponse.data || [];

      // Tant qu'il n'y a aucun contact, on considère que
      // WhatsApp est encore en train de synchroniser.
      if (loadedContacts.length > 0) {
        setContacts(loadedContacts);
        setContactsReady(true);
        setLoading(false);
      } else {
        setContactsReady(false);
      }

    } catch (err) {
      // Ne pas faire disparaître l'écran de chargement
      // pendant que WhatsApp synchronise.
      if (err.response?.status !== 400) {
        toast.error(
          formatApiError(err.response?.data?.detail) ||
          "Impossible de contacter WhatsApp."
        );
      }
    }
  };

  useEffect(() => {
    loadStatus();

    const interval = setInterval(() => {
      loadStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Timer précis pendant la récupération des contacts
  useEffect(() => {
    if (!status?.connected || contactsReady) {
      setLoadingSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingSeconds((previous) => previous + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.connected, contactsReady]);

  const toggle = (id) => {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const importContacts = async () => {
    if (selected.size === 0) {
      toast.error(
        "Sélectionnez au moins un contact."
      );
      return;
    }

    setImporting(true);

    try {
      const { data } = await api.post(
        "/whatsapp/import",
        {
          contacts: Array.from(selected),
        }
      );

      if (data.quota_hit) {
        onQuota(
          `${data.created} contact(s) ajouté(s). La limite du plan gratuit a été atteinte.`
        );
      } else {
        toast.success(
          `${data.created} intervenant(s) ajouté(s).`
        );
      }

      onDone();
      onClose();

    } catch (err) {
      const statusCode =
        err.response?.status;

      const detail =
        formatApiError(
          err.response?.data?.detail
        ) ||
        "Erreur pendant l'import WhatsApp.";

      if (statusCode === 402) {
        onQuota(detail);
        onClose();
      } else {
        toast.error(detail);
      }
    } finally {
      setImporting(false);
    }
  };

  const filteredContacts =
    contacts.filter((contact) => {
      const value =
        `${contact.name} ${contact.number}`
          .toLowerCase();

      return value.includes(
        search.toLowerCase()
      );
    });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-xl">
              Importer depuis WhatsApp
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Sélectionnez les contacts à ajouter à vos intervenants.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONNEXION */}
        {!status?.connected && (
          <div className="mt-6">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
              {status?.hasQR && status?.qr ? (
                <>
                  <Smartphone className="w-8 h-8 mx-auto mb-3 text-gray-700" />

                  <h4 className="font-semibold text-lg">
                    Connectez votre WhatsApp
                  </h4>

                  <p className="text-sm text-gray-500 mt-2">
                    WhatsApp → Paramètres → Appareils connectés → Connecter un appareil
                  </p>

                  <div className="mt-5 flex justify-center">
                    <img
                      src={status.qr}
                      alt="QR code WhatsApp"
                      className="w-64 h-64 border rounded-lg"
                    />
                  </div>

                  <p className="text-xs text-gray-400 mt-4">
                    Le QR code se met automatiquement à jour.
                  </p>
                </>
              ) : (
                <>
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />

                  <h4 className="font-semibold">
                    Connexion à WhatsApp...
                  </h4>

                  <p className="text-sm text-gray-500 mt-2">
                    Préparation du QR code.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* RÉCUPÉRATION DES CONTACTS */}
        {status?.connected && !contactsReady && (
          <div className="mt-6">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">

              <RefreshCw className="w-10 h-10 mx-auto mb-4 text-blue-600 animate-spin" />

              <h4 className="font-semibold text-lg">
                WhatsApp récupère vos contacts...
              </h4>

              <p className="text-sm text-gray-500 mt-2">
                Synchronisation de vos contacts WhatsApp en cours.
              </p>

              <div className="mt-4 text-sm font-medium text-gray-700">
                Temps écoulé : {loadingSeconds}s
              </div>

              <div className="mt-4 text-xs text-gray-400">
                Ne fermez pas cette fenêtre.
              </div>

            </div>
          </div>
        )}

        {/* CONTACTS */}
        {status?.connected && contactsReady && (
          <div className="mt-6">

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <Check className="w-4 h-4" />
                  WhatsApp connecté
                </div>

                <p className="text-sm text-gray-500 mt-1">
                  {contacts.length} contacts disponibles
                </p>
              </div>

              <button
                type="button"
                onClick={loadStatus}
                className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Rechercher un contact..."
              className="w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">

                {filteredContacts.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    Aucun contact trouvé.
                  </div>
                )}

                {filteredContacts.map((contact) => {
                  const checked =
                    selected.has(contact.id);

                  return (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        checked
                          ? "bg-blue-50"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggle(contact.id)
                        }
                        className="w-4 h-4 accent-blue-600"
                      />

                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-600">
                        {(contact.name || "?")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {contact.name}
                        </div>

                        <div className="text-sm text-gray-500">
                          +{contact.number}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selected.size} sélectionné(s)
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-md border border-gray-300"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={importContacts}
                  disabled={
                    importing ||
                    selected.size === 0
                  }
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {importing
                    ? "Import..."
                    : `Importer ${selected.size} contact(s)`}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [q, setQ] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [upgrade, setUpgrade] = useState(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (skillFilter) params.skill = skillFilter;
    const { data } = await api.get("/workers", { params });
    setWorkers(data);
  };

  useEffect(() => { load(); }, [q, skillFilter]);

  const remove = async (id) => {
    if (!window.confirm("Supprimer cet intervenant ?")) return;
    await api.delete(`/workers/${id}`);
    toast.success("Supprimé");
    load();
  };

  return (
    <div data-testid="workers-page">
      <Toaster position="top-right" richColors />
      <UpgradeModal open={!!upgrade} onClose={()=>setUpgrade(null)} message={upgrade}/>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Intervenants</div>
          <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Votre équipe</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setBulkOpen(true)} data-testid="bulk-import-btn"
            className="hidden sm:inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 px-4 py-2.5 rounded-md font-medium">
            <Upload className="w-4 h-4"/> Import rapide
          </button>
          <button
            type="button"
            onClick={() => setWhatsappOpen(true)}
            className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2"
            data-testid="whatsapp-import-button"
          >
            <MessageCircle className="w-4 h-4" />
            Importer depuis WhatsApp
          </button>
          <button onClick={()=>setCreating(true)} data-testid="add-worker-btn"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md font-medium">
            <Plus className="w-4 h-4"/> Ajouter
          </button>
        </div>
      </div>

      <div className="mt-4 sm:hidden">
        <button onClick={()=>setBulkOpen(true)} data-testid="bulk-import-btn-mobile"
          className="w-full inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 px-4 py-2.5 rounded-md font-medium">
          <Upload className="w-4 h-4"/> Import rapide
        </button>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2" data-testid="workers-hint">
        <Info className="w-4 h-4 mt-0.5 shrink-0"/>
        <div>
          <strong>Astuce :</strong> pour ajouter 20+ intervenants d'un coup, utilisez <strong>Import rapide</strong> et collez directement une liste depuis WhatsApp, Google Contacts ou un tableur.
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input data-testid="workers-search" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Rechercher un intervenant…"
            className="w-full h-11 pl-10 pr-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
        </div>
        <select data-testid="workers-skill-filter" value={skillFilter} onChange={(e)=>setSkillFilter(e.target.value)}
          className="h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Toutes compétences</option>
          {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {workers.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Aucun intervenant.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {workers.map((w) => (
              <li key={w.id} data-testid={`worker-row-${w.id}`} className="px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">{w.first_name} {w.last_name}</div>
                  <div className="text-xs text-gray-500">{w.phone}{w.email ? " · " + w.email : ""}</div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {w.skills.map((s) => <span key={s} className="text-[10px] uppercase tracking-widest bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>)}
                    {!w.active && <span className="text-[10px] uppercase tracking-widest bg-red-50 text-red-700 px-1.5 py-0.5 rounded">Inactif</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>setEditing(w)} data-testid={`edit-worker-${w.id}`} className="p-2 rounded hover:bg-gray-100 text-gray-600"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={()=>remove(w.id)} data-testid={`delete-worker-${w.id}`} className="p-2 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4"/></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && <WorkerForm onClose={()=>setCreating(false)} onSaved={()=>{setCreating(false); load();}} onQuota={(m)=>setUpgrade(m)}/>}
      {editing && <WorkerForm initial={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); load();}} onQuota={(m)=>setUpgrade(m)}/>}
      {bulkOpen && <BulkImportModal onClose={()=>setBulkOpen(false)} onDone={()=>{setBulkOpen(false); load();}} onQuota={(m)=>setUpgrade(m)}/>}
      {whatsappOpen && (
        <WhatsAppImportModal
          onClose={() => setWhatsappOpen(false)}
          onDone={load}
          onQuota={(message) => setUpgrade(message)}
        />
      )}
    </div>
  );
}