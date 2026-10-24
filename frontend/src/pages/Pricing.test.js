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
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);useAuth.mockReturnValue({user:{id:"u",organization:{id:"org",name:"AXE Events"},can_manage_billing:true}});quota={plan:"free",free_missions_remaining:0};ready=true;api.get.mockImplementation(url=>Promise.resolve({data:url==="/whop/config"?{ready}:quota}));api.post.mockReset();HTMLElement.prototype.scrollIntoView=jest.fn();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async()=>{await act(async()=>root.render(<Pricing/>));};
const card=tier=>host.querySelector(`[data-testid="pricing-card-${tier}"]`);
test("three current monthly offers, independent billing and shared discovery",async()=>{await render();for(const [t,p] of [["start","29 €"],["pro","79 €"],["business","149 €"]])expect(card(t).textContent).toContain(p);expect(host.textContent).toContain("AXE Events");expect(host.textContent).toContain("partagées entre ses organisations");expect(host.textContent).not.toContain("747,60");});
test.each(["start","pro","business"])("%s monthly requires consent and opens bound Whop checkout",async tier=>{api.post.mockResolvedValue({data:{session_id:"ch_test",reference:"ref"}});await render();await act(async()=>card(tier).querySelector("button").click());expect(api.post).not.toHaveBeenCalled();expect(host.querySelector('[role="alert"]').textContent).toContain("Acceptez");await act(async()=>host.querySelector('input[type="checkbox"]').click());await act(async()=>card(tier).querySelector("button").click());expect(api.post).toHaveBeenCalledWith("/whop/checkout",{offer_key:`${tier}_monthly`,legal_version:"2026-10-23"},{headers:{"X-Organization-ID":"org"}});expect(host.querySelector('[data-testid="modal"]').textContent).toContain("ch_test");});
test.each([["start","278,40","20"],["pro","711","25"],["business","1 072,80","40"]])("%s annual displays charge and sends annual offer",async(tier,total,discount)=>{api.post.mockRejectedValue({response:{data:{detail:"Test"}}});await render();await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent.startsWith("Annuel")).click());expect(card(tier).textContent).toContain(total);expect(card(tier).textContent).toContain(`−${discount} %`);await act(async()=>host.querySelector('input[type="checkbox"]').click());await act(async()=>card(tier).querySelector("button").click());expect(api.post).toHaveBeenCalledWith("/whop/checkout",expect.objectContaining({offer_key:`${tier}_yearly`}),expect.anything());expect(host.textContent).toContain("Test");});
test("double click creates one checkout",async()=>{api.post.mockReturnValue(new Promise(()=>{}));await render();await act(async()=>host.querySelector('input[type="checkbox"]').click());await act(async()=>{const b=card("start").querySelector("button");b.click();b.click();});expect(api.post).toHaveBeenCalledTimes(1);});
test("missing configuration blocks payment visibly",async()=>{ready=false;await render();expect(card("pro").querySelector("button").disabled).toBe(true);expect(host.textContent).toContain("en cours de configuration");});
test("quota failure blocks payment",async()=>{api.get.mockImplementation(url=>url==="/whop/config"?Promise.resolve({data:{ready:true}}):Promise.reject(new Error()));await render();expect(card("pro").querySelector("button").disabled).toBe(true);expect(host.textContent).toContain("Impossible de vérifier");});
test("existing subscription uses portal",async()=>{quota={plan:"pro",subscription_tier:"start"};api.post.mockRejectedValue({response:{data:{detail:"Portail test"}}});await render();expect(card("business").querySelector("button").disabled).toBe(true);await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="Gérer mon abonnement").click());expect(api.post).toHaveBeenCalledWith("/payments/portal",{},{headers:{"X-Organization-ID":"org"}});});
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
  await act(async()=>host.querySelector('input[type="checkbox"]').click());
  await act(async()=>card("team").querySelector("button").click());
  expect(api.post).toHaveBeenCalledWith("/whop/checkout",expect.objectContaining({meta_consent:true}),expect.anything());
 } finally {localStorage.removeItem("shiftflow_cookie_consent");}
});
