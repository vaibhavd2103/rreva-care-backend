import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import type { Role, User } from "@prisma/client";

import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { ApiError, parseOrThrow } from "../utils/http";

const EmailSchema = z.string().trim().toLowerCase().email();

const SignupSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(72), // bcrypt ignores bytes beyond 72
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phoneNumber: z.string().min(10).optional(),
});

const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});

// Compared against when the email is unknown so response time doesn't reveal it.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function signToken(payload: { sub: string; role: Role }): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    address: user.address,
    phoneNumber: user.phoneNumber,
  };
}

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, password, name, address, phoneNumber } = parseOrThrow(
    SignupSchema,
    req.body,
  );

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "CUSTOMER", name, address, phoneNumber },
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = parseOrThrow(LoginSchema, req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Invalid credentials");

  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, user: publicUser(user) });
}
