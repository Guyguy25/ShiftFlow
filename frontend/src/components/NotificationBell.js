import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { api } from "../lib/api";
import { workspacePath } from "../lib/workspacePaths";

const kindStyles = {
  accepted: "bg-emerald-100 text-emerald-700",
  refused: "bg-amber-100 text-amber-800",
  cancelled: "bg-rose-100 text-rose-700",
  invite: "bg-blue-100 text-blue-700",
  followup: "bg-indigo-100 text-indigo-700",
  reminder: "bg-slate-100 text-slate-600",
};

function friendlyDate(raw) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export default function NotificationBell({ userId, organizationId }) {
  const navigate = useNavigate();
  const outer = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showSpinner = false) => {
    if (!userId || !organizationId) return;
    if (showSpinner) setLoading(true);
    try {
      const { data } = await api.get("/activity-notifications", {
        params: { limit: 40 },
        headers: { "X-Organization-ID": organizationId },
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(Math.max(0, Number(data?.unread || 0)));
      setError("");
    } catch {
      if (showSpinner) setError("Impossible de charger vos notifications.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [userId, organizationId]);

  useEffect(() => {
    setOpen(false);
    setItems([]);
    setUnread(0);
    setError("");
    if (!userId || !organizationId) return undefined;
    load();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") load();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [userId, organizationId, load]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => {
      if (!outer.current?.contains(event.target)) setOpen(false);
    };
    const keyboard = event => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);

  const markRead = async () => {
    try {
      await api.post("/activity-notifications/read", {}, {
        headers: { "X-Organization-ID": organizationId },
      });
      setUnread(0);
      setItems(previous => previous.map(item => ({ ...item, unread: false })));
    } catch {
      setError("Impossible de marquer les notifications comme lues.");
    }
  };

  if (!organizationId) return null;
  return (
    <div className="relative" ref={outer}>
      <button
        ref={trigger}
        type="button"
        data-testid="notification-bell"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? "Notifications : " + unread + " non lues" : "Notifications"}
        title="Notifications"
        onClick={() => { setOpen(value => !value); if (!open) load(true); }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Bell className="h-[19px] w-[19px]" aria-hidden="true" />
        {unread > 0 && <span data-testid="notification-count" className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section role="dialog" aria-label="Centre de notifications" data-testid="notification-panel" className="absolute right-0 top-[calc(100%+12px)] z-[60] w-[min(390px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/15">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Notifications</h2>
            <p className="text-xs text-gray-500">{unread ? unread + " non lue" + (unread > 1 ? "s" : "") : "Vous êtes à jour"}</p>
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && <button type="button" data-testid="mark-all-notifications-read" onClick={markRead} className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50" title="Tout marquer comme lu"><CheckCheck className="h-4 w-4" aria-hidden="true" /><span className="hidden min-[375px]:inline">Tout lire</span></button>}
            <button type="button" aria-label="Fermer les notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" aria-hidden="true"/></button>
          </div>
        </div>
        {error && <p role="alert" className="mx-3 mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{error}</p>}
        <div className="max-h-[min(460px,65dvh)] overflow-y-auto" aria-live="polite">
          {loading && !items.length ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin"/>Chargement…</div>
          : !items.length ? <div className="px-6 py-12 text-center"><Bell className="mx-auto h-8 w-8 text-gray-300"/><p className="mt-3 text-sm font-semibold text-gray-700">Aucune notification pour le moment</p><p className="mt-1 text-xs text-gray-500">Les réponses, relances et invitations apparaîtront ici.</p></div>
          : items.map(item => <button
            type="button" key={item.id} data-testid={"notification-item-" + item.kind}
            onClick={() => { setOpen(false); navigate(workspacePath(organizationId, item.url)); }}
            className={"flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 " + (item.unread ? "bg-blue-50/40" : "")}
          >
            <span className={"mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-xl " + (kindStyles[item.kind] || "bg-gray-100 text-gray-600")}><Bell className="h-4 w-4" aria-hidden="true"/></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">{item.title}{item.unread && <span className="h-1.5 w-1.5 flex-none rounded-full bg-blue-600" aria-label="Non lue"/>}</span>
              <span className="mt-0.5 block break-words text-xs leading-relaxed text-gray-600">{item.message}</span>
              <span className="mt-1.5 block text-[11px] text-gray-400">{friendlyDate(item.created_at)}</span>
            </span>
          </button>)}
        </div>
      </section>}
    </div>
  );
}
