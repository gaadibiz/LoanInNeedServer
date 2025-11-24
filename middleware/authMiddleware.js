const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { UnauthorizedError } = require('../GlobalExceptionHandler/exception');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Auth Middleware
 * Logs headers, verifies JWT, attaches req.user
 */
const authenticate = async (req, res, next) => {
  try {
    logger.info(`[AUTH] Incoming Headers: ${JSON.stringify(req.headers)}`);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ [AUTH] Missing or malformed Authorization header');
      throw new UnauthorizedError('Authentication token missing or malformed.');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      logger.error(`❌ [AUTH] JWT verification failed: ${err.message}`, { stack: err.stack });
      throw new UnauthorizedError('Invalid or expired token.');
    }

    logger.debug(`🔑 [AUTH] JWT decoded: ${JSON.stringify(decoded)}`);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      logger.error('❌ [AUTH] User not found in DB');
      throw new UnauthorizedError('User not found.');
    }

    req.user = {
      id: user.id,
      customUserId: user.customUserId,
      email: user.email,
      phone: user.phone,
    };

    logger.info(`✅ [AUTH] req.user set: ${JSON.stringify(req.user)}`);

    next();
  } catch (err) {
    logger.error(`❌ [AUTH] Middleware error: ${err.message}`, { stack: err.stack });
    next(err);
  }
};

module.exports = { authenticate };
