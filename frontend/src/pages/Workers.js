import React, { useEffect, useState } from "react";
import { Plus, Search, Trash2, Edit2, X } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast, Toaster } from "sonner";

const SKILLS = ["montage", "demontage", "technique", "electricite", "manutention"];

function WorkerForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || {
    first_name: "", last_name: "", phone: "", email: "", skills: [], note: "", active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm({ ...form, [k]: v });
  const toggleSkill = (s) => set("skills", form.skills.includes(s) ? form.skills.filter(x => x !== s) : [...form.skills, s]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
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
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  };

  const inputCls = "mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" data-testid="worker-form-modal">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl">{initial ? "Modifier l'intervenant" : "Nouvel intervenant"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Prénom *</label>
              <input required data-testid="wf-first" className={inputCls} value={form.first_name} onChange={(e)=>set("first_name", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Nom *</label>
              <input required data-testid="wf-last" className={inputCls} value={form.last_name} onChange={(e)=>set("last_name", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Téléphone *</label>
            <input required data-testid="wf-phone" className={inputCls} value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="06 XX XX XX XX"/>
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input type="email" data-testid="wf-email" className={inputCls} value={form.email} onChange={(e)=>set("email", e.target.value)} />
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
            <textarea rows={2} data-testid="wf-note" className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={form.note} onChange={(e)=>set("note", e.target.value)}/>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-testid="wf-active" checked={form.active} onChange={(e)=>set("active", e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            Actif
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
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

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [q, setQ] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

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
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Intervenants</div>
          <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Votre équipe</h1>
        </div>
        <button onClick={()=>setCreating(true)} data-testid="add-worker-btn" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md font-medium">
          <Plus className="w-4 h-4"/> Ajouter
        </button>
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

      {creating && <WorkerForm onClose={()=>setCreating(false)} onSaved={()=>{setCreating(false); load();}}/>}
      {editing && <WorkerForm initial={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); load();}}/>}
    </div>
  );
}
