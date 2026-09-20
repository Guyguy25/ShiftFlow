import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarClock, Calendar as CalendarIcon, Users, History, Settings, Crown, LogOut, Menu, X, Zap, PlayCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
  { to: "/app/missions", label: "Missions", icon: CalendarClock, id: "nav-missions" },
  { to: "/app/calendar", label: "Calendrier", icon: CalendarIcon, id: "nav-calendar" },
  { to: "/app/workers", label: "Intervenants", icon: Users, id: "nav-workers" },
  { to: "/app/history", label: "Historique", icon: History, id: "nav-history" },
  { to: "/app/tutorial", label: "Tutoriel", icon: PlayCircle, id: "nav-tutorial", highlight: true },
  { to: "/app/settings", label: "Paramètres", icon: Settings, id: "nav-settings" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.plan === "pro") {
      setQuota(null);
      return;
    }
    let cancelled = false;
    api.get("/plan/quota")
      .then(({ data }) => { if (!cancelled) setQuota(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

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
          {user?.plan !== "pro" && (
            <NavLink to="/pricing" data-testid="nav-upgrade-cta"
              className="mb-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-700 text-white text-sm font-semibold transition-all shadow-sm">
              <Crown className="w-4 h-4" /> {quota?.trial_expired ? "Essai terminé — Passer au Pro" : quota ? `${quota.trial_days_remaining} j restants · Pro` : "Passer au Pro"}
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

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-display font-bold">ShiftFlow</span>
        </div>
        <button onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle" className="p-2">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 top-14 z-30 bg-white">
          <nav className="p-4 space-y-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                data-testid={`mobile-${n.id}`}
                className={({ isActive }) => {
                  if (n.highlight) {
                    return `flex items-center gap-3 px-3 py-3 rounded-md text-base font-semibold border ${
                      isActive ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-50 text-amber-800 border-amber-200"
                    }`;
                  }
                  return `flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`;
                }}
              >
                <n.icon className="w-5 h-5" />
                {n.label}
                {n.highlight && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded">Guide</span>}
              </NavLink>
            ))}
            <div className="mt-4 pt-4 border-t border-gray-100 grid gap-2 text-sm text-gray-600">
              <Link to="/conditions" onClick={() => setOpen(false)}>Conditions</Link>
              <Link to="/confidentialite" onClick={() => setOpen(false)}>Confidentialité</Link>
              <Link to="/mentions-legales" onClick={() => setOpen(false)}>Mentions légales</Link>
            </div>
            <button
              onClick={handleLogout}
              data-testid="mobile-logout-btn"
              className="w-full mt-4 flex items-center gap-2 px-3 py-3 text-red-600"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:ml-64">
        {user?.plan !== "pro" && quota && (
          <div className={`border-b ${quota.trial_expired ? "bg-red-50 border-red-200" : quota.trial_days_remaining <= 5 ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className={`text-sm ${quota.trial_expired ? "text-red-800" : quota.trial_days_remaining <= 5 ? "text-amber-900" : "text-blue-900"}`}>
                {quota.trial_expired ? (
                  <><strong>Votre essai de 30 jours est terminé.</strong> Vos données restent accessibles, mais les actions ShiftFlow sont verrouillées.</>
                ) : (
                  <><strong>{quota.trial_days_remaining} jour{quota.trial_days_remaining > 1 ? "s" : ""} restant{quota.trial_days_remaining > 1 ? "s" : ""}</strong> · {quota.missions_used}/{quota.mission_limit} missions · {quota.workers}/{quota.worker_limit} intervenants</>
                )}
              </div>
              <Link to="/pricing" className={`text-sm font-semibold shrink-0 ${quota.trial_expired ? "text-red-700 hover:text-red-900" : "text-blue-700 hover:text-blue-900"}`}>
                {quota.trial_expired ? "Débloquer avec Pro" : "Voir le plan Pro"} →
              </Link>
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
