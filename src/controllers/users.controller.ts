import { ApiError } from '../utils/http';
import { prisma } from '../db/prisma';
import { cloudinary } from '../services/cloudinary';

export async function getMe(req: any, res: any) {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, name: true, profileImageUrl: true, createdAt: true }
  });

  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
}

export async function uploadProfilePhoto(req: any, res: any) {
  const userId = req.user.id;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) throw new ApiError(400, 'Missing file (multipart/form-data field "file")');

  // Basic content-type check
  if (!file.mimetype.startsWith('image/')) {
    throw new ApiError(400, 'Only image uploads are allowed');
  }

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'commerce/profile-photos',
        resource_type: 'image',
        transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }]
      },
      (err, uploadResult) => {
        if (err || !uploadResult) return reject(err);
        resolve(uploadResult as any);
      }
    );
    stream.end(file.buffer);
  });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { profileImageUrl: result.secure_url },
    select: { id: true, email: true, role: true, name: true, profileImageUrl: true }
  });

  res.json({ user: updated });
}
