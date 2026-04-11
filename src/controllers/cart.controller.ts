import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../utils/http";

type AuthRequest = Request & {
  user?: {
    id: string;
    role: "ADMIN" | "CUSTOMER";
  };
};

const AddCartProductSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().positive().default(1),
});

const RemoveCartProductSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(0, "Quantity must be 0 or greater").default(1),
});

async function getOrCreateCart(userId: string) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId, items: { create: [] } },
    });
  }

  return cart;
}

export async function addCartProduct(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const parsed = AddCartProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message || "Invalid request body",
    );
  }

  const { productId, quantity } = parsed.data;

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
  });

  if (!product) {
    throw new ApiError(404, "Product not found or inactive");
  }

  const cart = await getOrCreateCart(userId);

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId,
    },
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        // quantity: existingItem.quantity + quantity,
        quantity: quantity, // Set to the new quantity instead of adding
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });
  }

  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  const totalItems =
    updatedCart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const totalPrice =
    updatedCart?.items.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0,
    ) ?? 0;

  res.status(200).json({
    message: "Product added to cart",
    cart: updatedCart,
    summary: {
      totalItems,
      totalPrice,
      currency: updatedCart?.items[0]?.product.currency ?? "inr",
    },
  });
}

export async function removeCartProduct(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const parsed = RemoveCartProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message || "Invalid request body",
    );
  }

  const { productId, quantity } = parsed.data;

  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId,
    },
  });

  if (!existingItem) {
    throw new ApiError(404, "Product not found in cart");
  }

  if (quantity == 0) {
    await prisma.cartItem.delete({
      where: { id: existingItem.id },
    });
  } else {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: quantity,
      },
    });
  }

  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  const totalItems =
    updatedCart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const totalPrice =
    updatedCart?.items.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0,
    ) ?? 0;

  res.status(200).json({
    message: "Product removed from cart",
    cart: updatedCart,
    summary: {
      totalItems,
      totalPrice,
      currency: updatedCart?.items[0]?.product.currency ?? "inr",
    },
  });
}

export async function getCart(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!cart) {
    return res.status(200).json({
      cart: {
        items: [],
      },
      summary: {
        totalItems: 0,
        totalPrice: 0,
        currency: "inr",
      },
    });
  }

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0,
  );

  res.status(200).json({
    cart,
    summary: {
      totalItems,
      totalPrice,
      currency: cart.items[0]?.product.currency ?? "inr",
    },
  });
}
