import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../utils/http";
import {
  deleteFromCloudinary,
  uploadBufferToCloudinary,
} from "../services/cloudinary";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  price: z.coerce.number().int().positive(),
  mrp: z.coerce.number().int().positive(),
  currency: z.string().min(3).max(3).default("INR"),
  isActive: z.coerce.boolean().optional(),
  ingredients: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  howToUse: z.array(z.string()).optional().default([]),
});

const UpdateSchema = CreateSchema.partial().extend({
  // The client echoes back whichever existing Cloudinary URLs it wants to
  // keep. Omitting this field entirely means "don't touch images at all".
  // multipart/form-data may send a single string or a repeated array —
  // the transform normalises both into string[] | undefined.
  existingImageUrls: z
    .union([z.array(z.string().url()), z.string().url()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return Array.isArray(val) ? val : [val];
    }),
});

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
      ...(parsed.data as any),
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

  const { existingImageUrls, ...fields } = parsed.data;
  console.log("parsed update product:", parsed.data);

  const files = req.files as Express.Multer.File[] | undefined;
  const hasNewFiles = files && files.length > 0;
  const hasImageUpdate = existingImageUrls !== undefined || hasNewFiles;

  let imageUrls: string[] | undefined = undefined;

  if (hasImageUpdate) {
    const keptUrls = existingImageUrls ?? [];

    // Fetch the current product to diff which URLs were removed.
    const current = await prisma.product.findUnique({
      where: { id },
      select: { imageUrls: true },
    });

    if (!current) throw new ApiError(404, "Product not found");

    // Any URL that was stored but is no longer in keptUrls was deleted.
    const deletedUrls = current.imageUrls.filter(
      (url) => !keptUrls.includes(url),
    );

    // Fire-and-forget Cloudinary deletes — don't block the response on this.
    // If a delete fails it's non-critical; you can log and handle separately.
    if (deletedUrls.length > 0) {
      Promise.all(deletedUrls.map(deleteFromCloudinary)).catch((err) =>
        console.error("Cloudinary cleanup failed:", err),
      );
    }

    const uploadedUrls = hasNewFiles
      ? await Promise.all(
          files!.map((file) =>
            uploadBufferToCloudinary(file.buffer, "products"),
          ),
        )
      : [];

    imageUrls = [...keptUrls, ...uploadedUrls];
  }

  try {
    const updateData: any = { ...fields };
    if (imageUrls !== undefined) {
      updateData.imageUrls = imageUrls;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
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

export async function updateProductReview(req: any, res: any) {
  const { id } = req.params;
  const userId = req.user.id;
  const ReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(1).max(1000).optional(),
  });
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid payload", parsed.error.flatten());
  }
  const { rating, comment } = parsed.data;
  const review = await prisma.review.findUnique({
    where: { id, userId },
  });
  if (review) {
    throw new ApiError(400, "Review already exists");
  }
  const newReview = await prisma.review.create({
    data: {
      productId: id,
      userId,
      rating,
      comment,
    },
  });
  res.status(201).json({ review: newReview });
}

export async function getProductReviews(req: any, res: any) {
  const { id } = req.params;
  const reviews = await prisma.review.findMany({
    where: { productId: id },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ reviews });
}

export async function getReviews(req: any, res: any) {
  const reviews = await prisma.review.findMany({
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ reviews });
}
