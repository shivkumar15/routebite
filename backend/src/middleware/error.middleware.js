export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      code: error.code ?? 'INTERNAL_SERVER_ERROR',
      message: statusCode >= 500 ? 'Something went wrong.' : error.message,
    },
  });
}
