/**
 * Centralized Express error handler. Must be registered last, after all
 * routes and the 404 handler. Logs the error and responds { error: message }
 * with an appropriate status code.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[errorHandler] ${req.method} ${req.originalUrl}:`, err);

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    status = 400;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate key error';
  }

  if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
  }

  res.status(status).json({ error: message });
}

export default errorHandler;