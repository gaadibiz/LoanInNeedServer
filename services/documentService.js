const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const UserDocumentModel = require('../models/documentModel');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const OtpService = require('./otpService');
const { encodeBufferToBase64 } = require('../utils/base64Encoder');
const s3Client = require('../utils/s3Client');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const UPLOAD_BUCKET = 'Documents';

class DocumentVerificationService {

  /**
   * ✅ Generic Document Upload
   * Supports: PAN, AADHAAR, PAY_SLIP, BANK_STATEMENT, PHOTO, SIGNATURE, GST, LICENSE, COMPANY_PAN
   */
  async uploadDocument(userId, file, docType, tx = prisma) {
    if (!file) throw new BadRequestError('No file provided');

    const validTypes = [
      'AADHAAR', 'PAN', 'PAY_SLIP', 'BANK_STATEMENT', 'PHOTO',
      'SIGNATURE', 'GST_CERTIFICATE', 'TRADE_LICENSE', 'COMPANY_PAN'
    ];
    if (!validTypes.includes(docType)) {
      throw new BadRequestError(`Invalid document type: ${docType}`);
    }

    // 1. Construct Path
    const timestamp = Date.now();
    const sanitizedFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${docType}/${userId}/${timestamp}_${sanitizedFilename}`;

    // 2. Read File
    let fileBuffer;
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path) {
      fileBuffer = await fs.readFile(file.path);
    } else {
      throw new BadRequestError('File content missing');
    }

    // 3. Generate Base64 (for response only)
    const base64Data = encodeBufferToBase64(fileBuffer, file.mimetype, false);

    // 4 & 5. Save and Public URL
    let relativeFilePath, publicUrl;

    if (process.env.STORAGE_PROVIDER === 's3') {
      const s3Key = `${UPLOAD_BUCKET}/${filePath}`;
      const command = new PutObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ACL: 'public-read',
        ContentType: file.mimetype,
      });

      await s3Client.send(command);
      
      relativeFilePath = s3Key;
      // Depending on endpoint, it might be https://bucket.endpoint/key
      // Ensure we parse out the correct public URL. Assuming endpoints like https://sfo3.digitaloceanspaces.com
      const endpointHost = new URL(process.env.DO_SPACES_ENDPOINT).host; // e.g. sfo3.digitaloceanspaces.com
      publicUrl = `https://${process.env.DO_SPACES_BUCKET}.${endpointHost}/${s3Key}`;
    } else {
      // Local File System Fallback
      relativeFilePath = `uploads/${UPLOAD_BUCKET}/${filePath}`;
      const absoluteDirPath = path.join(__dirname, '..', `uploads/${UPLOAD_BUCKET}/${docType}/${userId}`);
      const absoluteFilePath = path.join(__dirname, '..', relativeFilePath);

      await fs.mkdir(absoluteDirPath, { recursive: true });
      await fs.writeFile(absoluteFilePath, fileBuffer);

      const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      publicUrl = `${appUrl}/${relativeFilePath}`;
    }

    // 6. Checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 7. DB Persistence
    const document = await tx.userDocument.create({
      data: {
        userId: parseInt(userId),
        docType: docType,
        fileName: file.originalname,
        filePath: relativeFilePath,
        fileUrl: publicUrl,
        mimeType: file.mimetype,
        size: file.size,
        checksum: checksum,
        status: 'SUBMITTED'
      }
    });

    document.base64Data = base64Data;

    // 8. Cleanup Temp File
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (e) {
        logger.warn('Failed to delete temp file: ' + file.path);
      }
    }

    return document;
  }

  /**
   * Legacy Support: Bulk upload for Bank Statements & Salary Slips
   */
  async submitDocuments(userId, files) {
    const bankStatements = files?.bankStatements || [];
    const salarySlips = files?.salarySlips || [];

    if (bankStatements.length === 0 && salarySlips.length === 0) {
      throw new BadRequestError('At least one document is required');
    }

    const result = await prisma.$transaction(async tx => {
      const uploadedDocs = [];
      for (const file of bankStatements) {
        uploadedDocs.push(await this.uploadDocument(userId, file, 'BANK_STATEMENT', tx));
      }
      for (const file of salarySlips) {
        uploadedDocs.push(await this.uploadDocument(userId, file, 'PAY_SLIP', tx));
      }
      return uploadedDocs;
    });

    return {
      message: 'Documents uploaded successfully. OTP sent for selfie verification ✅',
      isSelfiePending: true,
      uploadedDocs: result,
    };
  }

  /**
   * Get Document Status
   */
  async getDocumentStatus(userId) {
    const docs = await prisma.userDocument.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { uploadedAt: 'desc' }
    });

    const isSelfieUploaded = docs.some(d => d.docType === 'PHOTO');

    return {
      docs,
      isSelfieUploaded,
      status: isSelfieUploaded ? 'Selfie Completed' : 'Pending Selfie Upload',
    };
  }
}

module.exports = new DocumentVerificationService();
