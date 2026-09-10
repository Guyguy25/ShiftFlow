import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Inverse de ProtectedRoute : réservé aux visiteurs NON connectés.
 * Utilisé pour "/", "/login" et "/register" — si l'utilisateur a déjà
 * une session valide, on ne lui montre plus jamais la landing page ou
 * les formulaires, on l'envoie directement dans l'app.
 */
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</div>;
  }
  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return children;
}