import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { env } from "../config/env";
import { ApiError } from "../utils/http";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new ApiError(503, "Image uploads are not configured");
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<string> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) {
          reject(new Error(error.message));
        } else if (!result?.secure_url) {
          reject(new Error("Upload failed"));
        } else {
          resolve(result.secure_url);
        }
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export async function deleteFromCloudinary(url: string): Promise<void> {
  // A typical URL looks like:
  // https://res.cloudinary.com/<cloud>/image/upload/v1234567890/products/abc123.jpg
  // The public_id is everything after /upload/vXXXX/ → "products/abc123"
  const match = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/.exec(url);
  const publicId = match?.[1];
  if (!publicId) return; // not a cloudinary URL, skip

  ensureConfigured();
  await cloudinary.uploader.destroy(publicId);
}
