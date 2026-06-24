// GlobalExceptionHandler/errorHandler.js

const { AppError } = require('./exception');

function errorHandler(err, req, res, next) {
  // If it's an operational error thrown intentionally
  if (err.isOperational) {
    // Log concisely without a massive stack trace for known operational errors
    if (err.statusCode === 401) {
      console.warn(`[AUTH] Unauthorized: ${err.message}`);
    } else {
      console.error(`[OPERATIONAL ERROR] Status: ${err.statusCode} | Message: ${err.message}`);
    }
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  console.error(err.stack); // Log the full error stack trace only for unhandled/unexpected bugs

  // If it's a known Prisma error or any unhandled error, expose the real message instead of hiding it!
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Something went wrong!',
    code: err.code || 'UNKNOWN',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;
