import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff } from "lucide-react";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError, markLoggedOut } from "../lib/api";
import { clearInvitation } from "../lib/invitation";
import { workspacePath } from "../lib/workspacePaths";
import { LEGAL_VERSION } from "../constants/legal";

export default function InviteRegister({ token }) {
  const { register, refresh } = useAuth();
  const navigate = useNavigate();
  const [info,setInfo] = useState(null), [error,setError] = useState("");
  const [form,setForm] = useState({name:"",email:"",password:""});
  const [credential,setCredential] = useState("");
  const [busy,setBusy] = useState(false), [visible,setVisible] = useState(false);
  useEffect(()=>{let live=true;api.post("/organization/invitation-info",{token}).then(({data})=>{if(live)setInfo(data);}).catch(err=>{if(live)setError(formatApiError(err.response?.data?.detail)||"Invitation indisponible.");});return()=>{live=false;};},[token]);
  async function submit(event) {
    event.preventDefault(); if(busy||!info)return;
    if(!form.name.trim()){setError("Indiquez votre nom.");return;}
    if(!credential && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())||form.password.length<8||!/[0-9]/.test(form.password)||!/[a-zà-ÿ]/i.test(form.password))){setError("Indiquez un email valide et un mot de passe de 8 caractères minimum, avec une lettre et un chiffre.");return;}
    setBusy(true);setError("");
    const payload={name:form.name.trim(),invitation_token:token,legal_acceptance:{version:LEGAL_VERSION,accepted_at:new Date().toISOString(),scope:"account"}};
    try {
      let data;
      if(credential){markLoggedOut(false);({data}=await api.post("/auth/google",{credential,registration:payload,legal_version:LEGAL_VERSION}));await refresh();}
      else data=await register({...payload,email:form.email.trim(),password:form.password});
      if(data.invitation_accepted){clearInvitation();navigate(workspacePath(data.user.organization?.id),{replace:true});}
      else navigate("/invite",{replace:true});
    } catch(err){setError(formatApiError(err.response?.data?.detail)||"Impossible de créer votre compte.");if(credential)setCredential("");}
    finally{setBusy(false);}
  }
  const input="mt-2 h-12 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";
  return <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-10"><section className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-sm sm:p-8" data-testid="invitation-register">
    <Building2 className="h-9 w-9 text-blue-600"/><h1 className="mt-4 text-2xl font-bold">Rejoindre {info?.name || "votre équipe"}</h1><p className="mt-3 text-sm text-gray-500">Créez votre compte personnel pour rejoindre l’organisation. Son abonnement est géré par son propriétaire.</p>
    {info && <><p className="mt-2 text-xs text-gray-500">Utilisez l’adresse correspondant à {info.email_hint}.</p><GoogleAuthButton onCredential={value=>{setCredential(value);setForm(previous=>({...previous,password:""}));setError("");}}/>
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <label className="block text-sm font-medium">Votre nom<input name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={input}/></label>
      {credential?<p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Compte Google sélectionné. Confirmez pour rejoindre l’équipe.</p>:<><label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="username" required maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={input}/></label><label className="block text-sm font-medium">Mot de passe<span className="relative block"><input name="password" type={visible?"text":"password"} autoComplete="new-password" minLength={8} maxLength={128} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={`${input} pr-12`}/><button type="button" onClick={()=>setVisible(!visible)} aria-label={visible?"Masquer le mot de passe":"Afficher le mot de passe"} className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center text-gray-500">{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label><p className="text-xs text-gray-500">8 caractères minimum, avec une lettre et un chiffre.</p></>}
      <p className="text-xs leading-relaxed text-gray-500">En créant votre compte, vous acceptez les <Link to="/conditions" className="text-blue-700 underline" target="_blank">conditions générales</Link> et la <Link to="/confidentialite" className="text-blue-700 underline" target="_blank">politique de confidentialité</Link>.</p>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50">{busy?"Ouverture de l’équipe…":"Créer mon compte et rejoindre"}</button>
    </form></>}
    {!info&&!error&&<p role="status" className="mt-4 text-sm text-gray-500">Vérification de l’invitation…</p>}{error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <Link to="/login" className="mt-5 block text-center text-sm text-blue-700">J’ai déjà un compte</Link><Link to="/invite" className="mt-4 block text-center text-xs text-gray-500 underline">Revenir à l’invitation</Link>
  </section></main>;
}
