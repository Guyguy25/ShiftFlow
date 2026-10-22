import React from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { workspacePath } from "../lib/workspacePaths";

export default function WorkspaceRoute({ children }) {
  const { user } = useAuth();
  const { organizationId } = useParams();
  const location = useLocation();
  const activeId = user?.organization?.id;
  if (!activeId && user?.needs_organization) return <Navigate replace to="/organizations/new" />;
  if (!activeId) return children;
  // Never render another organization's page using the active session's data.
  if (organizationId && organizationId !== activeId) return <main className="min-h-screen bg-gray-50 px-4 py-20"><div className="mx-auto max-w-lg rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">Cet espace n’est pas votre organisation active</h1><p className="mt-3 text-sm text-gray-600">Ouvrez votre espace puis utilisez le menu de l’organisation pour changer d’espace si nécessaire.</p><Link to={workspacePath(activeId)} className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Revenir à mon organisation</Link></div></main>;
  if (!organizationId) return <Navigate replace to={workspacePath(activeId, location.pathname) + location.search + location.hash} />;
  return children;
}
