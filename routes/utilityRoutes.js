const express = require('express');
const multer = require('multer');
const { encodeFileToBase64, encodeBufferToBase64 } = require('../utils/base64Encoder');
const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger'); // Assuming this exists

const router = express.Router();

// Configure multer for memory storage (useful for direct buffer encoding without saving to disk)
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * @route POST /api/utils/base64-encode
 * @desc Encodes an uploaded file (document or image) to a Base64 string.
 * @access Public (or protected depending on requirements, kept public for utility)
 */
router.post('/base64-encode', uploadMemory.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded. Please provide a file in the "file" field.'
        });
    }

    try {
        // Check if the user wants the Data URI scheme included
        // They can pass ?dataUri=true in the query string
        const includeDataURI = req.query.dataUri === 'true';

        // Extract mime type from the uploaded file
        const mimeType = req.file.mimetype;

        // Encode the buffer to base64 using our utility
        const base64String = encodeBufferToBase64(req.file.buffer, mimeType, includeDataURI);

        res.status(200).json({
            success: true,
            message: 'File successfully encoded to Base64',
            data: {
                fileName: req.file.originalname,
                mimeType: mimeType,
                size: req.file.size,
                isDataUri: includeDataURI,
                base64: base64String
            }
        });
    } catch (error) {
        logger.error(`Error encoding file to Base64: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'An error occurred while encoding the file.'
        });
    }
}));

module.exports = router;
