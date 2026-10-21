import React, { act } from "react";
import { createRoot } from "react-dom/client";
import OrganizationSettings from "./OrganizationSettings";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }), { virtual: true });
let host, root, data;
beforeEach(() => {
 global.IS_REACT_ACT_ENVIRONMENT=true;
 data={id:"org",name:"AXE Events",avatar:"",role:"owner",team_enabled:false,members:[{id:"u",email:"owner@example.com",role:"owner"}],invitations:[],spaces:[]};
 useAuth.mockReturnValue({user:{id:"u",organization:{id:"org"}},refresh:jest.fn()});
 api.get.mockImplementation(() => Promise.resolve({data}));
 api.post.mockResolvedValue({data:{id:"inv",email:"member@example.com",url:"https://www.shiftflow.io/invite#token=opaque",email_sent:false}});
 api.put.mockResolvedValue({data:{}}); api.delete.mockResolvedValue({data:{}});
 jest.clearAllMocks(); host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);
});
afterEach(async () => {await act(async()=>root.unmount());host.remove();});
async function render() {await act(async()=>root.render(<OrganizationSettings/>));}
async function fill(selector,value) {await act(async()=>{const input=host.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));});}
test("Pro can see invitations but cannot use them", async()=>{
 await render();expect(host.textContent).toContain("Nom de l’organisation");expect(host.textContent).toContain("Invitations disponibles avec Pro Team");
 expect(host.querySelector('input[type="email"]').disabled).toBe(true);
 expect(host.querySelector('a[href="/pricing#team"]')).not.toBeNull();
});
test("Team owner invites and receives an explicit copy link if mail was not sent", async()=>{
 data.team_enabled=true;await render();expect(host.querySelector('input[type="email"]').disabled).toBe(false);
 await fill('input[type="email"]',"member@example.com");await act(async()=>host.querySelectorAll("form")[1].dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(api.post).toHaveBeenCalledWith("/organization/invitations",{email:"member@example.com"});
 expect(host.textContent).toContain("Copiez le lien");expect(host.textContent).not.toContain("Invitation envoyée");
});
test("member can see organization but cannot edit or invite",async()=>{
 data.role="member";data.team_enabled=true;await render();
 expect(host.querySelector('input[type="email"]').disabled).toBe(true);
 expect(host.querySelector('input[maxlength="120"]').disabled).toBe(true);
 expect(host.textContent).not.toContain("Enregistrer l’organisation");
});
test("pending invitations reserve all five collaborator places",async()=>{
 data.team_enabled=true;data.invitations=Array.from({length:5},(_,i)=>({id:String(i),email:`m${i}@example.com`}));await render();
 expect(host.querySelector('input[type="email"]').disabled).toBe(true);expect(host.textContent).toContain("5/5 places");
});
test("organization update only sends the editable name and photo",async()=>{
 await render();await fill('input[maxlength="120"]',"Nouvelle régie");
 await act(async()=>host.querySelector("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(api.put).toHaveBeenCalledWith("/organization",{name:"Nouvelle régie",avatar:""});
});
