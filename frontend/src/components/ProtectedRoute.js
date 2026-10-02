import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ShiftFlowLoader from "./ShiftFlowLoader";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <ShiftFlowLoader fullScreen label="Ouverture de ShiftFlow…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
