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
    <Menu.Trigger asChild><button aria-label="Ouvrir mon compte" className={`flex items-center gap-3 rounded-xl text-left hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 ${compact ? "p-1" : "w-full p-2"}`}>
      <UserAvatar user={user} />{!compact && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.name}</span><span className="mt-0.5 block text-xs text-gray-500">{pro ? "Pro · missions illimitées" : balance}</span></span><ChevronUp size={16} /></>}
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
