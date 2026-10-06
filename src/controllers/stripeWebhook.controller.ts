import type { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../config/env";
import { getStripe } from "../services/stripe";
import { prisma } from "../db/prisma";
import { sendEmail } from "../services/email";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    res.status(503).send("Stripe is not configured");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (orderId && /^[a-f\d]{24}$/i.test(orderId)) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (order && order.paymentStatus !== "PAID") {
        const updated = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "PLACED",
            paymentStatus: "PAID",
            stripePaymentIntentId: paymentIntent ?? undefined,
          },
          include: { user: { select: { email: true, name: true } } },
        });

        // Email failures must not make Stripe retry an already-processed event.
        if (env.ADMIN_EMAIL) {
          await sendEmail({
            to: env.ADMIN_EMAIL,
            subject: `New order placed (#${updated.id})`,
            html: `
              <div>
                <h2>New order placed</h2>
                <p><b>Order:</b> ${updated.id}</p>
                <p><b>Customer:</b> ${updated.user.email}</p>
                <p><b>Total:</b> ${(updated.totalPrice / 100).toFixed(2)} ${updated.currency.toUpperCase()}</p>
                <p><b>Status:</b> ${updated.status}</p>
              </div>
            `,
          }).catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.error("Failed to send order email:", err);
          });
        }
      }
    }
  }

  res.json({ received: true });
}
