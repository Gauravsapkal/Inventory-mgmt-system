import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';
import { ENV } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const issues = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, { message: 'Validation failed', errors: issues }, 422);
    return;
  }

  // Handle Mongoose duplicate key error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const val = err.keyValue ? err.keyValue[field] : '';
    sendError(res, `Duplicate value '${val}' for unique field '${field}'`, 409);
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    sendError(res, messages.join(', '), 400);
    return;
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, `Invalid format for field '${err.path}'`, 400);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid authorization token', 401);
    return;
  }
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Authorization token expired', 401);
    return;
  }

  // General server error
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  if (ENV.NODE_ENV !== 'production') {
    console.error('🔥 Server Error:', err);
  }

  sendError(res, message, statusCode);
}
