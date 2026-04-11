import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../utils/http";
import { stripe } from "../services/stripe";
import { env } from "../config/env";

const CreateSessionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().min(1),
      }),
    )
    .min(1),
  totalPrice: z.number().int().positive(),
  address: z.string().min(1),
  phoneNumber: z.string().min(10).max(15),
});

export async function createCheckoutSession(req: any, res: any) {
  const userId = req.user.id;
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success)
    throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  if (products.length !== productIds.length) {
    throw new ApiError(400, "One or more products are invalid or inactive");
  }

  const productById = new Map(products.map((p) => [p.id, p] as const));

  const line_items = parsed.data.items.map((i) => {
    const p = productById.get(i.productId)!;
    return {
      quantity: i.quantity,
      price_data: {
        currency: p.currency,
        unit_amount: p.price,
        product_data: {
          name: p.name,
          description: p.description ?? undefined,
          images: p.imageUrls.length > 0 ? p.imageUrls : undefined,
        },
      },
    };
  });

  // const totalPrice = parsed.data.items.reduce((sum, i) => {
  //   const p = productById.get(i.productId)!;
  //   return sum + p.price * i.quantity;
  // }, 0);
  const totalPrice = parsed.data.totalPrice;

  // Create Order first (pending payment)
  const order = await prisma.order.create({
    data: {
      address: parsed.data.address,
      phoneNumber: parsed.data.phoneNumber,
      userId,
      status: "PENDING_PAYMENT",
      paymentStatus: "UNPAID",
      totalPrice,
      currency: products[0].currency,
      items: {
        create: parsed.data.items.map((i) => {
          const p = productById.get(i.productId)!;
          return {
            productId: p.id,
            quantity: i.quantity,
            unitPrice: p.price,
            nameSnapshot: p.name,
          };
        }),
      },
    },
  });

  return res.status(201).json({
    orderId: order.id,
    message: "Order created. Proceed to payment.",
  });

  // const session = await stripe.checkout.sessions.create({
  //   mode: "payment",
  //   success_url: env.STRIPE_SUCCESS_URL,
  //   cancel_url: env.STRIPE_CANCEL_URL,
  //   customer_email: (await prisma.user.findUnique({ where: { id: userId } }))
  //     ?.email,
  //   line_items,
  //   metadata: {
  //     orderId: order.id,
  //   },
  // });

  // await prisma.order.update({
  //   where: { id: order.id },
  //   data: { stripeSessionId: session.id },
  // });

  // res.status(201).json({
  //   orderId: order.id,
  //   checkoutUrl: session.url,
  // });
}
