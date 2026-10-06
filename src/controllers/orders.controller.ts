import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError, parseObjectId, parseOrThrow, requireUser } from "../utils/http";

const OrderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PLACED",
  "APPROVED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

const adminOrderInclude = {
  user: { select: { id: true, email: true, name: true } },
  items: true,
} as const;

export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const { id: userId } = requireUser(req);
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });
  res.json({ orders });
}

export async function adminListOrders(req: Request, res: Response): Promise<void> {
  const { status } = parseOrThrow(
    z.object({ status: OrderStatusSchema.optional() }),
    req.query,
    "Invalid query",
  );

  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: { include: { product: true } },
    },
  });
  res.json({ orders });
}

async function findOrderOrThrow(rawId: unknown) {
  const order = await prisma.order.findUnique({
    where: { id: parseObjectId(rawId, "Order") },
  });
  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

/** Marks an order as paid and placed (manual payment confirmation). */
export async function adminPlaceOrder(req: Request, res: Response): Promise<void> {
  const order = await findOrderOrThrow(req.params.id);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "PLACED", paymentStatus: "PAID" },
    include: adminOrderInclude,
  });
  res.json({ order: updated });
}

export async function adminApproveOrder(req: Request, res: Response): Promise<void> {
  const order = await findOrderOrThrow(req.params.id);
  if (order.status !== "PLACED") {
    throw new ApiError(400, "Only PLACED orders can be approved");
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "APPROVED" },
    include: adminOrderInclude,
  });
  res.json({ order: updated });
}

export async function rejectPayment(req: Request, res: Response): Promise<void> {
  const order = await findOrderOrThrow(req.params.id);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "UNPAID", status: "PENDING_PAYMENT" },
    include: adminOrderInclude,
  });
  res.json({ order: updated });
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const parsed = OrderStatusSchema.safeParse(req.params.status);
  if (!parsed.success) throw new ApiError(400, "Invalid status");
  const status = parsed.data;

  const order = await findOrderOrThrow(req.params.id);
  if (order.status === status) {
    throw new ApiError(400, "Order status is already updated");
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status },
    include: adminOrderInclude,
  });
  res.json({ order: updated });
}
