import "dotenv/config";
import { z } from "zod";

// Optional integrations: an empty string in .env is treated as "not configured".
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Comma separated list of allowed browser origins. "*" (default) allows all.
  CORS_ORIGINS: z.string().default("*"),
  // Number of reverse proxies in front of the app (Render = 1).
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  // Only needed by `npm run seed`.
  ADMIN_EMAIL: optional(z.string().email()),
  ADMIN_PASSWORD: optional(z.string().min(8)),

  // Stripe (optional – checkout currently creates unpaid orders, admin confirms payment)
  STRIPE_SECRET_KEY: optional(z.string().min(1)),
  STRIPE_WEBHOOK_SECRET: optional(z.string().min(1)),
  STRIPE_SUCCESS_URL: optional(z.string().url()),
  STRIPE_CANCEL_URL: optional(z.string().url()),

  // Email (optional)
  SMTP_HOST: optional(z.string().min(1)),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: optional(z.string().min(1)),
  SMTP_PASS: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.string().min(1)),

  // Cloudinary (optional – required only for image uploads)
  CLOUDINARY_CLOUD_NAME: optional(z.string().min(1)),
  CLOUDINARY_API_KEY: optional(z.string().min(1)),
  CLOUDINARY_API_SECRET: optional(z.string().min(1)),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "Invalid environment configuration:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env: Env = parsed.data;
