import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/http';

export type JwtPayload = {
  sub: string;
  role: 'ADMIN' | 'CUSTOMER';
};

export function authRequired(req: any, _res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing Authorization header'));
  }

  const token = header.substring('Bearer '.length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

export function requireRole(role: 'ADMIN' | 'CUSTOMER') {
  return (req: any, _res: any, next: any) => {
    if (!req.user) return next(new ApiError(401, 'Unauthenticated'));
    if (req.user.role !== role) return next(new ApiError(403, 'Forbidden'));
    return next();
  };
}
