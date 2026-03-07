import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { signup, login } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/signup", asyncHandler(signup));
authRouter.post("/login", asyncHandler(login));
