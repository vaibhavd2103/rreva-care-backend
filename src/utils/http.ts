import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Wraps an async handler so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: Handler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

/** Returns the id if it is a valid MongoDB ObjectId, otherwise throws 404. */
export function parseObjectId(value: unknown, what = "Resource"): string {
  const parsed = ObjectIdSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, `${what} not found`);
  return parsed.data;
}

/** Parses data with a zod schema or throws a 400 ApiError. */
export function parseOrThrow<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  data: unknown,
  message = "Invalid payload",
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(400, message, result.error.flatten());
  }
  return result.data;
}

/** Returns the authenticated user or throws 401. */
export function requireUser(req: Request): { id: string; role: "ADMIN" | "CUSTOMER" } {
  if (!req.user) throw new ApiError(401, "Unauthenticated");
  return req.user;
}
