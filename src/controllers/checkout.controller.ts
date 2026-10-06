import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
  ApiError,
  parseObjectId,
  parseOrThrow,
  requireUser,
} from "../utils/http";

const CreateSessionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  address: z.string().min(1),
  phoneNumber: z.string().min(10).max(15),
});

/**
 * Creates an order in PENDING_PAYMENT state. The total is always computed on the
 * server from current product prices – any client supplied total is ignored.
 */
export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  const { id: userId } = requireUser(req);
  const { items, address, phoneNumber } = parseOrThrow(CreateSessionSchema, req.body);

  // Merge duplicate product lines.
  const quantityByProduct = new Map<string, number>();
  for (const item of items) {
    const id = parseObjectId(item.productId, "Product");
    quantityByProduct.set(id, (quantityByProduct.get(id) ?? 0) + item.quantity);
  }

  const productIds = [...quantityByProduct.keys()];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  if (products.length !== productIds.length) {
    throw new ApiError(400, "One or more products are invalid or inactive");
  }

  const currency = products[0]?.currency ?? "inr";
  if (products.some((p) => p.currency.toLowerCase() !== currency.toLowerCase())) {
    throw new ApiError(400, "All products in an order must share one currency");
  }

  const totalPrice = products.reduce(
    (sum, p) => sum + p.price * (quantityByProduct.get(p.id) ?? 0),
    0,
  );

  const order = await prisma.order.create({
    data: {
      address,
      phoneNumber,
      userId,
      status: "PENDING_PAYMENT",
      paymentStatus: "UNPAID",
      totalPrice,
      currency,
      items: {
        create: products.map((p) => ({
          productId: p.id,
          quantity: quantityByProduct.get(p.id) ?? 0,
          unitPrice: p.price,
          nameSnapshot: p.name,
        })),
      },
    },
  });

  res.status(201).json({
    orderId: order.id,
    totalPrice,
    currency,
    message: "Order created. Proceed to payment.",
  });
}
