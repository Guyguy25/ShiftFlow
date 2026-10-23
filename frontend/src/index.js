import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import WhopCheckoutModal from "./components/WhopCheckoutModal";
const root = ReactDOM.createRoot(document.getElementById("root"));
const qa = window.location.pathname === "/checkout-qa";
root.render(<React.StrictMode>{qa ? <AuthProvider><main className="min-h-screen bg-gray-100 p-10">Prévisualisation du formulaire, aucun paiement de test à effectuer.<WhopCheckoutModal checkout={{session_id:"ch_g1Ce9uikVNyMiqX",reference:"preview_render_only",organization_id:"preview",organization_name:"Aperçu Business annuel",environment:"production"}} onClose={()=>root.unmount()}/></main></AuthProvider> : <App/>}</React.StrictMode>);
