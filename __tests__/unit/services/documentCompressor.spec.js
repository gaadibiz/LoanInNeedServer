const sharp = require('sharp');
const DocumentCompressor = require('../../../utils/documentCompressor');
const crypto = require('crypto');

// Mock dependencies for documentService
const mockUserDocument = {
  create: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
};

const mockTx = {
  userDocument: mockUserDocument,
};

jest.mock('../../../utils/prismaClient', () => ({
  userDocument: mockUserDocument,
  $transaction: jest.fn((cb) => cb(mockTx)),
}));

jest.mock('../../../utils/s3Client', () => ({
  send: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../services/loanService', () => ({
  checkAndPushBumchumIfReady: jest.fn().mockResolvedValue(true),
}));

const documentService = require('../../../services/documentService');

describe('🗜️ Document Compressor Unit Tests', () => {
  let sampleJpegBuffer;
  let samplePngBuffer;
  let samplePdfBuffer;

  beforeAll(async () => {
    // Generate an uncompressed high-resolution JPEG (2400 x 1800) with noise/gradients
    sampleJpegBuffer = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 120, g: 180, b: 240 },
      },
    })
      .jpeg({ quality: 100 })
      .toBuffer();

    // Generate a PNG image
    samplePngBuffer = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 0.8 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    // Sample dummy PDF buffer
    samplePdfBuffer = Buffer.from('%PDF-1.4 sample pdf binary data stream endstream endobj %%EOF');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DocumentCompressor.compressImage', () => {
    it('✅ should downscale and compress high-resolution JPEG', async () => {
      const result = await DocumentCompressor.compressImage(sampleJpegBuffer, 'image/jpeg');

      expect(result.wasCompressed).toBe(true);
      expect(result.size).toBeLessThan(sampleJpegBuffer.length);
      expect(result.mimeType).toBe('image/jpeg');

      // Verify resized dimensions (within 1920x1920 max bounds)
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1920);
      expect(metadata.height).toBeLessThanOrEqual(1920);
    });

    it('✅ should compress PNG image buffer', async () => {
      const result = await DocumentCompressor.compressImage(samplePngBuffer, 'image/png');

      expect(result.wasCompressed).toBe(true);
      expect(result.size).toBeLessThan(samplePngBuffer.length);
      expect(result.mimeType).toBe('image/png');
    });

    it('✅ should pass through PDF files untouched without compression', async () => {
      const result = await DocumentCompressor.compressImage(samplePdfBuffer, 'application/pdf');

      expect(result.wasCompressed).toBe(false);
      expect(result.size).toBe(samplePdfBuffer.length);
      expect(result.buffer.equals(samplePdfBuffer)).toBe(true);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('✅ should gracefully fall back to original buffer if input is corrupt or invalid image', async () => {
      const corruptBuffer = Buffer.from('corrupt non-image binary data');
      const result = await DocumentCompressor.compressImage(corruptBuffer, 'image/jpeg');

      expect(result.wasCompressed).toBe(false);
      expect(result.size).toBe(corruptBuffer.length);
      expect(result.buffer.equals(corruptBuffer)).toBe(true);
    });
  });

  describe('documentService.uploadDocument with compression', () => {
    it('✅ should compress image and persist compressed metadata in DB', async () => {
      const userId = 42;
      const file = {
        originalname: 'aadhaar_front.jpg',
        mimetype: 'image/jpeg',
        buffer: sampleJpegBuffer,
        size: sampleJpegBuffer.length,
      };

      mockUserDocument.create.mockImplementation(({ data }) => Promise.resolve({ id: 101, ...data }));

      const doc = await documentService.uploadDocument(userId, file, 'AADHAAR', mockTx);

      expect(mockUserDocument.create).toHaveBeenCalledTimes(1);
      const savedData = mockUserDocument.create.mock.calls[0][0].data;

      // The saved size in DB should be less than the original input size
      expect(savedData.size).toBeLessThan(file.size);
      expect(savedData.mimeType).toBe('image/jpeg');
      expect(savedData.docType).toBe('AADHAAR');

      // Checksum matches the compressed buffer
      const expectedChecksum = crypto.createHash('sha256').update(doc.base64Data, 'base64').digest('hex');
      expect(savedData.checksum).toBe(expectedChecksum);
    });

    it('✅ should upload PDF document without altering content', async () => {
      const userId = 42;
      const file = {
        originalname: 'bank_statement.pdf',
        mimetype: 'application/pdf',
        buffer: samplePdfBuffer,
        size: samplePdfBuffer.length,
      };

      mockUserDocument.create.mockImplementation(({ data }) => Promise.resolve({ id: 102, ...data }));

      const doc = await documentService.uploadDocument(userId, file, 'BANK_STATEMENT', mockTx);

      expect(mockUserDocument.create).toHaveBeenCalledTimes(1);
      const savedData = mockUserDocument.create.mock.calls[0][0].data;

      expect(savedData.size).toBe(samplePdfBuffer.length);
      expect(savedData.mimeType).toBe('application/pdf');
    });
  });
});
