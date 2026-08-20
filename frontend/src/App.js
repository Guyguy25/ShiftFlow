import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Missions from "@/pages/Missions";
import MissionCreate from "@/pages/MissionCreate";
import MissionDetail from "@/pages/MissionDetail";
import Workers from "@/pages/Workers";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import Calendar from "@/pages/Calendar";
import PublicConfirm from "@/pages/PublicConfirm";
import Onboarding from "@/pages/Onboarding";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import { Toaster } from "sonner";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/m/:token" element={<PublicConfirm />} />
      <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding/></ProtectedRoute>} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      <Route path="/app" element={<ProtectedRoute><Layout><Outlet/></Layout></ProtectedRoute>}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="missions" element={<Missions />} />
        <Route path="missions/new" element={<MissionCreate />} />
        <Route path="missions/:id" element={<MissionDetail />} />
        <Route path="workers" element={<Workers />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="history" element={<History />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// need Outlet
import { Outlet } from "react-router-dom";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
