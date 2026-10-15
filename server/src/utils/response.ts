import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string | any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: ApiResponse['meta']
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    ...(message && { message }),
    data,
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  error: string | any,
  statusCode = 400
): Response {
  const message = typeof error === 'string' ? error : error?.message || 'An error occurred';
  const payload: ApiResponse = {
    success: false,
    error: message,
    ...(typeof error === 'object' && error !== null && !(error instanceof Error) ? { details: error } : {}),
  };
  return res.status(statusCode).json(payload);
}
