import Stripe from "stripe";
import { env } from "../config/env";
import { ApiError } from "../utils/http";

let client: Stripe | undefined;

/** Lazily creates the Stripe client; throws 503 when Stripe is not configured. */
export function getStripe(): Stripe {
  if (client) return client;
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, "Stripe is not configured");
  }
  client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}
