import { peekPageData, readPageData } from "../lib/pageData";
import WorkspaceSearch from "./WorkspaceSearch";
import { workspacePath, unscopedPath } from "../lib/workspacePaths";
import WorkspaceSelector from "./WorkspaceSelector";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarClock, Calendar as CalendarIcon, Users, History, Settings, MessageCircle, LogOut, MoreHorizontal, X, LifeBuoy, Plus, UserRound, ShieldCheck, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ProfileMenu from "./ProfileMenu";
import WelcomeDialog from "./WelcomeDialog";
import ReturnFeedbackDialog from "./ReturnFeedbackDialog";
import GettingStarted from "./GettingStarted";
import { api } from "../lib/api";
import "./MobileCreateMenu.css";

const nav = [
  { to: "/app/dashboard", label: "Accueil", icon: LayoutDashboard, id: "nav-dashboard" },
  { to: "/app/missions", label: "Missions", icon: CalendarClock, id: "nav-missions" },
  { to: "/app/calendar", label: "Calendrier", icon: CalendarIcon, id: "nav-calendar" },
  { to: "/app/workers", label: "Intervenants", icon: Users, id: "nav-workers" },
  { to: "/app/automations", label: "Messages & relances", icon: MessageCircle, id: "nav-automations" },
  { to: "/app/hours", label: "Suivi des heures", icon: CalendarClock, id: "nav-hours" },
  { to: "/app/history", label: "Historique", icon: History, id: "nav-history" },
];

const mobileNav = [
  { to: "/app/dashboard", label: "Accueil", icon: LayoutDashboard, id: "mobile-nav-dashboard" },
  { to: "/app/missions", label: "Missions", icon: CalendarClock, id: "mobile-nav-missions" },
  { to: "/app/missions/new", label: "Créer", icon: Plus, id: "mobile-nav-create", primary: true },
  { to: "/app/workers", label: "Équipe", icon: Users, id: "mobile-nav-workers" },
];

