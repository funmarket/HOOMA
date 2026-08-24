import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

type ZodErrorLike = {
  name: 'ZodError';
  issues: unknown[];
  flatten: () => unknown;
};

function isZodError(error: unknown): error is ZodErrorLike {
  if (error instanceof ZodError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<ZodErrorLike>;
  return (
    candidate.name === 'ZodError' &&
    Array.isArray(candidate.issues) &&
    typeof candidate.flatten === 'function'
  );
}

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

  if (isZodError(error)) {
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
