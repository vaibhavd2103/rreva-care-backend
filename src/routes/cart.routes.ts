import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authRequired, requireRole } from "../middlewares/auth";
import {
  addCartProduct,
  removeCartProduct,
  getCart,
} from "../controllers/cart.controller";

export const cartRouter = Router();

cartRouter.post(
  "/items",
  authRequired,
  requireRole("CUSTOMER"),
  asyncHandler(addCartProduct),
);

cartRouter.delete(
  "/itemsRemove",
  authRequired,
  requireRole("CUSTOMER"),
  asyncHandler(removeCartProduct),
);

cartRouter.get(
  "/",
  authRequired,
  requireRole("CUSTOMER"),
  asyncHandler(getCart),
);
