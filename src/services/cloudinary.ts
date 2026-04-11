// import { v2 as cloudinary } from "cloudinary";
// import { env } from "../config/env";

// cloudinary.config({
//   cloud_name: env.CLOUDINARY_CLOUD_NAME,
//   api_key: env.CLOUDINARY_API_KEY,
//   api_secret: env.CLOUDINARY_API_SECRET,
// });

// export { cloudinary };

import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { env } from "../config/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) return reject(new Error("Upload failed"));
        resolve(result.secure_url);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export async function deleteFromCloudinary(url: string): Promise<void> {
  // Extract the public_id from the Cloudinary URL.
  // A typical URL looks like:
  // https://res.cloudinary.com/<cloud>/image/upload/v1234567890/products/abc123.jpg
  // The public_id is everything after /upload/vXXXX/ → "products/abc123"
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  if (!match) return; // not a cloudinary URL, skip

  const publicId = match[1]; // e.g. "products/abc123"
  await cloudinary.uploader.destroy(publicId);
}
