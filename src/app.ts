import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { notFound, errorHandler } from "./middlewares/error";
import { authRouter } from "./routes/auth.routes";
import { userRouter } from "./routes/users.routes";
import { productRouter } from "./routes/products.routes";
import { checkoutRouter } from "./routes/checkout.routes";
import { adminOrdersRouter } from "./routes/orders.routes";
import { myOrdersRouter } from "./routes/orders.routes";
import { stripeWebhookRouter } from "./routes/stripeWebhook.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(morgan("dev"));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  // Stripe webhooks need raw body
  app.use("/api/webhooks/stripe", stripeWebhookRouter);

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/products", productRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/orders", myOrdersRouter);
  app.use("/api/admin/orders", adminOrdersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
