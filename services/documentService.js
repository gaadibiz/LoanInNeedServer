const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const UserDocumentModel = require("../models/documentModel");
const { supabase } = require("../config/supabase");
const { BadRequestError } = require("../GlobalExceptionHandler/exception");

const fs = require("fs").promises;
const crypto = require("crypto");
const OtpService = require("./otpService");

class DocumentVerificationService {

  /**
   * Upload Bank Statements + Salary Slips
   * ✅ Selfie NOT uploaded here anymore
   * ✅ After upload → OTP sent for Selfie verification
   * ✅ NO MULTIPLE DOCUMENT LIMIT CHECKS ANYMORE
   */
  async submitDocuments(userId, files) {
    const bankStatements = files?.bankStatements || [];
    const salarySlips = files?.salarySlips || [];

    if (bankStatements.length === 0) {
      throw new BadRequestError("At least one bank statement is required");
    }

    if (salarySlips.length === 0) {
      throw new BadRequestError("At least one salary slip is required");
    }

    const result = await prisma.$transaction(async (tx) => {
      const uploadedDocs = [];

      // ✅ Upload Bank Statements
      for (const file of bankStatements) {
        const filePath = `KycDocs/bank-statements/${userId}/${Date.now()}_${file.originalname}`;
        const doc = await this.storeFile(file, userId, filePath, "BANK_STATEMENT", tx);
        uploadedDocs.push(doc);
      }

      // ✅ Upload Salary Slips
      for (const file of salarySlips) {
        const filePath = `KycDocs/salary-slips/${userId}/${Date.now()}_${file.originalname}`;
        const doc = await this.storeFile(file, userId, filePath, "PAY_SLIP", tx);
        uploadedDocs.push(doc);
      }

      return uploadedDocs;
    });

    // ✅ Send OTP for selfie verification
    await OtpService.sendOtp(userId);

    return {
      message: "Documents uploaded successfully. OTP sent for selfie verification ✅",
      isSelfiePending: true,
      uploadedDocs: result,
    };
  }

  /**
   * Store file in Supabase + Save metadata in DB
   */
  async storeFile(file, userId, filePath, type, tx) {
    const fileBuffer = await fs.readFile(file.path);

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(filePath, fileBuffer);

    if (uploadError) throw new BadRequestError(uploadError.message);

    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(filePath);

    const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const document = await UserDocumentModel.createDocument(
      userId,
      {
        fileName: file.originalname,
        filePath,
        fileUrl: urlData.publicUrl,
        type,
        mimeType: file.mimetype,
        size: file.size,
        checksum,
        status: "SUBMITTED",
      },
      tx
    );

    await fs.unlink(file.path); // ✅ delete temp file
    return document;
  }

  /**
   * Get Document Status
   */
  async getDocumentStatus(userId) {
    const docs = await UserDocumentModel.getDocumentsByUserId(userId);
    const isSelfieUploaded = docs.some((d) => d.type === "PHOTO");

    return {
      docs,
      isSelfieUploaded,
      status: isSelfieUploaded ? "Selfie Completed" : "Pending Selfie Upload",
    };
  }
}

module.exports = new DocumentVerificationService();
