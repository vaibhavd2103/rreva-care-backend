import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authRequired } from "../middlewares/auth";
import { getMe, updateProfile } from "../controllers/users.controller";

export const userRouter = Router();

userRouter.get("/me", authRequired, asyncHandler(getMe));
userRouter.post("/update", authRequired, asyncHandler(updateProfile));
// Also expose the RESTful form of the same operation.
userRouter.put("/me", authRequired, asyncHandler(updateProfile));
