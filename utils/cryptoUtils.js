const crypto = require('crypto');
const logger = require('./logger');

// Retrieve secure keys from env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_secret_key_32_bytes_long!!'; // Must be 32 bytes
const IV_LENGTH = 16; // AES block size

/**
 * Encrypt Text (AES-256-CBC)
 */
function encrypt(text) {
    if (!text) return null;
    try {
        // Prepare key: check length
        let key = Buffer.from(ENCRYPTION_KEY);
        if (key.length !== 32) {
            // quick fix pad or slice if dev only
            const hash = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
            key = hash;
        }

        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        logger.error('Encryption failed', err);
        throw new Error('Encryption failed');
    }
}

/**
 * Decrypt Text
 */
function decrypt(text) {
    if (!text) return null;
    try {
        let key = Buffer.from(ENCRYPTION_KEY);
        if (key.length !== 32) {
            const hash = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
            key = hash;
        }

        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        logger.error('Decryption failed', err);
        throw new Error('Decryption failed');
    }
}

/**
 * Generate HMAC-SHA256 Signature
 * Data = pid|ts
 */
function generateHmac(data, secretKey) {
    return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

/**
 * Generate Secure Partner Secret (Random 32 bytes hex)
 */
function generatePartnerSecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-Time Comparison
 */
function compareHmac(sig1, sig2) {
    // buffer length check
    const b1 = Buffer.from(sig1);
    const b2 = Buffer.from(sig2);
    if (b1.length !== b2.length) return false;
    return crypto.timingSafeEqual(b1, b2);
}

module.exports = {
    encrypt,
    decrypt,
    generateHmac,
    generatePartnerSecret,
    compareHmac
};
