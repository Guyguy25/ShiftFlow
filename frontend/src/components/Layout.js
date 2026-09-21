import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarClock, Calendar as CalendarIcon, Users, History, Settings, Crown, LogOut, Menu, X, Zap, PlayCircle, Clock3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const formatTrialRemaining = (endsAt, nowMs) => {
  if (!endsAt) return null;
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs)) return null;
  const remaining = Math.max(0, endMs - nowMs);

  if (remaining <= 0) return { expired: true, label: "Essai terminé", remainingMs: 0 };

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;

  if (remaining < dayMs) {
    const hours = Math.floor(remaining / hourMs);
    const minutes = Math.max(0, Math.ceil((remaining % hourMs) / minuteMs));
    const label = hours > 0
      ? `${hours} h ${minutes} min restantes`
      : `${minutes} min restantes`;
    return { expired: false, label, remainingMs: remaining };
  }

  const days = Math.ceil(remaining / dayMs);
  return {
    expired: false,
    label: `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`,
    remainingMs: remaining,
  };
};

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
  const [clockNow, setClockNow] = useState(Date.now());
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    if (!quota?.trial_ends_at || user?.plan === "pro") return undefined;
    setClockNow(Date.now());
    const interval = window.setInterval(() => setClockNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(interval);
  }, [quota?.trial_ends_at, user?.plan]);

  const trialStarted = !!quota?.trial_started;
  const trialCountdown = trialStarted ? formatTrialRemaining(quota?.trial_ends_at, clockNow) : null;
  const trialExpired = !!(quota?.trial_expired || trialCountdown?.expired);

  const trialTone = (() => {
    if (!trialStarted) return "ready";
    if (trialExpired || (trialCountdown?.remainingMs ?? Infinity) < 24 * 60 * 60 * 1000) return "danger";
    if ((trialCountdown?.remainingMs ?? Infinity) <= 3 * 24 * 60 * 60 * 1000) return "urgent";
    if ((trialCountdown?.remainingMs ?? Infinity) <= 7 * 24 * 60 * 60 * 1000) return "warning";
    return "calm";
  })();

  const toneClasses = {
    ready: {
      card: "border-emerald-200 bg-emerald-50/80",
      icon: "bg-white text-emerald-700",
      kicker: "text-emerald-700",
      text: "text-emerald-950",
      banner: "bg-emerald-50 border-emerald-200",
      bannerText: "text-emerald-900",
      link: "text-emerald-700 hover:text-emerald-900",
      track: "bg-emerald-100",
      fill: "bg-emerald-500",
    },
    calm: {
      card: "border-blue-100 bg-blue-50/70",
      icon: "bg-white text-blue-700",
      kicker: "text-blue-600",
      text: "text-gray-900",
      banner: "bg-blue-50 border-blue-100",
      bannerText: "text-blue-900",
      link: "text-blue-700 hover:text-blue-900",
      track: "bg-blue-100",
      fill: "bg-blue-600",
    },
    warning: {
      card: "border-amber-200 bg-amber-50",
      icon: "bg-white text-amber-700",
      kicker: "text-amber-700",
      text: "text-amber-950",
      banner: "bg-amber-50 border-amber-200",
      bannerText: "text-amber-900",
      link: "text-amber-700 hover:text-amber-950",
      track: "bg-amber-100",
      fill: "bg-amber-500",
    },
    urgent: {
      card: "border-orange-200 bg-orange-50",
      icon: "bg-white text-orange-700",
      kicker: "text-orange-700",
      text: "text-orange-950",
      banner: "bg-orange-50 border-orange-200",
      bannerText: "text-orange-950",
      link: "text-orange-700 hover:text-orange-950",
      track: "bg-orange-100",
      fill: "bg-orange-500",
    },
    danger: {
      card: "border-red-200 bg-red-50",
      icon: "bg-white text-red-700",
      kicker: "text-red-700",
      text: "text-red-950",
      banner: "bg-red-50 border-red-200",
      bannerText: "text-red-900",
      link: "text-red-700 hover:text-red-950",
      track: "bg-red-100",
      fill: "bg-red-600",
    },
  };
  const tone = toneClasses[trialTone];

  const trialProgress = (() => {
    if (!quota?.trial_started_at || !quota?.trial_ends_at) return null;
    const start = new Date(quota.trial_started_at).getTime();
    const end = new Date(quota.trial_ends_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const elapsed = Math.min(end - start, Math.max(0, clockNow - start));
    return Math.round((elapsed / (end - start)) * 100);
  })();

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
            <div className={`mb-3 rounded-xl border p-3 transition-colors ${tone.card}`} data-testid="trial-countdown-card">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone.icon}`}>
                  {trialStarted ? <Clock3 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className={`text-[10px] uppercase tracking-widest font-bold ${tone.kicker}`}>{trialStarted ? "Essai en cours" : "Essai prêt"}</div>
                  <div className={`text-sm font-semibold truncate ${tone.text}`}>
                    {trialStarted ? (trialCountdown?.label || "30 jours") : "30 jours disponibles"}
                  </div>
                </div>
              </div>
              {!trialStarted ? (
                <div className="mt-2 text-[11px] leading-relaxed text-emerald-800">
                  Le chrono démarre seulement quand vous créez votre première mission.
                </div>
              ) : trialProgress !== null && !trialExpired ? (
                <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${tone.track}`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${tone.fill}`} style={{ width: `${trialProgress}%` }} />
                </div>
              ) : null}
            </div>
          )}
          {user?.plan !== "pro" && (
            <NavLink to="/pricing" data-testid="nav-upgrade-cta"
              className="mb-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-700 text-white text-sm font-semibold transition-all shadow-sm">
              <Crown className="w-4 h-4" /> {trialExpired ? "Essai terminé — Passer au Pro" : "Passer au Pro"}
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
          <div className={`border-b transition-colors ${tone.banner}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className={`text-sm flex flex-wrap items-center gap-x-2 gap-y-1 ${tone.bannerText}`}>
                {!trialStarted ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-semibold"><Zap className="w-3.5 h-3.5" /> Vos 30 jours sont prêts</span>
                    <span className="opacity-40">·</span>
                    <span>Le chrono démarre à votre première mission</span>
                    <span className="opacity-40">·</span>
                    <span>{quota.workers}/{quota.worker_limit} intervenants préparés</span>
                  </>
                ) : trialExpired ? (
                  <><strong>Votre essai de 30 jours est terminé.</strong> <span>Vos données restent accessibles, mais les actions ShiftFlow sont verrouillées.</span></>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-semibold"><Clock3 className="w-3.5 h-3.5" /> {trialCountdown?.label}</span>
                    <span className="opacity-40">·</span>
                    <span>{quota.missions_used}/{quota.mission_limit} missions</span>
                    <span className="opacity-40">·</span>
                    <span>{quota.workers}/{quota.worker_limit} intervenants</span>
                  </>
                )}
              </div>
              {!trialStarted ? (
                <Link to="/app/missions/new" className={`text-sm font-semibold shrink-0 ${tone.link}`}>Créer ma première mission →</Link>
              ) : (
                <Link to="/pricing" className={`text-sm font-semibold shrink-0 ${tone.link}`}>
                  {trialExpired ? "Débloquer avec Pro" : "Voir le plan Pro"} →
                </Link>
              )}
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
