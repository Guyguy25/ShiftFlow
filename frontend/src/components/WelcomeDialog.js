import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2,
  MapPin, MessageCircle, Users, X, Zap
} from "lucide-react";

function MissionVisual() {
  return <div className="rounded-[22px] bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-4 text-white shadow-lg shadow-blue-100">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">Mission</span>
      <span className="text-xs font-semibold text-blue-100">Brouillon</span>
    </div>
    <div className="mt-4 rounded-2xl bg-white p-4 text-gray-950 shadow-sm">
      <p className="text-base font-bold">Montage festival</p>
      <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
        <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-600" /> Sam. 10 octobre · 08:00</span>
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-600" /> Lille</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2">
        <span className="text-xs font-medium text-blue-900">Équipe nécessaire</span>
        <span className="text-sm font-bold text-blue-700">3 personnes</span>
      </div>
    </div>
  </div>;
}

function TeamVisual() {
  const people = [
    ["LM", "Lucas Martin", "Régisseur"],
    ["SC", "Sarah Colin", "Technicienne son"],
    ["MB", "Mehdi Benali", "Montage"],
  ];
  return <div className="rounded-[22px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white"><Users className="h-4 w-4" /></span><span className="text-sm font-bold">Votre équipe</span></div>
      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><MessageCircle className="h-3 w-3" /> WhatsApp</span>
    </div>
    <div className="space-y-2">
      {people.map(([initials, name, role], index) => <div key={name} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{initials}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{name}</span><span className="block truncate text-[11px] text-gray-500">{role}</span></span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">{index + 1}</span>
      </div>)}
    </div>
  </div>;
}

function CascadeVisual() {
  const rows = [
    { name: "Lucas Martin", status: "Accepte", done: true },
    { name: "Sarah Colin", status: "Message envoyé", active: true },
    { name: "Mehdi Benali", status: "En attente" },
  ];
  return <div className="rounded-[22px] border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Cascade automatique</p><p className="mt-0.5 text-sm font-bold text-gray-950">ShiftFlow avance pour vous</p></div>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Zap className="h-4 w-4" /></span>
    </div>
    <div className="mt-4 space-y-2">
      {rows.map((row, index) => <div key={row.name} className={`flex items-center gap-3 rounded-xl border p-3 ${row.done ? "border-emerald-200 bg-emerald-50" : row.active ? "border-blue-200 bg-white shadow-sm" : "border-gray-100 bg-white/70"}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${row.done ? "bg-emerald-600 text-white" : row.active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>{row.done ? <Check className="h-4 w-4" /> : index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{row.name}</span>
        <span className={`text-[10px] font-bold ${row.done ? "text-emerald-700" : row.active ? "text-blue-700" : "text-gray-400"}`}>{row.status}</span>
      </div>)}
    </div>
    <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs">
      <span className="font-medium text-gray-600">Équipe confirmée</span>
      <span className="flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> 1/3</span>
    </div>
  </div>;
}

const slides = [
  {
    eyebrow: "1 · Préparez",
    title: "Créez votre mission",
    text: "Indiquez où, quand et combien de personnes il vous faut. Rien n’est envoyé tant que vous n’avez pas confirmé.",
    visual: <MissionVisual />,
  },
  {
    eyebrow: "2 · Choisissez",
    title: "Ajoutez votre équipe",
    text: "Importez vos contacts depuis WhatsApp ou ajoutez-les manuellement, puis choisissez qui contacter en priorité.",
    visual: <TeamVisual />,
  },
  {
    eyebrow: "3 · Lancez",
    title: "ShiftFlow suit les réponses",
    text: "Vous lancez l’envoi. ShiftFlow contacte votre équipe dans l’ordre et vous montre immédiatement qui accepte, refuse ou ne répond pas.",
    visual: <CascadeVisual />,
  },
];

export default function WelcomeDialog({ user }) {
  const key = `shiftflow-welcome-${user.id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === "pending"; } catch { return false; } });
  const [step, setStep] = useState(0);
  const close = () => { try { localStorage.removeItem(key); } catch {} setOpen(false); };
  const startTour = () => {
    close();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("shiftflow:replay-guide", { detail: { mode: "sections" } })), 80);
  };
  const slide = slides[step];
  const firstName = (user?.name || "").trim().split(/\s+/)[0];

  return <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[70] bg-gray-950/40 backdrop-blur-sm" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[calc(100dvh-24px)] w-[calc(100%_-_24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl focus:outline-none sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><Zap className="h-4 w-4" /></span>
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-gray-950">Bienvenue{firstName ? ` ${firstName}` : ""} 👋</Dialog.Title>
              <Dialog.Description className="text-xs text-gray-500">Voici comment ShiftFlow vous aide à être au complet.</Dialog.Description>
            </div>
          </div>
        </div>
        <Dialog.Close aria-label="Fermer le message de bienvenue" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"><X size={19} /></Dialog.Close>
      </div>

      <div key={step} className="mt-5 motion-safe:animate-[guide-arrive_.28s_ease-out]">
        {slide.visual}
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{slide.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">{slide.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{slide.text}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5" aria-label={`Étape ${step + 1} sur ${slides.length}`}>
        {slides.map((_, index) => <button key={index} type="button" onClick={() => setStep(index)} aria-label={`Afficher l’étape ${index + 1}`} className={`h-2 rounded-full transition-all ${index === step ? "w-7 bg-blue-600" : "w-2 bg-gray-200 hover:bg-gray-300"}`} />)}
      </div>

      <div className="mt-5 flex gap-2">
        {step > 0 && <button type="button" onClick={() => setStep(value => value - 1)} className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50" aria-label="Étape précédente"><ArrowLeft size={18} /></button>}
        {step < slides.length - 1
          ? <button type="button" onClick={() => setStep(value => value + 1)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">Suivant <ArrowRight size={18} /></button>
          : <button type="button" onClick={startTour} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">Découvrir ShiftFlow <ArrowRight size={18} /></button>}
      </div>

      {step < slides.length - 1 && <button type="button" onClick={startTour} className="mt-2 min-h-10 w-full text-sm font-medium text-gray-500 hover:text-blue-700">Passer la présentation et découvrir l’interface</button>}

      <p className="mt-3 text-center text-[11px] font-medium text-gray-400">3 missions offertes · sans carte bancaire · aucun message sans votre confirmation</p>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
