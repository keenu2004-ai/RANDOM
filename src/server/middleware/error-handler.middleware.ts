/**
 * THEIAKSHI ENTERPRISE - Centralized Error Handler Middleware
 * Production-safe error responses with no internal details exposed.
 */
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth';

const isProd = process.env.NODE_ENV === 'production';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  const statusCode = err.statusCode || 500;

  // Log full internal details server-side
  if (statusCode >= 500) {
    console.error(`[ERROR] RequestID=${requestId} Status=${statusCode} Path=${req.method} ${req.path}`, {
      message: err.message,
      stack: isProd ? '[redacted]' : err.stack,
      code: err.code,
    });
  }

  // Never expose stack traces, SQL errors or internal paths in production
  const responseBody: any = {
    error: {
      code: err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR'),
      message: statusCode < 500 ? err.message : 'An internal server error occurred.',
      requestId,
    }
  };

  res.status(statusCode).json(responseBody);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.path} was not found.`,
      requestId: (req as any).requestId || 'unknown',
    }
  });
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Use existing X-Request-ID from gateway or generate one
  (req as any).requestId = req.headers['x-request-id'] ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  next();
}
