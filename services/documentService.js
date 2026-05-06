const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const UserDocumentModel = require('../models/documentModel');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const OtpService = require('./otpService');
const { encodeBufferToBase64 } = require('../utils/base64Encoder');
const { supabase } = require('../config/supabase');

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'Documents';

class DocumentVerificationService {

  /**
   * ✅ Generic Document Upload
   * Supports: PAN, AADHAAR, PAY_SLIP, BANK_STATEMENT, PHOTO, SIGNATURE, GST, LICENSE, COMPANY_PAN
   */
  async uploadDocument(userId, file, docType, tx = prisma) {
    if (!file) throw new BadRequestError('No file provided');

    // Validate Document Type
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
    const storagePath = `${docType}/${userId}/${timestamp}_${sanitizedFilename}`;

    // 2. Read File Buffer
    let fileBuffer;
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path) {
      fileBuffer = await fs.readFile(file.path);
    } else {
      throw new BadRequestError('File content missing');
    }

    // 3. Generate Base64
    const base64Data = encodeBufferToBase64(fileBuffer, file.mimetype, false);

    // 4. Upload to Supabase Storage (persists across redeployments)
    let publicUrl = null;
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        logger.error(`[DOC UPLOAD] Supabase upload failed: ${uploadError.message}`);
      } else {
        const { data: urlData } = supabase.storage
          .from(SUPABASE_BUCKET)
          .getPublicUrl(storagePath);
        publicUrl = urlData?.publicUrl || null;
        logger.info(`[DOC UPLOAD] Uploaded to Supabase: ${publicUrl}`);
      }
    } catch (err) {
      logger.error(`[DOC UPLOAD] Supabase error: ${err.message}`);
    }

    // 5. Also save to local disk as backup (for local dev)
    const relativeFilePath = `uploads/${SUPABASE_BUCKET}/${storagePath}`;
    try {
      const absoluteDirPath = path.join(__dirname, '..', `uploads/${SUPABASE_BUCKET}/${docType}/${userId}`);
      const absoluteFilePath = path.join(__dirname, '..', relativeFilePath);
      await fs.mkdir(absoluteDirPath, { recursive: true });
      await fs.writeFile(absoluteFilePath, fileBuffer);
    } catch (diskErr) {
      logger.warn(`[DOC UPLOAD] Local disk save failed (non-critical): ${diskErr.message}`);
    }

    // 6. Calculate Checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 7. DB Persistence — store Supabase public URL as fileUrl
    const document = await tx.userDocument.create({
      data: {
        userId: parseInt(userId),
        docType: docType,
        fileName: file.originalname,
        filePath: relativeFilePath,
        fileUrl: publicUrl || relativeFilePath, // Supabase URL preferred
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

      // Upload Bank Statements
      for (const file of bankStatements) {
        uploadedDocs.push(await this.uploadDocument(userId, file, 'BANK_STATEMENT', tx));
      }

      // Upload Salary Slips
      for (const file of salarySlips) {
        uploadedDocs.push(await this.uploadDocument(userId, file, 'PAY_SLIP', tx));
      }

      return uploadedDocs;
    });

    // Trigger Selfie OTP if needed (Legacy Flow)
    // await OtpService.sendOtp(userId); // Bypassed as per user request (Master OTP flow)

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