const mobileMoreNav = [
  { to: "/app/profile", label: "Profil", icon: UserRound },
  { to: "/app/calendar", label: "Calendrier", icon: CalendarIcon },
  { to: "/app/automations", label: "Messages & relances", icon: MessageCircle, id: "mobile-nav-automations" },
  { to: "/app/hours", label: "Suivi des heures", icon: CalendarClock },
  { to: "/app/history", label: "Historique", icon: History },
  { to: "/app/help", label: "Aide", icon: LifeBuoy },
  { to: "/app/settings", label: "Paramètres", icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createButton = useRef(null);
  const firstCreateAction = useRef(null);
  const [missionState, setMissionState] = useState(() => ({ identity: "", hasMission: false }));
  const [quota, setQuota] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const path = unscopedPath(location.pathname);
  const scoped = to => workspacePath(user?.organization?.id, to);
  const identity = `${user?.id || ""}:${user?.organization?.id || ""}`;
  const hasMission = missionState.identity === identity && missionState.hasMission;
  const pageTitle = path === "/app/missions/new" ? "Nouvelle mission" : path.startsWith("/app/missions/") ? "Détail de la mission" : [...nav, ...mobileMoreNav].find(item => item.to === path)?.label || "Mon espace";

  useEffect(() => { setOpen(false); setCreateOpen(false); }, [location.pathname, location.search]);

  // A route change should start at its heading, not keep the scroll position of
  // the WhatsApp contact list or the previous onboarding step.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    const cached = peekPageData("/dashboard/summary");
    if (cached) setMissionState({ identity, hasMission: Number(cached.missions_total || 0) > 0 });
    readPageData(api, "/dashboard/summary")
      .then(({ data }) => { if (live) setMissionState({ identity, hasMission: Number(data?.missions_total || 0) > 0 }); })
      .catch(() => { /* An unavailable summary must not block first mission creation. */ });
    return () => { live = false; };
  }, [identity, location.pathname, user?.id]);

  useEffect(() => {
    if (!createOpen) return;
    firstCreateAction.current?.focus();
    const onEscape = event => {
      if (event.key === "Escape") { setCreateOpen(false); createButton.current?.focus(); }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [createOpen]);

  useEffect(() => { if (!hasMission) setCreateOpen(false); }, [hasMission]);

  useEffect(() => {
    if (!user || user.plan === "pro") {
      setQuota(null);
      return;
    }
    let cancelled = false;
    readPageData(api, "/plan/quota", { params: {} })
      .then(({ data }) => { if (!cancelled) setQuota(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, location.search, user]);


  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (user?.organization?.locked) return <div className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-lg rounded-2xl border bg-white p-6"><WorkspaceSelector/><h1 className="mt-6 text-xl font-bold">L’accès à cette équipe est suspendu</h1><p className="mt-3 text-sm text-gray-600">L’abonnement de cette organisation est inactif ou sa limite de collaborateurs est atteinte. Contactez son propriétaire, sélectionnez un autre espace ou créez votre organisation depuis le menu.</p></div></div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-white border-r border-gray-200">
        <div className="px-3 py-3 flex min-h-20 items-center gap-2 border-b border-gray-100 shrink-0">
          <WorkspaceSelector />
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={scoped(n.to)}
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
          {user?.role === "owner" && <NavLink
            to="/admin"
            className="mt-3 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
          >
            <ShieldCheck className="h-4 w-4" />
            Administration
            <span className="ml-auto rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Owner</span>
          </NavLink>}
        </nav>
        <div className="border-t border-gray-100 p-3 shrink-0 bg-white">
          <Link to={scoped("/app/settings")} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"><Settings size={17}/>Paramètres de l’organisation</Link>
          <Link to={scoped("/app/help")} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"><LifeBuoy size={17}/>Aide et tutoriels</Link>
          <Link to="/" data-testid="desktop-view-site" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"><ExternalLink size={17} aria-hidden="true"/>Voir le site</Link>
          <p className="px-3 pt-3 text-[11px] font-semibold text-gray-400">ShiftFlow · Votre équipe, réunie.</p>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-gray-200 bg-white/95 backdrop-blur lg:left-64 lg:h-20">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1 lg:hidden"><WorkspaceSelector compact /></div>
          <div className="hidden min-w-0 lg:block"><p className="text-[11px] font-medium text-gray-400">Espace de travail</p><p className="truncate text-sm font-semibold text-gray-900">{pageTitle}</p></div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
            <WorkspaceSearch organizationId={user?.organization?.id}/>
            <span className="hidden h-7 w-px bg-gray-200 sm:block" aria-hidden="true"/>
            <ProfileMenu user={user} quota={quota} onLogout={handleLogout} compact />
          </div>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)}>
          <nav aria-label="Navigation secondaire" className="absolute inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <span className="font-semibold text-gray-900">Plus</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {mobileMoreNav.map((n) => (
              <NavLink
                key={n.to}
                to={scoped(n.to)}
                data-testid={n.id}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </NavLink>
            ))}
            {user?.role === "owner" && <NavLink
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-700"
            >
              <ShieldCheck className="h-5 w-5" />
              Administration
              <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold uppercase">Owner</span>
            </NavLink>}
            <Link to="/" data-testid="mobile-view-site" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700"><ExternalLink className="h-5 w-5" aria-hidden="true"/>Voir le site</Link>
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

      {createOpen && <button type="button" data-testid="mobile-create-dismiss" aria-label="Fermer les actions de création" onClick={() => setCreateOpen(false)} className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden" />}
      <nav aria-label="Navigation principale" className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {createOpen && hasMission && <div id="mobile-create-actions" data-testid="mobile-create-menu" aria-label="Que souhaitez-vous créer ?" className="mobile-create-menu absolute bottom-[calc(100%+12px)] left-1/2 w-[min(360px,calc(100vw-28px))] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl shadow-slate-950/15">
          <p className="px-2 pb-2 pt-1 text-sm font-bold text-slate-900">Que souhaitez-vous faire ?</p>
          <Link ref={firstCreateAction} to={scoped("/app/missions/new")} data-testid="mobile-create-mission-option" onClick={() => setCreateOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CalendarClock size={21} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-950">Créer une mission</span><span className="block text-xs text-gray-500">Date, lieu et équipe nécessaire</span></span>
          </Link>
          <Link to={scoped("/app/workers?add=1")} data-testid="mobile-create-worker-option" onClick={() => setCreateOpen(false)} className="mt-1 flex min-h-14 items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Users size={21} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-950">Ajouter des intervenants</span><span className="block text-xs text-gray-500">Depuis WhatsApp ou manuellement</span></span>
          </Link>
        </div>}
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-1">
          {mobileNav.map((n) => n.primary ? (hasMission ?
            <button key={n.to} type="button" ref={createButton} onClick={() => { setOpen(false); setCreateOpen(value => !value); }} aria-controls="mobile-create-actions" aria-expanded={createOpen} aria-label="Créer une mission ou ajouter des intervenants" data-testid={n.id} className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${createOpen ? "text-blue-700" : "text-gray-500"}`}>
              <span className="mobile-create-trigger -mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200"><Plus className={`h-6 w-6 transition-transform duration-200 ${createOpen ? "rotate-45" : ""}`} aria-hidden="true" /></span>
              <span>Créer</span>
            </button> :
            <NavLink key={n.to} to={scoped(n.to)} aria-label="Créer ma première mission" data-testid={n.id} className="relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-blue-700">
              <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200"><Plus className="h-6 w-6" aria-hidden="true" /></span><span>Créer</span>
            </NavLink>
          ) : (
            <NavLink key={n.to} to={scoped(n.to)} onClick={() => setCreateOpen(false)} data-testid={n.id} className={({ isActive }) => `relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${isActive ? "text-blue-700" : "text-gray-500"}`}>
              <span className="flex h-7 items-center justify-center"><n.icon className="h-5 w-5" aria-hidden="true" /></span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <button type="button" onClick={() => { setCreateOpen(false); setOpen((value) => !value); }} data-testid="mobile-nav-more" aria-expanded={open} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${mobileMoreNav.some((item) => path.startsWith(item.to)) || open ? "text-blue-700" : "text-gray-500"}`}>
            <span className="flex h-7 items-center justify-center"><MoreHorizontal className="h-5 w-5" /></span>
            <span>Plus</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 pt-16 pb-20 lg:pb-0 lg:pt-20 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 pb-24 sm:pt-8 sm:pb-28">
          <GettingStarted>{children}</GettingStarted>
        </div>
      </main>
      {user?.organization?.role !== "member" && <WelcomeDialog key={user.id} user={user} />}
      {user?.organization?.role !== "member" && <ReturnFeedbackDialog key={`feedback-${user.id}`} user={user} />}
    </div>
  );
}


