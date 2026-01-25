const documentService = require('./documentService');
const prisma = require("../utils/prismaClient");

const saveSelfie = async (userId, file) => {
  // Delegate to the generic document service
  const selfieDoc = await documentService.uploadDocument(userId, file, 'PHOTO');

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
