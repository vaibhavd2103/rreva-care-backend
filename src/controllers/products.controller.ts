import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../utils/http";
import { uploadBufferToCloudinary } from "../services/cloudinary";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  price: z.coerce.number().int().positive(),
  currency: z.string().min(3).max(3).default("INR"),
  isActive: z.coerce.boolean().optional(),
  ingredients: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  howToUse: z.array(z.string()).optional().default([]),
});

const UpdateSchema = CreateSchema.partial();

export async function listProducts(_req: any, res: any) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ products });
}

export async function getProduct(req: any, res: any) {
  const { id } = req.params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.isActive) {
    throw new ApiError(404, "Product not found");
  }

  res.json({ product });
}

export async function createProduct(req: any, res: any) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid payload", parsed.error.flatten());
  }

  const files = req.files as Express.Multer.File[] | undefined;

  let imageUrls: string[] = [];

  if (files && files.length > 0) {
    imageUrls = await Promise.all(
      files.map((file) => uploadBufferToCloudinary(file.buffer, "products")),
    );
  }

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      imageUrls,
    },
  });

  res.status(201).json({ product });
}

export async function updateProduct(req: any, res: any) {
  const { id } = req.params;

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid payload", parsed.error.flatten());
  }

  const files = req.files as Express.Multer.File[] | undefined;

  let imageUrls: string[] | undefined = undefined;

  if (files && files.length > 0) {
    imageUrls = await Promise.all(
      files.map((file) => uploadBufferToCloudinary(file.buffer, "products")),
    );
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(imageUrls ? { imageUrls } : {}),
      },
    });

    res.json({ product });
  } catch {
    throw new ApiError(404, "Product not found");
  }
}

export async function deleteProduct(req: any, res: any) {
  const { id } = req.params;

  try {
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch {
    throw new ApiError(404, "Product not found");
  }
}
