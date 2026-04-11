import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../utils/http";

export async function listMyOrders(req: any, res: any) {
  const userId = req.user.id;
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });
  res.json({ orders });
}

export async function adminListOrders(req: any, res: any) {
  const StatusSchema = z.object({
    status: z
      .enum(["PENDING_PAYMENT", "PLACED", "APPROVED", "CANCELLED"])
      .optional(),
  });
  const q = StatusSchema.safeParse(req.query);
  if (!q.success) throw new ApiError(400, "Invalid query", q.error.flatten());

  const orders = await prisma.order.findMany({
    where: q.data.status ? { status: q.data.status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: { include: { product: true } },
    },
  });
  res.json({ orders });
}

export async function adminPlaceOrder(req: any, res: any) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Order not found");

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "PLACED", paymentStatus: "PAID" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: true,
    },
  });

  res.json({ order: updated });
}

export async function adminApproveOrder(req: any, res: any) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "PLACED")
    throw new ApiError(400, "Only PLACED orders can be approved");

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "APPROVED" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: true,
    },
  });

  res.json({ order: updated });
}

export async function rejectPayment(req: any, res: any) {
  const { id } = req.params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Order not found");
  // if (order.status !== "PLACED")
  //   throw new ApiError(400, "Only PLACED orders can have payment rejected");
  const updated = await prisma.order.update({
    where: { id },
    data: { paymentStatus: "UNPAID", status: "PENDING_PAYMENT" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: true,
    },
  });
  res.json({ order: updated });
}

export async function updateOrderStatus(req: any, res: any) {
  const { id, status } = req.params;
  if (
    ![
      "PENDING_PAYMENT",
      "PLACED",
      "APPROVED",
      "CANCELLED",
      "SHIPPED",
      "DELIVERED",
    ].includes(status)
  ) {
    throw new ApiError(400, "Invalid status");
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status == status) {
    throw new ApiError(400, "Order status is already updated");
  }
  const updated = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: true,
    },
  });
  res.json({ order: updated });
}
