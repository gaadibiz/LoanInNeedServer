const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { UnauthorizedError } = require('../GlobalExceptionHandler/exception');

const authenticate = async (req, res, next) => {
  try {
    logger.info(`[AUTH] Incoming Headers: ${JSON.stringify(req.headers)}`);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or malformed.');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new UnauthorizedError('User not found.');
    }

    req.user = {
      id: user.id,
      customUserId: user.customUserId,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    logger.info(`[AUTH] Authenticated User: ID=${user.id}, Role=${user.role}, Phone=${user.phone}`);

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.message === 'jwt expired') {
      return next(new UnauthorizedError('Session expired. Please log in again.'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid authentication token.'));
    }
    next(err);
  }
};

const admin = (req, res, next) => {
  if (req.user && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return next();
  }
  throw new UnauthorizedError('Not authorized as admin');
};

const superAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  throw new UnauthorizedError('Not authorized as Super Admin');
};

module.exports = {
  authenticate,
  protect: authenticate,
  admin,
  superAdmin,
};
