import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/http';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function signToken(payload: { sub: string; role: 'ADMIN' | 'CUSTOMER' }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export async function signup(req: any, res: any) {
  const body = SignupSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(400, 'Invalid payload', body.error.flatten());

  const { email, password, name } = body.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'CUSTOMER', name }
  });

  const token = signToken({ sub: user.id, role: user.role });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name, profileImageUrl: user.profileImageUrl }
  });
}

export async function login(req: any, res: any) {
  const body = LoginSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(400, 'Invalid payload', body.error.flatten());

  const { email, password } = body.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, 'Invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  const token = signToken({ sub: user.id, role: user.role });

  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name, profileImageUrl: user.profileImageUrl }
  });
}
