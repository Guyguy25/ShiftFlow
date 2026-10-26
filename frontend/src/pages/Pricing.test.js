import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Pricing from "./Pricing";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
jest.mock("../lib/api",()=>({api:{get:jest.fn(),post:jest.fn()},formatApiError:v=>v}));
jest.mock("../context/AuthContext",()=>({useAuth:jest.fn()}));
jest.mock("../components/WhopCheckoutModal",()=>({__esModule:true,default:({checkout,onClose})=>checkout?<div data-testid="modal">{checkout.session_id}<button onClick={onClose}>Fermer</button></div>:null}));
jest.mock("react-router-dom",()=>({Link:({to,children,...p})=><a href={to} {...p}>{children}</a>}),{virtual:true});
let host,root,quota,ready;
beforeEach(()=>{window.scrollTo=jest.fn();global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);useAuth.mockReturnValue({user:{id:"u",organization:{id:"org",name:"AXE Events"},can_manage_billing:true}});quota={plan:"free",free_missions_remaining:0};ready=true;api.get.mockImplementation(url=>Promise.resolve({data:url==="/whop/config"?{ready}:quota}));api.post.mockReset();HTMLElement.prototype.scrollIntoView=jest.fn();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async()=>{await act(async()=>root.render(<Pricing/>));};
const card=tier=>host.querySelector(`[data-testid="pricing-card-${tier}"]`);
test("three current monthly offers, independent billing and shared discovery",async()=>{await render();for(const [t,p] of [["start","29 €"],["pro","79 €"],["business","149 €"]])expect(card(t).textContent).toContain(p);expect(host.textContent).toContain("AXE Events");expect(host.textContent).toContain("partagées entre ses organisations");expect(host.textContent).not.toContain("747,60");});
test.each([
  ["start", "9,67", "7,73", "3"],
  ["pro", "3,95", "2,96", "20"],
  ["business", "4,97", "2,98", "30"],
])("%s displays an accurate per-mission estimate for monthly and annual billing", async (tier, monthly, yearly, missions) => {
  await render();
  const note = () => card(tier).querySelector(`[data-testid="pricing-per-mission-${tier}"]`).textContent;
  expect(note()).toContain(`${monthly} € par mission`);
  expect(note()).toContain(missions);
  expect(note()).toContain(tier === "business" ? "Exemple" : "missions incluses");
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent.startsWith("Annuel")).click());
  expect(note()).toContain(`${yearly} € par mission`);
  expect(note()).toContain(missions);
});
test.each(["start","pro","business"])("%s monthly opens bound Whop checkout without an extra checkbox",async tier=>{api.post.mockResolvedValue({data:{session_id:"ch_test",reference:"ref"}});await render();expect(host.querySelector('input[type="checkbox"]')).toBeNull();await act(async()=>card(tier).querySelector("button").click());expect(api.post).toHaveBeenCalledWith("/whop/checkout",{offer_key:`${tier}_monthly`,legal_version:"2026-10-24"},{headers:{"X-Organization-ID":"org"}});expect(host.querySelector('[data-testid="modal"]').textContent).toContain("ch_test");});
test.each([["start","278,40","20"],["pro","711","25"],["business","1 072,80","40"]])("%s annual displays charge and sends annual offer",async(tier,total,discount)=>{api.post.mockRejectedValue({response:{data:{detail:"Test"}}});await render();await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent.startsWith("Annuel")).click());expect(card(tier).textContent).toContain(total);expect(card(tier).textContent).toContain(`−${discount} %`);await act(async()=>card(tier).querySelector("button").click());expect(api.post).toHaveBeenCalledWith("/whop/checkout",expect.objectContaining({offer_key:`${tier}_yearly`}),expect.anything());expect(host.textContent).toContain("Test");});
test("double click creates one checkout",async()=>{api.post.mockReturnValue(new Promise(()=>{}));await render();await act(async()=>{const b=card("start").querySelector("button");b.click();b.click();});expect(api.post).toHaveBeenCalledTimes(1);});
test("missing configuration blocks payment visibly",async()=>{ready=false;await render();expect(card("pro").querySelector("button").disabled).toBe(true);expect(host.textContent).toContain("en cours de configuration");});
test("quota failure blocks payment",async()=>{api.get.mockImplementation(url=>url==="/whop/config"?Promise.resolve({data:{ready:true}}):Promise.reject(new Error()));await render();expect(card("pro").querySelector("button").disabled).toBe(true);expect(host.textContent).toContain("Impossible de vérifier");});
test("existing subscriber switches through the managed portal without a second checkout",async()=>{quota={plan:"pro",subscription_tier:"start"};api.post.mockRejectedValue({response:{data:{detail:"Portail test"}}});await render();expect(card("business").querySelector("button").disabled).toBe(false);await act(async()=>card("business").querySelector("button").click());expect(api.post).toHaveBeenCalledWith("/payments/portal",{},{headers:{"X-Organization-ID":"org"}});expect(api.post).not.toHaveBeenCalledWith("/whop/checkout",expect.anything(),expect.anything());});
test("collaborator cannot purchase for owner",async()=>{useAuth.mockReturnValue({user:{id:"m",organization:{id:"org",name:"Team"},can_manage_billing:false}});await render();expect([...host.querySelectorAll('section[data-testid] button')].every(b=>b.disabled)).toBe(true);expect(host.querySelector('input[type="checkbox"]')).toBeNull();});

