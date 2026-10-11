import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
  ApiError,
  parseObjectId,
  parseOrThrow,
  requireUser,
} from "../utils/http";
import {
  deleteFromCloudinary,
  uploadBufferToCloudinary,
} from "../services/cloudinary";

// multipart/form-data sends everything as strings, so booleans and arrays need
// explicit normalisation (z.coerce.boolean() would turn "false" into true).
const formBoolean = z.preprocess((v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return v;
}, z.boolean());

/** Accepts string[], a single string, or a JSON-encoded array string. */
const formStringArray = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return v;
    }
  }
  return trimmed === "" ? [] : [trimmed];
}, z.array(z.string()));

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  price: z.coerce.number().int().positive(),
  mrp: z.coerce.number().int().positive(),
  currency: z.string().length(3).default("INR"),
  isActive: formBoolean.optional(),
  ingredients: formStringArray.optional().default([]),
  benefits: formStringArray.optional().default([]),
  howToUse: formStringArray.optional().default([]),
});

const UpdateSchema = z.object({
  name: CreateSchema.shape.name.optional(),
  description: CreateSchema.shape.description.optional(),
  price: CreateSchema.shape.price.optional(),
  mrp: CreateSchema.shape.mrp.optional(),
  currency: z.string().length(3).optional(),
  isActive: formBoolean.optional(),
  ingredients: formStringArray.optional(),
  benefits: formStringArray.optional(),
  howToUse: formStringArray.optional(),
  // The client echoes back whichever existing Cloudinary URLs it wants to
  // keep. Omitting this field entirely means "don't touch images at all".
  existingImageUrls: z.preprocess(
    (v) => (typeof v === "string" ? [v] : v),
    z.array(z.string().url()).optional(),
  ),
});

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000).optional(),
});

function uploadedFiles(req: Request): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

export async function listProducts(_req: Request, res: Response): Promise<void> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ products });
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id, "Product");

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product?.isActive) throw new ApiError(404, "Product not found");

  res.json({ product });
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const data = parseOrThrow(CreateSchema, req.body);
  const files = uploadedFiles(req);

  const imageUrls = await Promise.all(
    files.map((file) => uploadBufferToCloudinary(file.buffer, "products")),
  );

  const product = await prisma.product.create({
    data: { ...data, imageUrls },
  });

  res.status(201).json({ product });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id, "Product");
  const { existingImageUrls, ...fields } = parseOrThrow(UpdateSchema, req.body);

  const current = await prisma.product.findUnique({
    where: { id },
    select: { imageUrls: true },
  });
  if (!current) throw new ApiError(404, "Product not found");

  const files = uploadedFiles(req);
  let imageUrls: string[] | undefined;

  if (existingImageUrls !== undefined || files.length > 0) {
    const keptUrls = existingImageUrls ?? current.imageUrls;

    // Any URL that was stored but is no longer kept was removed by the client.
    const deletedUrls = current.imageUrls.filter((url) => !keptUrls.includes(url));

    const uploadedUrls = await Promise.all(
      files.map((file) => uploadBufferToCloudinary(file.buffer, "products")),
    );

    // Best-effort cleanup – don't block the response or fail the request.
    if (deletedUrls.length > 0) {
      Promise.all(deletedUrls.map(deleteFromCloudinary)).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Cloudinary cleanup failed:", err);
      });
    }

    imageUrls = [...keptUrls, ...uploadedUrls];
  }

  const product = await prisma.product.update({
    where: { id },
    data: { ...fields, ...(imageUrls ? { imageUrls } : {}) },
  });

  res.json({ product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id, "Product");

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Product not found");

  // Soft delete keeps historical orders/reviews intact.
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  res.status(204).send();
}

export async function updateProductReview(req: Request, res: Response): Promise<void> {
  const productId = parseObjectId(req.params.id, "Product");
  const { id: userId } = requireUser(req);
  const { rating, comment } = parseOrThrow(ReviewSchema, req.body);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { isActive: true },
  });
  if (!product?.isActive) throw new ApiError(404, "Product not found");

  const existing = await prisma.review.findFirst({
    where: { productId, userId },
    select: { id: true },
  });
  if (existing) throw new ApiError(400, "Review already exists");

  const review = await prisma.review.create({
    data: { productId, userId, rating, comment },
  });
  res.status(201).json({ review });
}

export async function getProductReviews(req: Request, res: Response): Promise<void> {
  const productId = parseObjectId(req.params.id, "Product");
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ reviews });
}

export async function getReviews(_req: Request, res: Response): Promise<void> {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ reviews });
}
