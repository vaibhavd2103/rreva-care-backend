import { ApiError } from '../utils/http';

export function notFound(_req: any, _res: any, next: any) {
  next(new ApiError(404, 'Route not found'));
}

export function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof ApiError ? err.message : 'Internal server error';

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    error: {
      message,
      ...(err instanceof ApiError && err.details ? { details: err.details } : {})
    }
  });
}
