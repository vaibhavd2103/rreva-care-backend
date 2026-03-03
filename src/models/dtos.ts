// DTO (Data Transfer Object) types for API responses.
// Note: Database models are defined in prisma/schema.prisma (Prisma + MongoDB).

export type PublicUserDTO = {
  id: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  name?: string | null;
  profileImageUrl?: string | null;
};

export type ProductDTO = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  isActive: boolean;
};
