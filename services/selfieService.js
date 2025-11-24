const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { supabase } = require("../config/supabase");
const fs = require("fs").promises;
const crypto = require("crypto");
const { BadRequestError } = require("../GlobalExceptionHandler/exception");

const saveSelfie = async (userId, file) => {
  if (!file) throw new BadRequestError("Selfie upload failed: No file received");

  // ✅ Upload to Supabase Storage
  const filePath = `KycDocs/selfies/${userId}/${Date.now()}_${file.originalname}`;
  const fileBuffer = await fs.readFile(file.path);

  const { error: uploadError } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET)
    .upload(filePath, fileBuffer);

  if (uploadError) {
    await fs.unlink(file.path); // Clean up temp file on error
    throw new BadRequestError(`Selfie upload failed: ${uploadError.message}`);
  }

  // ✅ Get public URL
  const { data: urlData } = supabase.storage
    .from(process.env.SUPABASE_BUCKET)
    .getPublicUrl(filePath);

  // ✅ Generate checksum
  const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // ✅ Save selfie in UserDocument table
  const selfieDoc = await prisma.userDocument.create({
    data: {
      userId,
      docType: "PHOTO",
      fileName: file.originalname,
      filePath: filePath,
      fileUrl: urlData.publicUrl,
      mimeType: file.mimetype,
      size: file.size,
      checksum: checksum,
      status: "SUBMITTED"
    }
  });

  // ✅ Delete temp file
  await fs.unlink(file.path);

  return {
    message: "Selfie uploaded successfully",
    selfie: selfieDoc
  };
};

const getSelfieStatus = async (userId) => {
  const selfie = await prisma.userDocument.findFirst({
    where: { userId, docType: "PHOTO" },
    orderBy: { uploadedAt: "desc" }
  });

  return selfie
    ? { uploaded: true, status: selfie.status }
    : { uploaded: false, status: "PENDING" };
};

module.exports = { saveSelfie, getSelfieStatus };
