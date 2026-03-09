const fs = require('fs');
const path = require('path');

/**
 * Extracted common MIME types for documents and images 
 * to generate proper Data URIs.
 */
const MIME_TYPES = {
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    // Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/**
 * Encodes a file from the filesystem to a Base64 string.
 * Optionally includes the Data URI scheme (e.g., data:image/png;base64,...).
 * 
 * @param {string} filePath - Absolute or relative path to the file.
 * @param {boolean} includeDataURI - Whether to prepend the data URI scheme (defaults to false).
 * @returns {string} The Base64 encoded string.
 */
function encodeFileToBase64(filePath, includeDataURI = false) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64String = fileBuffer.toString('base64');

    if (includeDataURI) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        return `data:${mimeType};base64,${base64String}`;
    }

    return base64String;
}

/**
 * Encodes a Node.js Buffer to a Base64 string.
 * Useful when files are already in memory (e.g., received via multer).
 * 
 * @param {Buffer} buffer - The file buffer.
 * @param {string} [mimeType='application/octet-stream'] - The MIME type (used if includeDataURI is true).
 * @param {boolean} includeDataURI - Whether to prepend the data URI scheme (defaults to false).
 * @returns {string} The Base64 encoded string.
 */
function encodeBufferToBase64(buffer, mimeType = 'application/octet-stream', includeDataURI = false) {
    if (!Buffer.isBuffer(buffer)) {
        throw new TypeError('Input must be a valid Node.js Buffer');
    }

    const base64String = buffer.toString('base64');

    if (includeDataURI) {
        return `data:${mimeType};base64,${base64String}`;
    }

    return base64String;
}

module.exports = {
    encodeFileToBase64,
    encodeBufferToBase64,
    MIME_TYPES
};
