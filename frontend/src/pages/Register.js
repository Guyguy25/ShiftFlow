import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";

export default function Register() {
  const [form, setForm] = useState({ name: "", agency_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/onboarding");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8" data-testid="register-logo">
          <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl">ShiftFlow</span>
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h1 className="text-2xl font-display font-bold">Créer un compte</h1>
          <p className="text-sm text-gray-500 mt-1">Testez ShiftFlow gratuitement.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom de l'agence</label>
              <input required data-testid="register-agency-input" value={form.agency_name} onChange={setF("agency_name")}
                className="mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mon Agence Event" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Votre nom</label>
              <input required data-testid="register-name-input" value={form.name} onChange={setF("name")}
                className="mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tanguy Dupont" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input type="email" required data-testid="register-email-input" value={form.email} onChange={setF("email")}
                className="mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="vous@agence.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Téléphone</label>
              <input data-testid="register-phone-input" value={form.phone} onChange={setF("phone")}
                className="mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="06 XX XX XX XX" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mot de passe</label>
              <input type="password" required minLength={6} data-testid="register-password-input" value={form.password} onChange={setF("password")}
                className="mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Minimum 6 caractères" />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="register-error">{error}</div>}
            <button type="submit" disabled={loading} data-testid="register-submit-btn"
              className="w-full h-11 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-60">
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>
          <div className="mt-6 text-sm text-center text-gray-500">
            Déjà un compte ?{" "}
            <Link to="/login" data-testid="register-login-link" className="text-blue-600 font-medium hover:text-blue-700">Se connecter</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
