import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, LockKeyhole, Smartphone } from "lucide-react";

export default function WhatsAppQrGuide({ qr }) {
  const [scannerReady, setScannerReady] = useState(false);

  return (
    <div className="mt-5" data-testid="whatsapp-qr-guide">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-950">N'utilisez pas l'appareil photo du téléphone</div>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              Un scan depuis l'appareil photo peut ouvrir WhatsApp sur un mauvais parcours de connexion et afficher
              « Vérifiez votre connexion et réessayez ». Le QR doit être scanné directement depuis le scanner
              <strong> Appareils connectés</strong> de WhatsApp.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-left">
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <div className="text-sm text-gray-700"><strong>Ouvrez WhatsApp</strong> sur votre téléphone.</div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <div className="text-sm text-gray-700">
            Allez dans <strong>Paramètres / menu ⋮ → Appareils connectés → Connecter un appareil</strong>.
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
          <div className="text-sm text-gray-700">Quand le scanner WhatsApp est ouvert, affichez le QR ci-dessous.</div>
        </div>
      </div>

      {!scannerReady ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
          <LockKeyhole className="w-7 h-7 mx-auto text-gray-400" />
          <div className="mt-2 text-sm font-medium text-gray-800">QR masqué pour éviter le mauvais scan</div>
          <p className="mt-1 text-xs text-gray-500">Ouvrez d'abord le scanner intégré à WhatsApp.</p>
          <button
            type="button"
            onClick={() => setScannerReady(true)}
            className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
            data-testid="reveal-whatsapp-qr"
          >
            <Smartphone className="w-4 h-4" />
            J'ai ouvert « Connecter un appareil »
          </button>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4" /> Scanner WhatsApp prêt
          </div>
          <div className="mt-4 flex justify-center">
            <img src={qr} alt="QR code de connexion WhatsApp" className="w-64 h-64 border rounded-lg bg-white" />
          </div>
          <p className="mt-3 text-xs font-medium text-gray-600">
            Scannez maintenant avec le scanner affiché dans WhatsApp — pas avec l'appareil photo du téléphone.
          </p>
          <p className="mt-1 text-xs text-gray-400">Le QR se met automatiquement à jour si WhatsApp le renouvelle.</p>
        </div>
      )}
    </div>
  );
}
