import React,{act} from "react";
import {createRoot} from "react-dom/client";
import WhopCheckoutModal from "./WhopCheckoutModal";
import {api} from "../lib/api";
let mockElementProps,mockCheckoutProps,mockGlobalProps,mockComplete,mockRefresh=jest.fn();
jest.mock("@whop/elements",()=>({loadWhop:jest.fn(()=>Promise.resolve({}))}));
jest.mock("@whop/elements-react",()=>({
 WhopElements:props=>{mockGlobalProps=props;return props.children;},
 Checkout:props=>{mockCheckoutProps=props;mockComplete=props.onComplete;return props.children;},
 CheckoutElement:props=>{mockElementProps=props;return <div data-testid="provider"/>;}
}));
jest.mock("../context/AuthContext",()=>({useAuth:()=>({refresh:mockRefresh})}));
jest.mock("../lib/api",()=>({api:{post:jest.fn()}}));
let host,root;const checkout={session_id:"ch_test",reference:"reference_test",organization_id:"org_test",organization_name:"AXE Events",environment:"production"};
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);api.post.mockReset();mockRefresh.mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
test("does not grant access from provider callback while server is pending",async()=>{api.post.mockResolvedValue({data:{status:"pending"}});await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete({result:"payment",sessionId:"chs_test",paymentId:"pay_test"}));expect(api.post).toHaveBeenCalledWith("/whop/status",{reference:"reference_test",payment_id:"pay_test"},{headers:{"X-Organization-ID":"org_test"}});expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("Vérification");});
test("only verified server status activates success UI",async()=>{api.post.mockResolvedValue({data:{status:"paid"}});await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete({result:"payment",sessionId:"chs_test",paymentId:"pay_test"}));expect(mockRefresh).toHaveBeenCalledTimes(1);expect(document.body.textContent).toContain("Abonnement activé");});
test("expired or refunded memberships do not show activation",async()=>{api.post.mockResolvedValue({data:{status:"inactive"}});await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete({result:"payment",sessionId:"chs_test",paymentId:"pay_test"}));expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("n’est plus actif");});
test("redirect return verifies the original organization without trusting query fields",async()=>{api.post.mockRejectedValue({response:{status:409}});await act(async()=>root.render(<WhopCheckoutModal checkout={{...checkout,returning:true}} onClose={()=>{}}/>));expect(api.post).toHaveBeenCalledWith("/whop/status",{reference:"reference_test",payment_id:""},{headers:{"X-Organization-ID":"org_test"}});expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("Ouvrez l’organisation");});


test("mounts CheckoutElement inside the dialog with its server configuration",async()=>{
 await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));
 expect(mockCheckoutProps.checkoutConfiguration).toBe("ch_test");expect(mockCheckoutProps.plan).toBeUndefined();
 expect(mockGlobalProps.environment).toBe("production");expect(mockGlobalProps.locale).toBe("fr");
 expect(mockCheckoutProps.returnUrl).toContain("whop_reference=reference_test&organization_id=org_test");
 expect(document.querySelector('[role="dialog"] [data-testid="provider"]')).not.toBeNull();expect(document.querySelector('a')).toBeNull();
});
test.each(["javascript:alert(1)","ch_bad/path"])("invalid configuration %s cannot mount",async session_id=>{
 await act(async()=>root.render(<WhopCheckoutModal checkout={{...checkout,session_id}} onClose={()=>{}}/>));
 expect(document.querySelector('[data-testid="provider"]')).toBeNull();expect(document.body.textContent).toContain("formulaire de paiement est invalide");
});
test("sandbox checkout stays in sandbox",async()=>{
 await act(async()=>root.render(<WhopCheckoutModal checkout={{...checkout,environment:"sandbox"}} onClose={()=>{}}/>));expect(mockGlobalProps.environment).toBe("sandbox");
});
test.each([{result:"waitlist_entry",entryId:"ent_test"},{result:"setup",setupIntentId:"sint_test"},{result:"payment",paymentId:"invalid"}])("non-payment completion never verifies or grants access: %j",async result=>{
 await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockComplete(result));
 expect(api.post).not.toHaveBeenCalled();expect(mockRefresh).not.toHaveBeenCalled();
});
test.each(["failed","canceled"])("off-site %s return does not show success",async payment_status=>{
 const close=jest.fn();await act(async()=>root.render(<WhopCheckoutModal checkout={{...checkout,returning:true,payment_status,payment_id:"pay_test"}} onClose={close}/>));
 expect(api.post).not.toHaveBeenCalled();expect(mockRefresh).not.toHaveBeenCalled();expect(document.body.textContent).toContain("annulé ou refusé");
 await act(async()=>[...document.querySelectorAll("button")].find(b=>b.textContent==="Fermer le formulaire").click());expect(close).toHaveBeenCalledTimes(1);
});
test("successful off-site return verifies payment with server",async()=>{
 api.post.mockResolvedValue({data:{status:"pending"}});
 await act(async()=>root.render(<WhopCheckoutModal checkout={{...checkout,returning:true,payment_status:"succeeded",payment_id:"pay_return"}} onClose={()=>{}}/>));
 expect(api.post).toHaveBeenCalledWith("/whop/status",{reference:"reference_test",payment_id:"pay_return"},{headers:{"X-Organization-ID":"org_test"}});expect(mockRefresh).not.toHaveBeenCalled();
});
test("load failure remains inside the popup",async()=>{
 await act(async()=>root.render(<WhopCheckoutModal checkout={checkout} onClose={()=>{}}/>));await act(async()=>mockGlobalProps.onLoadError(new Error("network")));
 expect(document.body.textContent).toContain("n’a pas pu se charger");expect(document.querySelector('[role="dialog"]')).not.toBeNull();expect(mockRefresh).not.toHaveBeenCalled();
});
