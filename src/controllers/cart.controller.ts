import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
  ApiError,
  parseObjectId,
  parseOrThrow,
  requireUser,
} from "../utils/http";

const AddCartProductSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().positive().default(1),
});

const RemoveCartProductSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(0, "Quantity must be 0 or greater").default(1),
});

const cartInclude = { items: { include: { product: true } } } as const;

async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await prisma.cart.create({ data: { userId } });
  } catch {
    // Concurrent request created it first (unique userId).
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new ApiError(500, "Could not create cart");
    return cart;
  }
}

async function loadCartWithSummary(cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: cartInclude,
  });
  const items = cart?.items ?? [];
  return {
    cart,
    summary: {
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: items.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0,
      ),
      currency: items[0]?.product.currency ?? "inr",
    },
  };
}

export async function addCartProduct(req: Request, res: Response): Promise<void> {
  const { id: userId } = requireUser(req);
  const { productId, quantity } = parseOrThrow(
    AddCartProductSchema,
    req.body,
    "Invalid request body",
  );

  const product = await prisma.product.findFirst({
    where: { id: parseObjectId(productId, "Product"), isActive: true },
  });
  if (!product) throw new ApiError(404, "Product not found or inactive");

  const cart = await getOrCreateCart(userId);

  // Sets the quantity (not increments) so the client can send the desired total.
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    update: { quantity },
    create: { cartId: cart.id, productId: product.id, quantity },
  });

  res.status(200).json({
    message: "Product added to cart",
    ...(await loadCartWithSummary(cart.id)),
  });
}

export async function removeCartProduct(req: Request, res: Response): Promise<void> {
  const { id: userId } = requireUser(req);
  const { productId, quantity } = parseOrThrow(
    RemoveCartProductSchema,
    req.body,
    "Invalid request body",
  );

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, "Cart not found");

  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId: parseObjectId(productId, "Product") },
  });
  if (!existingItem) throw new ApiError(404, "Product not found in cart");

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: existingItem.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity },
    });
  }

  res.status(200).json({
    message: "Product removed from cart",
    ...(await loadCartWithSummary(cart.id)),
  });
}

export async function getCart(req: Request, res: Response): Promise<void> {
  const { id: userId } = requireUser(req);

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    res.status(200).json({
      cart: { items: [] },
      summary: { totalItems: 0, totalPrice: 0, currency: "inr" },
    });
    return;
  }

  res.status(200).json(await loadCartWithSummary(cart.id));
}
