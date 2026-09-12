import React, { createContext, useContext, useEffect, useState } from "react";
import { api, markLoggedOut } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=logged out, obj=logged in
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email, password) => {
    markLoggedOut(false);
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data.user);
    return data;
  };
  const register = async (payload) => {
    markLoggedOut(false);
    const { data } = await api.post("/auth/register", payload);
    setUser(data.user);
    return data;
  };
  const logout = async () => {
    markLoggedOut(true);
    setUser(false);
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // même si l'appel échoue, l'utilisateur est déconnecté côté front
      // et le refresh silencieux reste désactivé — pas de résurrection possible
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}