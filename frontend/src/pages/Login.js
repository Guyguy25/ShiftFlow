import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8" data-testid="login-logo">
          <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl">ShiftFlow</span>
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h1 className="text-2xl font-display font-bold">Connexion</h1>
          <p className="text-sm text-gray-500 mt-1">Accédez à votre tableau de bord.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" autoComplete="on">
            <div>
              <label htmlFor="login-email" className="text-sm font-medium text-gray-700">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="vous@agence.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="text-sm font-medium text-gray-700">Mot de passe</label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  data-testid="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full h-11 px-3 pr-11 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  data-testid="login-password-toggle"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-600" data-testid="login-error">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full h-11 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          <div className="mt-6 text-sm text-center text-gray-500">
            Pas encore de compte ?{" "}
            <Link to="/register" data-testid="login-register-link" className="text-blue-600 font-medium hover:text-blue-700">Créer un compte</Link>
          </div>
        </div>
      </div>
    </div>
  );
}