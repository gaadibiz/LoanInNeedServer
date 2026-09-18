const sharp = require('sharp');
const logger = require('./logger');

/**
 * Utility to compress images and documents before saving/uploading.
 */
class DocumentCompressor {
  /**
   * Compress an image buffer using sharp.
   *
   * @param {Buffer} buffer - Original file buffer
   * @param {string} mimeType - MIME type of the file (e.g. 'image/jpeg', 'image/png')
   * @param {Object} [options={}] - Custom compression settings
   * @returns {Promise<{ buffer: Buffer, mimeType: string, size: number, wasCompressed: boolean }>}
   */
  static async compressImage(buffer, mimeType, options = {}) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return { buffer, mimeType, size: buffer ? buffer.length : 0, wasCompressed: false };
    }

    const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!imageMimeTypes.includes(mimeType?.toLowerCase())) {
      // Non-image format (e.g., PDF) - pass through safely
      return { buffer, mimeType, size: buffer.length, wasCompressed: false };
    }

    try {
      const maxWidth = options.maxWidth || 1920;
      const maxHeight = options.maxHeight || 1920;
      const quality = options.quality || 80;

      let pipeline = sharp(buffer, { failOn: 'none' }).rotate(); // auto-orient from EXIF

      // Resize if larger than dimensions while maintaining aspect ratio
      pipeline = pipeline.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });

      let outputMimeType = mimeType;
      const normalizedMime = mimeType.toLowerCase();

      if (normalizedMime === 'image/png') {
        // For PNG, compress with png compression
        pipeline = pipeline.png({ compressionLevel: 8, quality });
      } else if (normalizedMime === 'image/webp') {
        pipeline = pipeline.webp({ quality });
      } else {
        // Default to JPEG compression
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        outputMimeType = 'image/jpeg';
      }

      const compressedBuffer = await pipeline.toBuffer();

      // Only use compressed buffer if it actually reduced or matched size, or if dimensions were resized
      if (compressedBuffer && compressedBuffer.length < buffer.length) {
        logger.info(
          `[COMPRESSOR] Compressed ${mimeType}: ${(buffer.length / 1024).toFixed(1)} KB -> ${(compressedBuffer.length / 1024).toFixed(1)} KB (${(
            ((buffer.length - compressedBuffer.length) / buffer.length) *
            100
          ).toFixed(1)}% reduction)`
        );
        return {
          buffer: compressedBuffer,
          mimeType: outputMimeType,
          size: compressedBuffer.length,
          wasCompressed: true,
        };
      }

      // If compressed is larger or equal, keep the smaller original
      return {
        buffer,
        mimeType,
        size: buffer.length,
        wasCompressed: false,
      };
    } catch (err) {
      logger.warn(`[COMPRESSOR] Compression failed for ${mimeType}, falling back to original: ${err.message}`);
      return {
        buffer,
        mimeType,
        size: buffer.length,
        wasCompressed: false,
      };
    }
  }
}

module.exports = DocumentCompressor;
