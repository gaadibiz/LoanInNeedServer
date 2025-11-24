// GlobalExceptionHandler/exception.js

/**
 * Base class for all application-specific errors.
 * Includes a message, HTTP status code, and a flag for operational errors.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;  // HTTP status code
    this.isOperational = true;    // Flag to distinguish operational errors from programming errors

    Error.captureStackTrace(this, this.constructor); // Capture stack trace
  }
}

/**
 * Error for invalid requests due to user input.
 * Example: missing required fields, invalid format.
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

/**
 * Error when a requested resource is not found.
 * Example: user ID or record not found.
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Error for unauthorized access attempts.
 * Example: invalid or missing authentication token.
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Error when the user is forbidden from accessing a resource.
 * Example: user role lacks permission.
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Error when the server cannot process the request due to conflict.
 * Example: duplicate data, version conflicts.
 */
class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

/**
 * Error when an internal server issue occurs.
 * Example: unexpected exceptions, third-party service failures.
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * Error when validation of request data fails.
 * Example: missing or incorrect fields.
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 422);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  ValidationError
};
