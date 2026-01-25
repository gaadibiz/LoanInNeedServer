const prisma = require('../utils/prismaClient');
const { decrypt, generateHmac, compareHmac } = require('../utils/cryptoUtils');
const logger = require('../utils/logger');

// Tolerance for timestamp (300 seconds = 5 mins)
const TIME_TOLERANCE_MS = 300 * 1000;

/**
 * Attribution Middleware
 * Validates ?pid=...&ts=...&sig=... query params.
 * Locks attribution if valid.
 */
const attributionMiddleware = async (req, res, next) => {
    try {
        const { pid, ts, sig } = req.query;
        console.log('[DEBUG] Attribution Middleware - Query Params:', { pid, ts, sig }); // DEBUG LOG

        // If no attribution params, proceed
        if (!pid || !ts || !sig) {
            console.log('[DEBUG] Attribution Middleware - Missing Params'); // DEBUG LOG
            return next();
        }

        logger.info(`[ATTRIBUTION] Checking attribution for PartnerID: ${pid}`);

        // 1. Validate Timestamp
        const now = Date.now();
        const requestTime = parseInt(ts);
        if (isNaN(requestTime) || Math.abs(now - requestTime) > TIME_TOLERANCE_MS) {
            logger.warn(`[ATTRIBUTION] Timestamp invalid or expired. Req: ${requestTime}, Now: ${now}`);
            await logAttribution(pid, 'REJECTED', JSON.stringify({ reason: 'TIMESTAMP_EXPIRED', ts }));
            return next();
        }

        // 2. Fetch Partner to get Secret
        const partner = await prisma.partner.findUnique({
            where: { id: parseInt(pid) }
        });

        if (!partner || !partner.secretKey) {
            logger.warn(`[ATTRIBUTION] Partner not found or no secret key. PID: ${pid}`);
            await logAttribution(parseInt(pid), 'REJECTED', JSON.stringify({ reason: 'PARTNER_INVALID' }));
            return next();
        }

        // 3. Decrypt Secret
        // Assuming secretKey is encrypted in DB as per service logic
        let secretKey;
        try {
            secretKey = decrypt(partner.secretKey);
        } catch (e) {
            // Fallback if plain
            secretKey = partner.secretKey;
        }

        // 4. Recompute HMAC
        const data = `${pid}|${ts}`;
        const computedSig = generateHmac(data, secretKey);

        // 5. Verify Signature
        if (!compareHmac(sig, computedSig)) {
            logger.warn(`[ATTRIBUTION] Signature mismatch. PID: ${pid}`);
            await logAttribution(parseInt(pid), 'REJECTED', JSON.stringify({ reason: 'SIG_MISMATCH', sig }));
            return next();
        }

        // --- VALIDATION SUCCESS ---
        logger.info(`[ATTRIBUTION] Valid attribution detected for PID: ${pid}`);

        // 6. Lock Attribution (Write to Request)
        // Store in req for downstream controllers to use (e.g. during registration)
        req.attribution = {
            partnerId: parseInt(pid),
            source: 'ONLINE_LINK',
            timestamp: new Date()
        };

        // 7. If User is Logged In (unlikely for registration link, but possible)
        if (req.user && !req.user.attributedPartnerId) {
            logger.info(`[ATTRIBUTION] Locking attribution to existing User ${req.user.id}`);
            await prisma.user.update({
                where: { id: req.user.id },
                data: {
                    attributedPartnerId: parseInt(pid),
                    attributionDate: new Date(),
                    attributionType: 'ONLINE_LINK'
                }
            });
            await logAttribution(parseInt(pid), 'CONVERSION', JSON.stringify({ userId: req.user.id, type: 'EXISTING_USER_CLICK' }));
        } else {
            await logAttribution(parseInt(pid), 'CLICK', JSON.stringify({ ip: req.ip }));
        }

        next();

    } catch (err) {
        logger.error('[ATTRIBUTION] Middleware Error', err);
        next(); // Fail open
    }
};

async function logAttribution(partnerId, action, metadata) {
    try {
        await prisma.attributionLog.create({
            data: {
                partnerId: parseInt(partnerId) || 0,
                action,
                metadata
            }
        });
    } catch (e) {
        // Silently fail logging if it crashes, don't block request
        logger.error('Failed to log attribution', e);
    }
}

module.exports = attributionMiddleware;
