import React from "react";
import { Link } from "react-router-dom";
import { LEGAL_LINKS } from "../constants/legal";

export default function LegalFooter({ compact = false, className = "" }) {
  return (
    <div className={`${compact ? "text-xs" : "text-sm"} text-gray-500 ${className}`} data-testid="legal-footer-links">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LEGAL_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="hover:text-gray-900 transition-colors">
            {item.label}
          </Link>
        ))}
        <a href="mailto:contact@shiftflow.io" className="hover:text-gray-900 transition-colors">Contact</a>
      </div>
    </div>
  );
}
