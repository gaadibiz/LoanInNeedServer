const prisma = require('../utils/prismaClient');
const UserDocumentModel = require('../models/documentModel');
const { supabase } = require('../config/supabase');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const OtpService = require('./otpService');

const SUPABASE_BUCKET = 'Documents';

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

    // 1. Construct Path: Documents/{DOC_TYPE}/{userId}/{timestamp}_{filename}
    // Note: 'Documents' is the bucket name, so we start with docType
    const timestamp = Date.now();
    const sanitizedFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${docType}/${userId}/${timestamp}_${sanitizedFilename}`;

    // 2. Read File
    let fileBuffer;
    if (file.buffer) {
      // Memory Storage
      fileBuffer = file.buffer;
    } else if (file.path) {
      // Disk Storage
      fileBuffer = await fs.readFile(file.path);
    } else {
      throw new BadRequestError('File content missing');
    }

    // 3. Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      throw new BadRequestError(`Upload failed: ${uploadError.message}`);
    }

    // 4. Get Public URL (or Signed URL if we were strictly private, but per existing pattern using Public)
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filePath);

    // 5. Calculate Checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 6. DB Persistence
    const document = await tx.userDocument.create({
      data: {
        userId: parseInt(userId),
        docType: docType,
        fileName: file.originalname,
        filePath: filePath,
        fileUrl: urlData.publicUrl,
        mimeType: file.mimetype,
        size: file.size,
        checksum: checksum,
        status: 'SUBMITTED'
      }
    });

    // 7. Cleanup Temp File (only if disk storage was used)
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (e) {
        console.warn('Failed to delete temp file:', file.path);
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
