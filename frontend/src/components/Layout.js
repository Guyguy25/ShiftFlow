import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarClock, Calendar as CalendarIcon, Users, History, Settings, Crown, LogOut, MoreHorizontal, X, Zap, LifeBuoy, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GettingStarted from "./GettingStarted";
import { api } from "../lib/api";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
  { to: "/app/missions", label: "Missions", icon: CalendarClock, id: "nav-missions" },
  { to: "/app/calendar", label: "Calendrier", icon: CalendarIcon, id: "nav-calendar" },
  { to: "/app/workers", label: "Intervenants", icon: Users, id: "nav-workers" },
  { to: "/app/history", label: "Historique", icon: History, id: "nav-history" },
  { to: "/app/help", label: "Aide", icon: LifeBuoy, id: "nav-help" },
  { to: "/app/settings", label: "Paramètres", icon: Settings, id: "nav-settings" },
];

const mobileNav = [
  { to: "/app/dashboard", label: "Accueil", icon: LayoutDashboard, id: "mobile-nav-dashboard" },
  { to: "/app/missions", label: "Missions", icon: CalendarClock, id: "mobile-nav-missions" },
  { to: "/app/missions/new", label: "Créer", icon: Plus, id: "mobile-nav-create", primary: true },
  { to: "/app/workers", label: "Équipe", icon: Users, id: "mobile-nav-workers" },
];

const mobileMoreNav = [
  { to: "/app/calendar", label: "Calendrier", icon: CalendarIcon },
  { to: "/app/history", label: "Historique", icon: History },
  { to: "/app/help", label: "Aide", icon: LifeBuoy },
  { to: "/app/settings", label: "Paramètres", icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!user || user.plan === "pro") {
      setQuota(null);
      return;
    }
    let cancelled = false;
    api.get("/plan/quota", { params: { _ts: Date.now() } })
      .then(({ data }) => { if (!cancelled) setQuota(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, location.search, user]);

  const focusedMission = /^\/app\/missions\/[^/]+$/.test(location.pathname);
  const remaining = (quota?.free_missions_remaining || 0) + (quota?.mission_credits || 0);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-white border-r border-gray-200">
        <div className="px-6 py-6 flex items-center gap-2 border-b border-gray-200 shrink-0">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">ShiftFlow</span>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.id}
              className={({ isActive }) => {
                if (n.highlight) {
                  return `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors border ${
                    isActive
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`;
                }
                return `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`;
              }}
            >
              <n.icon className="w-4 h-4" aria-hidden="true" />
              {n.label}
              {n.highlight && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded">Guide</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-4 shrink-0 bg-white">
          {user?.plan !== "pro" && quota && (
            <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 p-3" data-testid="mission-balance-card">
              <p className="text-sm font-semibold text-blue-950">{remaining} mission(s) disponible(s)</p>
              <p className="mt-1 text-xs text-blue-800">{quota.free_missions_remaining} offerte(s) · {quota.mission_credits} achetée(s)</p>
              <p className="mt-2 text-xs text-gray-600">Sans expiration. Vos missions existantes restent utilisables.</p>
            </div>
          )}
          {user?.plan !== "pro" && (
            <NavLink to="/pricing" data-testid="nav-upgrade-cta"
              className="mb-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-700 text-white text-sm font-semibold transition-all shadow-sm">
              <Crown className="w-4 h-4" /> Voir les offres
            </NavLink>
          )}
          <div className="text-xs text-gray-500">Connecté en tant que</div>
          <div className="text-sm font-medium text-gray-900 truncate" data-testid="current-user-name">{user?.name}</div>
          <div className="text-xs text-gray-500 truncate mb-3" data-testid="current-user-agency">{user?.agency_name}</div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Déconnexion
          </button>
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
            <Link to="/conditions" className="hover:text-gray-700">Conditions</Link>
            <Link to="/confidentialite" className="hover:text-gray-700">Confidentialité</Link>
            <Link to="/mentions-legales" className="hover:text-gray-700">Mentions légales</Link>
          </div>
        </div>
      </aside>

      {/* Mobile top bar: identity only; navigation stays within thumb reach below. */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 h-14">
        <div className="h-full max-w-xl mx-auto px-4 flex items-center">
          <Link to="/app/dashboard" className="flex items-center gap-2.5 min-w-0" onClick={() => setOpen(false)}>
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-display font-bold text-[17px] tracking-tight">ShiftFlow</span>
          </Link>
        </div>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)}>
          <nav aria-label="Navigation secondaire" className="absolute inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] rounded-2xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <span className="font-semibold text-gray-900">Plus</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {mobileMoreNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              data-testid="mobile-logout-btn"
              className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl border-t border-gray-100 px-3 py-2.5 text-sm font-medium text-red-600"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </nav>
        </div>
      )}

      <nav aria-label="Navigation principale" className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-1">
          {mobileNav.map((n) => (
            <NavLink key={n.to} to={n.to} data-testid={n.id} className={({ isActive }) => `relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${isActive ? "text-blue-700" : "text-gray-500"}`}>
              <span className={n.primary ? "-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200" : "flex h-7 items-center justify-center"}>
                <n.icon className={n.primary ? "h-6 w-6" : "h-5 w-5"} />
              </span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <button type="button" onClick={() => setOpen((value) => !value)} data-testid="mobile-nav-more" aria-expanded={open} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${mobileMoreNav.some((item) => location.pathname.startsWith(item.to)) || open ? "text-blue-700" : "text-gray-500"}`}>
            <span className="flex h-7 items-center justify-center"><MoreHorizontal className="h-5 w-5" /></span>
            <span>Plus</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 pt-14 pb-20 lg:pb-0 lg:pt-0 lg:ml-64">
        {user?.plan !== "pro" && quota && !focusedMission && (
          <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 sm:px-6 lg:px-10 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-950">{remaining > 0 ? <><strong>{remaining} mission(s) disponible(s)</strong> · sans expiration</> : <>Vos missions restent accessibles. <strong>La prochaine à 4,90 € ou Pro à 49 €/mois.</strong></>}</p>
            <Link to="/pricing" className="shrink-0 text-sm font-semibold text-blue-700 underline">Les offres</Link>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-8">
          <GettingStarted>{children}</GettingStarted>
        </div>
      </main>
    </div>
  );
}


