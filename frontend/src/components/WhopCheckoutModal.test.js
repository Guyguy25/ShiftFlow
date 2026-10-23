import React,{act} from "react";
import {createRoot} from "react-dom/client";
import WhopCheckoutModal from "./WhopCheckoutModal";
import {api} from "../lib/api";
let mockEmbedProps,mockComplete,mockRefresh=jest.fn();
jest.mock("@whop/checkout/react",()=>({WhopCheckoutEmbed:props=>{mockEmbedProps=props;mockComplete=props.onComplete;return <div data-testid="provider">{props.sessionId}</div>;}}),{virtual:true});
jest.mock("../context/AuthContext",()=>({useAuth:()=>({refresh:mockRefresh})}));
jest.mock("../lib/api",()=>({api:{post:jest.fn()}}));
let host,root;const checkout={session_id:"ch_test",reference:"reference_test",organization_id:"org_test",organization_name:"AXE Events",environment:"production"};
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);api.post.mockReset();mockRefresh.mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
test("does not grant access from provider callback while server is pending",async()=>{api.post.mockResolvedValue({data:{status:"pending"}});await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete("plan_test","pay_test"));expect(api.post).toHaveBeenCalledWith("/whop/status",{reference:"reference_test",payment_id:"pay_test"},{headers:{"X-Organization-ID":"org_test"}});expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("Vérification");});
test("only verified server status activates success UI",async()=>{api.post.mockResolvedValue({data:{status:"paid"}});await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete("plan_test","pay_test"));expect(mockRefresh).toHaveBeenCalledTimes(1);expect(document.body.textContent).toContain("Abonnement activé");});
test("expired or refunded memberships do not show activation",async()=>{api.post.mockResolvedValue({data:{status:"inactive"}});await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete("plan_test","pay_test"));expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("n’est plus actif");});
test("redirect return verifies the original organization without trusting query fields",async()=>{api.post.mockRejectedValue({response:{status:409}});await act(async()=>root.render(<WhopCheckoutModal checkout={{...checkout,returning:true}} onClose={()=>{}}/>));expect(api.post).toHaveBeenCalledWith("/whop/status",{reference:"reference_test",payment_id:""},{headers:{"X-Organization-ID":"org_test"}});expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("Ouvrez l’organisation");});

test("checkout explicitly keeps the plan currency instead of local currency conversion",async()=>{await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));expect(mockEmbedProps.adaptivePricing).toBe(false);expect(mockEmbedProps.sessionId).toBe("ch_test");});
