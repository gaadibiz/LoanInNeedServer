const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const { UnauthorizedError } = require('../GlobalExceptionHandler/exception');

const protectPartner = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('[PARTNER AUTH] Decoded token:', { id: decoded.id, role: decoded.role });

            // Check if role is PARTNER inside token (optional check, but good for hygiene)
            if (decoded.role && decoded.role !== 'PARTNER') {
                console.log('[PARTNER AUTH] Role mismatch:', decoded.role);
                throw new UnauthorizedError('Not authorized as partner');
            }

            // Get Partner from token
            req.partner = await prisma.partner.findUnique({
                where: { id: decoded.id },
                select: { id: true, name: true, email: true, status: true, partnerType: true }
            });

            if (!req.partner) {
                console.log('[PARTNER AUTH] Partner not found for ID:', decoded.id);
                throw new UnauthorizedError('Partner not found');
            }

            if (req.partner.status === 'SUSPENDED' || req.partner.status === 'REJECTED') {
                console.log('[PARTNER AUTH] Partner status invalid:', req.partner.status);
                throw new UnauthorizedError('Partner account is not active');
            }

            console.log('[PARTNER AUTH] Authentication successful for partner:', req.partner.email);
            next();
        } catch (error) {
            console.error('[PARTNER AUTH] Error:', error.message);
            throw new UnauthorizedError('Not authorized, token failed');
        }
    }

    if (!token) {
        throw new UnauthorizedError('Not authorized, no token');
    }
});

module.exports = { protectPartner };
