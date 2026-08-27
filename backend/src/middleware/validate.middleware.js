import { validationResult } from 'express-validator';
import { AppError } from '../utils/app-error.js';

export function validateRequest(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  return next(
    new AppError('Request validation failed.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: result.array().map(({ path, msg }) => ({ field: path, message: msg })),
    }),
  );
}
