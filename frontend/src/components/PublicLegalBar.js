import React from "react";
import LegalFooter from "./LegalFooter";

export default function PublicLegalBar() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-6" data-testid="public-legal-bar">
      <LegalFooter compact />
      <div className="mt-3 text-center text-[11px] text-slate-400">© 2026 ShiftFlow · Service destiné aux professionnels</div>
    </footer>
  );
}
