const axios = require('axios');
const prisma = require('./prismaClient');
const logger = require('./logger');

// SMS API Configuration
const SMS_API_URL = process.env.SMS_API_URL || 'https://omc.speqtrainnov.in/api/json/sendsms/';
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID;
const SMS_ENTITY_ID = process.env.SMS_ENTITY_ID;
const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

/**
 * Generate a random 6-digit OTP code
 */
function generateOtpCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via SMS API
 * @param {string} phone - Phone number with country code (e.g., +919999999999)
 * @returns {Promise<Object>} - API response
 */
async function sendOtp(phone) {
    try {
        // Validate configuration
        if (!SMS_API_KEY || !SMS_SENDER_ID || !SMS_ENTITY_ID || !SMS_TEMPLATE_ID) {
            throw new Error('SMS API configuration is incomplete. Please check environment variables.');
        }

        // Generate OTP code
        const otpCode = generateOtpCode();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // Store OTP in database
        await prisma.otp.create({
            data: {
                phone,
                code: otpCode,
                expiresAt,
                verified: false
            }
        });

        // Prepare SMS content
        const smsContent = `Your OTP for LoanInNeed verification is ${otpCode}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;

        // Prepare API request
        const requestBody = {
            listsms: [
                {
                    sms: smsContent,
                    mobiles: phone,
                    senderid: SMS_SENDER_ID,
                    entityid: SMS_ENTITY_ID,
                    tempid: SMS_TEMPLATE_ID
                }
            ]
        };

        // Send SMS via API
        const response = await axios.post(SMS_API_URL, requestBody, {
            headers: {
                'key': SMS_API_KEY,
                'content-type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        logger.info(`OTP sent successfully to ${phone}. Message ID: ${response.data?.smslist?.sms?.messageid}`);

        return {
            status: 'pending',
            to: phone,
            channel: 'sms',
            messageId: response.data?.smslist?.sms?.messageid,
            message: 'OTP sent successfully'
        };

    } catch (error) {
        logger.error(`SMS OTP send error for ${phone}:`, error.message);

        // Clean up failed OTP from database
        await prisma.otp.deleteMany({
            where: {
                phone,
                verified: false,
                createdAt: {
                    gte: new Date(Date.now() - 60000) // Last 1 minute
                }
            }
        });

        throw new Error(`Failed to send OTP: ${error.message}`);
    }
}

/**
 * Verify OTP code
 * @param {string} phone - Phone number with country code
 * @param {string} code - OTP code to verify
 * @returns {Promise<Object>} - Verification result
 */
async function verifyOtp(phone, code) {
    try {
        // Find the most recent unverified OTP for this phone
        const otpRecord = await prisma.otp.findFirst({
            where: {
                phone,
                code,
                verified: false,
                expiresAt: {
                    gt: new Date() // Not expired
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!otpRecord) {
            logger.warn(`OTP verification failed for ${phone}: Invalid or expired OTP`);
            return {
                status: 'failed',
                to: phone,
                valid: false,
                message: 'Invalid or expired OTP'
            };
        }

        // Mark OTP as verified
        await prisma.otp.update({
            where: { id: otpRecord.id },
            data: { verified: true }
        });

        logger.info(`OTP verified successfully for ${phone}`);

        return {
            status: 'approved',
            to: phone,
            valid: true,
            message: 'OTP verified successfully'
        };

    } catch (error) {
        logger.error(`OTP verification error for ${phone}:`, error.message);
        throw new Error(`Failed to verify OTP: ${error.message}`);
    }
}

/**
 * Clean up expired OTPs from database
 * Should be called periodically (e.g., via cron job)
 */
async function cleanupExpiredOtps() {
    try {
        const result = await prisma.otp.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });

        logger.info(`Cleaned up ${result.count} expired OTP records`);
        return result.count;
    } catch (error) {
        logger.error('Error cleaning up expired OTPs:', error.message);
        throw error;
    }
}

module.exports = {
    sendOtp,
    verifyOtp,
    cleanupExpiredOtps,
    generateOtpCode // Exported for testing
};
