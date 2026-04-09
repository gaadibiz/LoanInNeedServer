// GlobalExceptionHandler/errorHandler.js

const { AppError } = require('./exception');

function errorHandler(err, req, res, next) {
  console.error(err.stack); // Log the error stack trace for debugging

  // If it's an operational error thrown intentionally
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

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
