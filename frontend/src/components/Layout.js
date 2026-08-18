import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarClock, Users, History, Settings, LogOut, Menu, X, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
  { to: "/app/missions", label: "Missions", icon: CalendarClock, id: "nav-missions" },
  { to: "/app/workers", label: "Intervenants", icon: Users, id: "nav-workers" },
  { to: "/app/history", label: "Historique", icon: History, id: "nav-history" },
  { to: "/app/settings", label: "Paramètres", icon: Settings, id: "nav-settings" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-gray-200">
        <div className="px-6 py-6 flex items-center gap-2 border-b border-gray-200">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">ShiftFlow</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.id}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <n.icon className="w-4 h-4" aria-hidden="true" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-4">
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
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`
                }
              >
                <n.icon className="w-5 h-5" />
                {n.label}
              </NavLink>
            ))}
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

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
