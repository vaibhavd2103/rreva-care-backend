import { Router } from "express";
import multer from "multer";

import { asyncHandler } from "../utils/http";
import { authRequired } from "../middlewares/auth";
import {
  getMe,
  updateProfile,
  // uploadProfilePhoto,
} from "../controllers/users.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const userRouter = Router();

userRouter.get("/me", authRequired, asyncHandler(getMe));
// userRouter.put(
//   "/me/profile-photo",
//   authRequired,
//   upload.single("file"),
//   asyncHandler(uploadProfilePhoto),
// );
userRouter.post("/update", authRequired, asyncHandler(updateProfile));
