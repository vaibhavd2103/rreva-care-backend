import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/http";

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, "Route not found"));
}

interface HttpLikeError {
  status?: unknown;
  type?: unknown;
}

function resolveError(err: unknown): { status: number; message: string; details?: unknown } {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message, details: err.details };
  }
  if (err instanceof ZodError) {
    return { status: 400, message: "Invalid payload", details: err.flatten() };
  }
  if (err instanceof multer.MulterError) {
    return { status: 400, message: err.message };
  }
  // body-parser errors (malformed JSON, payload too large, ...)
  if (typeof err === "object" && err !== null) {
    const { status, type } = err as HttpLikeError;
    if (typeof status === "number" && status >= 400 && status < 500) {
      return {
        status,
        message: type === "entity.parse.failed" ? "Malformed JSON body" : "Bad request",
      };
    }
  }
  if (err instanceof Error && err.message === "Only image files are allowed") {
    return { status: 400, message: err.message };
  }
  return { status: 500, message: "Internal server error" };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies error middleware by its 4-argument signature.
  _next: NextFunction,
): void {
  const { status, message, details } = resolveError(err);

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    error: { message, ...(details ? { details } : {}) },
  });
}
