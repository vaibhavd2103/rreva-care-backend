import Stripe from 'stripe';
import { env } from '../config/env';
import { stripe } from '../services/stripe';
import { prisma } from '../db/prisma';
import { sendEmail } from '../services/email';

export async function handleStripeWebhook(req: any, res: any) {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { email: true, name: true } }, items: true }
      });

      if (order && order.paymentStatus !== 'PAID') {
        const updated = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PLACED',
            paymentStatus: 'PAID',
            stripePaymentIntentId: paymentIntent ?? undefined
          },
          include: { user: { select: { email: true, name: true } }, items: true }
        });

        // Notify admin
        await sendEmail({
          to: env.ADMIN_EMAIL,
          subject: `New order placed (#${updated.id})`,
          html: `
            <div>
              <h2>New order placed</h2>
              <p><b>Order:</b> ${updated.id}</p>
              <p><b>Customer:</b> ${updated.user.email}${updated.user.name ? ` (${updated.user.name})` : ''}</p>
              <p><b>Total:</b> ${(updated.totalCents / 100).toFixed(2)} ${updated.currency.toUpperCase()}</p>
              <p><b>Status:</b> ${updated.status}</p>
            </div>
          `
        });
      }
    }
  }

  res.json({ received: true });
}
