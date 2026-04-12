import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authRequired, requireRole } from "../middlewares/auth";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductReview,
  getProductReviews,
  getReviews,
} from "../controllers/products.controller";
import { upload } from "../middlewares/upload";

export const productRouter = Router();

productRouter.get("/reviews", asyncHandler(getReviews));

productRouter.get("/", asyncHandler(listProducts));

productRouter.get("/:id", asyncHandler(getProduct));

productRouter.get("/:id/reviews", asyncHandler(getProductReviews));

productRouter.post(
  "/",
  authRequired,
  requireRole("ADMIN"),
  upload.array("images", 5),
  asyncHandler(createProduct),
);

productRouter.put(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  upload.array("images", 5),
  asyncHandler(updateProduct),
);

productRouter.delete(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(deleteProduct),
);

productRouter.post(
  "/:id/review",
  authRequired,
  requireRole("CUSTOMER"),
  asyncHandler(updateProductReview),
);
