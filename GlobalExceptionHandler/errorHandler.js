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

  // If it's an unknown error, don't expose details
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
}

module.exports = errorHandler;
