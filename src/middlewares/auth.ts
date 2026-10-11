import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { ApiError } from "../utils/http";

export interface JwtPayload {
  sub: string;
  role: "ADMIN" | "CUSTOMER";
}

const JwtPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["ADMIN", "CUSTOMER"]),
});

export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new ApiError(401, "Missing Authorization header"));
    return;
  }

  const token = header.substring("Bearer ".length);
  try {
    const decoded = JwtPayloadSchema.parse(
      jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }),
    );
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

export function requireRole(role: "ADMIN" | "CUSTOMER") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "Unauthenticated"));
      return;
    }
    if (req.user.role !== role) {
      next(new ApiError(403, "Forbidden"));
      return;
    }
    next();
  };
}
