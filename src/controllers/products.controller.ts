import { z } from 'zod';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/http';

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('eur'),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional()
});

const UpdateSchema = CreateSchema.partial();

export async function listProducts(_req: any, res: any) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ products });
}

export async function getProduct(req: any, res: any) {
  const { id } = req.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
  res.json({ product });
}

export async function createProduct(req: any, res: any) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid payload', parsed.error.flatten());

  const product = await prisma.product.create({ data: parsed.data });
  res.status(201).json({ product });
}

export async function updateProduct(req: any, res: any) {
  const { id } = req.params;
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid payload', parsed.error.flatten());

  try {
    const product = await prisma.product.update({ where: { id }, data: parsed.data });
    res.json({ product });
  } catch {
    throw new ApiError(404, 'Product not found');
  }
}

export async function deleteProduct(req: any, res: any) {
  const { id } = req.params;
  // soft delete
  try {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    res.status(204).send();
  } catch {
    throw new ApiError(404, 'Product not found');
  }
}
