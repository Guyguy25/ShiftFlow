import React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Link } from "react-router-dom";
import { ChevronUp, Crown, UserRound, Settings, LifeBuoy, LogOut } from "lucide-react";
import { counted } from "../lib/french";

export function UserAvatar({ user, className = "h-10 w-10" }) {
  return user?.avatar ? <img src={user.avatar} alt="" className={`${className} shrink-0 rounded-full object-cover`} /> : <span className={`${className} inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700`} aria-hidden="true">{(user?.name || "S").trim().split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase()}</span>;
}

export default function ProfileMenu({ user, quota, onLogout, compact = false }) {
  const pro = user?.plan === "pro";
  const balance = quota ? counted((quota.free_missions_remaining || 0) + (quota.mission_credits || 0), "mission disponible", "missions disponibles") : "Mon compte";
  const item = "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-gray-700 outline-none focus:bg-blue-50 focus:text-blue-700";
  return <Menu.Root>
    <Menu.Trigger asChild><button aria-label="Ouvrir mon compte" className={`group flex items-center gap-3 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 ${compact ? "border-blue-100 bg-blue-50 p-1.5 shadow-sm" : "w-full border-gray-200 bg-gray-50 p-2.5 hover:border-blue-200 hover:bg-blue-50"}`}>
      <UserAvatar user={user} className={compact ? "h-9 w-9 ring-2 ring-white shadow-sm" : "h-10 w-10 ring-2 ring-white shadow-sm"} />{compact ? <span className="relative -ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white" aria-hidden="true">⌄</span> : <><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="block truncate text-sm font-bold text-gray-950">{user?.name}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 shadow-sm">Compte</span></span><span className="mt-0.5 block truncate text-xs text-gray-600">{pro ? "Pro · missions illimitées" : balance}</span><span className="mt-1 block text-[11px] font-semibold text-blue-700">Voir mon profil et mes réglages</span></span><ChevronUp size={16} className="text-gray-500 transition-transform group-data-[state=open]:rotate-180" /></>}
    </button></Menu.Trigger>
    <Menu.Portal><Menu.Content side={compact ? "bottom" : "top"} align={compact ? "end" : "start"} sideOffset={8} className="z-[60] w-72 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
      <Menu.Label className="px-3 py-2"><span className="block truncate font-semibold">{user?.agency_name || user?.name}</span><span className="block truncate text-xs font-normal text-gray-500">{user?.email}</span></Menu.Label>
      <div className="mx-1 mb-2 rounded-xl bg-blue-50 p-3" data-testid="mission-balance-card"><p className="text-sm font-semibold text-blue-950">{pro ? "Pro · missions illimitées" : balance}</p>{!pro && quota && <><p className="mt-1 text-xs text-blue-800">{counted(quota.free_missions_remaining, "offerte")} · {counted(quota.mission_credits, "achetée")}</p><p className="mt-1 text-xs text-gray-600">Vos crédits sont valables à vie.</p></>}</div>
      {[["/app/profile", "Mon profil", UserRound], ["/pricing", pro ? "Mon offre Pro" : "Acheter des missions / Pro", Crown], ["/app/settings", "Paramètres et abonnement", Settings], ["/app/help", "Aide et tutoriels", LifeBuoy]].map(([to, label, Icon]) => <Menu.Item asChild key={to}><Link to={to} className={item}><Icon size={17} />{label}</Link></Menu.Item>)}
      <Menu.Separator className="my-2 h-px bg-gray-100" />
      <Menu.Item onSelect={onLogout} className={`${item} cursor-pointer text-red-600`}><LogOut size={17} />Se déconnecter</Menu.Item>
      <div className="flex gap-3 px-3 py-2 text-[11px] text-gray-500"><Link to="/conditions">Conditions</Link><Link to="/confidentialite">Confidentialité</Link><Link to="/mentions-legales">Mentions légales</Link></div>
    </Menu.Content></Menu.Portal>
  </Menu.Root>;
}
