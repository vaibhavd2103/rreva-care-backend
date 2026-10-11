import express from "express";
import type { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { notFound, errorHandler } from "./middlewares/error";
import { authRouter } from "./routes/auth.routes";
import { userRouter } from "./routes/users.routes";
import { productRouter } from "./routes/products.routes";
import { checkoutRouter } from "./routes/checkout.routes";
import { adminOrdersRouter, myOrdersRouter } from "./routes/orders.routes";
import { stripeWebhookRouter } from "./routes/stripeWebhook.routes";
import { cartRouter } from "./routes/cart.routes";

function corsOrigin(): cors.CorsOptions["origin"] {
  if (env.CORS_ORIGINS.trim() === "*") return true;
  return env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Render (and most PaaS) sit behind a reverse proxy; needed for correct client IPs.
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: corsOrigin(), credentials: true }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  // Liveness/readiness probes are registered before the rate limiter.
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/health/ready", (_req, res) => {
    prisma.user
      .findFirst({ select: { id: true } })
      .then(() => res.json({ ok: true, db: "up" }))
      .catch(() => res.status(503).json({ ok: false, db: "down" }));
  });

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  // Stricter limit on credential endpoints to slow down brute force.
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 50,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  // Stripe webhooks need the raw body, so mount before express.json()
  app.use("/api/webhooks/stripe", stripeWebhookRouter);

  app.use(express.json({ limit: "1mb" }));

  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/products", productRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/orders", myOrdersRouter);
  app.use("/api/admin/orders", adminOrdersRouter);
  app.use("/api/cart", cartRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
