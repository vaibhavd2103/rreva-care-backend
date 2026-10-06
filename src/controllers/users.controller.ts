import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError, parseOrThrow, requireUser } from "../utils/http";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phoneNumber: z.string().min(10).optional(),
});

const userSelect = {
  id: true,
  email: true,
  role: true,
  name: true,
  profileImageUrl: true,
  address: true,
  phoneNumber: true,
  createdAt: true,
} as const;

export async function getMe(req: Request, res: Response): Promise<void> {
  const { id } = requireUser(req);

  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) throw new ApiError(404, "User not found");
  res.json({ user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  // Always operate on the authenticated user – never trust a user id from the body.
  const { id } = requireUser(req);
  const data = parseOrThrow(UpdateUserSchema, req.body);

  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, "User not found");

  const user = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  res.json({ user });
}
