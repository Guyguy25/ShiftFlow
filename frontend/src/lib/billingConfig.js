// Only public configuration belongs in the frontend. Whop secrets stay on Railway.
export const WHOP_ENABLED = process.env.REACT_APP_PAYMENT_PROVIDER === "whop";
export const PAYMENT_PROVIDER_LABEL = WHOP_ENABLED ? "Whop" : "Stripe";
export const YEARLY = WHOP_ENABLED
  ? { total: "521,40", monthly: "43,45", discount: "45", saving: "426,60" }
  : { total: "711", monthly: "59,25", discount: "25", saving: "237" };
