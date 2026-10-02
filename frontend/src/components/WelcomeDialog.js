import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X, Zap } from "lucide-react";

export default function WelcomeDialog({ user }) {
  const key = `shiftflow-welcome-${user.id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === "pending"; } catch { return false; } });
  const navigate = useNavigate();
  const close = () => { try { localStorage.removeItem(key); } catch {} setOpen(false); };
  const startTour = () => {
    close();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("shiftflow:replay-guide", { detail: { mode: "sections" } })), 80);
  };
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[70] bg-gray-950/35 backdrop-blur-sm" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%_-_32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-2xl focus:outline-none">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white"><Zap /></div>
      <Dialog.Title className="text-2xl font-bold tracking-tight">Bienvenue sur ShiftFlow !</Dialog.Title>
      <Dialog.Description className="mt-3 text-base leading-relaxed text-gray-600">Préparez votre première mission, choisissez votre équipe. On vous guide pour la suite.</Dialog.Description>
      <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">3 missions offertes, valables à vie. Aucun message envoyé sans votre confirmation de lancement.</p>
      <button onClick={startTour} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700">Commencer la visite <ArrowRight size={18} /></button>
      <button onClick={() => { close(); navigate("/app/missions/new"); }} className="mt-2 min-h-11 w-full text-sm font-medium text-gray-600 hover:text-gray-900">Créer directement ma première mission</button>
      <Dialog.Close aria-label="Fermer le message de bienvenue" className="absolute right-3 top-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
