/**
 * Wraps an async Express handler so any thrown error or rejected promise
 * is forwarded to next(err) instead of crashing the process.
 */
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;