test("owner-wide coverage and shared limits are explicit",async()=>{
 await render();expect(host.textContent).toContain("couvre toutes les organisations");
 expect(card("pro").textContent).toContain("3 collaborateurs");
 expect(card("business").textContent).toContain("10 collaborateurs");
});
test("checkout only forwards advertising identifiers with current cookie consent",async()=>{
 localStorage.setItem("shiftflow_cookie_consent","accepted");
 try {
  api.post.mockResolvedValue({data:{session_id:"ch_test",reference:"ref"}});await render();
  await act(async()=>card("start").querySelector("button").click());
  expect(api.post).toHaveBeenCalledWith("/whop/checkout",expect.objectContaining({meta_consent:true}),expect.anything());
 } finally {localStorage.removeItem("shiftflow_cookie_consent");}
});

test.each([["1-3","start"],["4-10","pro"],["21+","business"]])("personalized recommendation %s highlights only %s, including annual prices",async(monthly_missions,tier)=>{
 const current=useAuth().user;
 useAuth.mockReturnValue({user:{...current,onboarding_answers:{monthly_missions}}});
 await render();
 expect(card(tier).textContent).toContain("Recommandé pour vous");
 expect([...host.querySelectorAll('section[data-testid]')].filter(s=>s.textContent.includes("Recommandé pour vous"))).toHaveLength(1);
 expect(card(tier).className).toContain("border-blue-600");
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.startsWith("Annuel")).click());
 expect(card(tier).textContent).toContain("Recommandé pour vous");
});
test("annual signup answers recommend Start without treating intervenants as app users",async()=>{
 useAuth.mockReturnValue({user:{id:"u",organization:{id:"org",name:"AXE Events"},can_manage_billing:true,onboarding_answers:{annual_events:30,people_per_mission:100}}});
 await render();expect(card("start").textContent).toContain("Recommandé pour vous");
 expect(card("start").textContent).toContain("30 événements par an");
});
test("unknown signup volume never invents a personalized recommendation",async()=>{
 await render();expect(host.textContent).not.toContain("Recommandé pour vous");
});


test("comparison exposes shared features and differences with accessible availability",async()=>{
 await render();
 expect(host.textContent).toContain("Comparez les plans en un coup d’œil");
 const table=host.querySelector("table");
 const rows=[...table.querySelectorAll("tbody tr")];
 expect(rows.find(r=>r.textContent.startsWith("Missions par mois")).textContent).toContain("320Illimitées");
 expect([...rows.find(r=>r.textContent.startsWith("Accès individuels")).querySelectorAll("td")].map(c=>c.textContent)).toEqual(["Non inclus","Inclus","Inclus"]);
 expect([...rows.find(r=>r.textContent.startsWith("Rôles administrateur")).querySelectorAll("td")].map(c=>c.textContent)).toEqual(["Non inclus","Non inclus","Inclus"]);
});
test("missing signup volume explains recommendation and lets the visitor estimate it",async()=>{
 useAuth.mockReturnValue({user:false});await render();
 expect(host.textContent).toContain("Connectez-vous pour retrouver");
 expect(card("start").textContent).not.toContain("Recommandé pour vous");
 await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="Jusqu’à 3 / mois").click());
 expect(card("start").textContent).toContain("Recommandé pour vous");
 await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="Plus de 20 / mois").click());
 expect(card("business").textContent).toContain("Recommandé pour vous");
 expect(card("start").textContent).not.toContain("Recommandé pour vous");
});
test("saved recommendation can be adjusted and restored without changing signup answers",async()=>{
 useAuth.mockReturnValue({user:{id:"u",can_manage_billing:true,onboarding_answers:{annual_events:30}}});await render();
 expect(card("start").textContent).toContain("Recommandé pour vous");
 await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="4 à 20 / mois").click());
 expect(card("pro").textContent).toContain("Recommandé pour vous");
 await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="Revenir à mes réponses d’inscription").click());
 expect(card("start").textContent).toContain("Recommandé pour vous");
 expect(api.post).not.toHaveBeenCalled();
});
