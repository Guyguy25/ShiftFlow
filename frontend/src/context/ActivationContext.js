import { createContext, useContext } from "react";
export const ActivationContext = createContext(null);
export const useActivation = () => useContext(ActivationContext);
