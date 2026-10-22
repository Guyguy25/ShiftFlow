import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { clearInvitation } from "../lib/invitation";
import { workspacePath } from "../lib/workspacePaths";

export default function CreateOrganization(){
 const {user,logout}=useAuth();const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function submit(event){event.preventDefault();if(busy||!name.trim())return;setBusy(true);setError("");try{const {data}=await api.post("/organization",{name:name.trim(),avatar:""});clearInvitation();window.location.assign(workspacePath(data.id));}catch(err){setError(formatApiError(err.response?.data?.detail)||"Impossible de créer l’organisation.");setBusy(false);}}
 async function openPersonal(){setBusy(true);setError("");try{await api.post("/organization/switch",{organization_id:user.personal_organization_id});window.location.assign(workspacePath(user.personal_organization_id));}catch(err){setError(formatApiError(err.response?.data?.detail)||"Impossible d’ouvrir votre organisation.");setBusy(false);}}
 return <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-12"><section className="w-full max-w-lg rounded-2xl border bg-white p-5 shadow-sm sm:p-8"><Building2 className="h-9 w-9 text-blue-600"/><h1 className="mt-4 text-2xl font-bold">Votre propre organisation</h1>
 {user?.can_create_organization?<><p className="mt-3 text-sm text-gray-600">Créez un espace indépendant pour votre entreprise. Vous en serez propriétaire et conserverez votre accès aux équipes que vous avez rejointes.</p><div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Vos 3 missions personnelles sont offertes une seule fois. Créer ou rejoindre un espace ne réinitialise pas ce quota. L’abonnement d’une équipe que vous rejoignez ne s’applique pas ici. Pro et Pro Team se souscrivent pour cette organisation.</div><form onSubmit={submit} className="mt-5"><label className="block text-sm font-medium">Nom de l’organisation<input autoComplete="organization" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/></label>{error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50">{busy?"Création…":"Créer mon organisation"}</button></form><p className="mt-3 text-xs text-gray-500">Une organisation créée par compte. Vous pouvez rejoindre plusieurs équipes sur invitation.</p></>:<><p className="mt-3 text-sm text-gray-600">Vous possédez déjà une organisation. Retrouvez-la ci-dessous ou changez d’espace depuis le menu en haut à gauche.</p><button type="button" disabled={busy} onClick={openPersonal} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700">Ouvrir mon organisation</button>{error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</>}
 {user?.organization&&<Link to={workspacePath(user.organization.id)} className="mt-5 block text-sm text-blue-700">Retour à {user.organization.name}</Link>}
 {!user?.organization&&<button type="button" onClick={async()=>{await logout();window.location.assign("/login");}} className="mt-5 text-sm text-gray-500 underline">Me déconnecter</button>}
 </section></main>;
}
