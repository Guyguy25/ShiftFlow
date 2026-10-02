import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ShiftFlowLoader from "./ShiftFlowLoader";

export default function OwnerRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <ShiftFlowLoader fullScreen label="Ouverture de l’administration…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "owner") return <Navigate to="/app/dashboard" replace />;
  return children;
}
