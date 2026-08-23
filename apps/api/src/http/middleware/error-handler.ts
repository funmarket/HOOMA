import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;

  const requestId = String(res.locals.requestId || 'unknown');

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId,
        details: error.flatten(),
      },
    });
  }

  console.error('Unhandled API error', { requestId, error });
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    },
  });
};
