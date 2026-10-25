import { pendingInvitation } from "../lib/invitation";
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ShiftFlowLoader from "./ShiftFlowLoader";

/**
 * Inverse de ProtectedRoute : réservé aux visiteurs NON connectés.
 * Utilisé pour "/login" et "/register". La landing reste publique,
 * y compris pour les utilisateurs connectés.
 */
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <ShiftFlowLoader fullScreen label="Ouverture de ShiftFlow…" />;
  }
  if (user) {
    return <Navigate to={pendingInvitation() ? "/invite" : user.needs_organization ? "/organizations/new" : "/app/dashboard"} replace />;
  }
  return children;
}