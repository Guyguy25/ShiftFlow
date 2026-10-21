import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Pricing from "./Pricing";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
jest.mock("../lib/api",()=>({api:{get:jest.fn(),post:jest.fn()},formatApiError:v=>v}));
jest.mock("../context/AuthContext",()=>({useAuth:jest.fn()}));
jest.mock("../components/StripeCheckoutModal",()=>({__esModule:true,default:()=>null}));
jest.mock("react-router-dom",()=>({Link:({to,children,...props})=><a href={to} {...props}>{children}</a>}),{virtual:true});
let host,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);useAuth.mockReturnValue({user:{id:"u",plan:"free",can_manage_billing:true}});api.get.mockImplementation(url=>Promise.resolve({data:url==="/payments/config"?{publishable_key:"pk_test_public"}:{plan:"free",free_missions_remaining:0}}));api.post.mockReset();api.post.mockRejectedValue({response:{data:{detail:"test"}}});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(){await act(async()=>root.render(<Pricing/>));}
test("Team monthly uses its own Stripe lookup and keeps Pro unchanged",async()=>{
 await render();expect(host.querySelector('[data-testid="pricing-card-team"]').textContent).toContain("89 €");
 await act(async()=>host.querySelector('input[type="checkbox"]').click());await act(async()=>host.querySelector('[data-testid="pricing-team-cta"]').click());
 expect(api.post).toHaveBeenCalledWith("/payments/checkout",expect.objectContaining({lookup_key:"shiftflow_team_monthly",promo_code:"",ui_mode:"embedded"}));
});
test("Team annual states the full 747.60 charge and 30 percent discount",async()=>{
 await render();await act(async()=>host.querySelector('button[aria-label="Annuel Team · −30 %"]').click());
 const card=host.querySelector('[data-testid="pricing-card-team"]');expect(card.textContent).toContain("747,60 € payés en une fois");expect(card.textContent).toContain("62,30 €");
 await act(async()=>host.querySelector('input[type="checkbox"]').click());await act(async()=>host.querySelector('[data-testid="pricing-team-cta"]').click());
 expect(api.post).toHaveBeenCalledWith("/payments/checkout",expect.objectContaining({lookup_key:"shiftflow_team_yearly"}));
});
test("existing Pro owner can manage an upgrade instead of buying twice",async()=>{
 useAuth.mockReturnValue({user:{id:"u",plan:"pro",subscription_tier:"pro",can_manage_billing:true}});api.get.mockResolvedValue({data:{plan:"pro",subscription_tier:"pro"}});await render();
 expect(host.querySelector('[data-testid="pricing-team-cta"]').disabled).toBe(false);
 await act(async()=>host.querySelector('[data-testid="pricing-team-cta"]').click());
 expect(api.post).toHaveBeenCalledWith("/payments/portal",{});expect(api.post).not.toHaveBeenCalledWith("/payments/checkout",expect.anything());
});
test("collaborators cannot buy or modify their organization's subscription",async()=>{
 useAuth.mockReturnValue({user:{id:"u",plan:"pro",subscription_tier:"team",can_manage_billing:false}});api.get.mockResolvedValue({data:{plan:"pro",subscription_tier:"team"}});await render();
 expect(host.querySelector('[data-testid="pricing-team-cta"]').disabled).toBe(true);expect(host.querySelector('[data-testid="pricing-monthly-cta"]').disabled).toBe(true);
});
