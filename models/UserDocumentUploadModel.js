const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DocumentUploadModel = {
  
  async uploadDocument(userId, type, fileUrl) {
    return prisma.userDocument.create({
      data: {
        userId,
        type,
        fileUrl,
        status: "PENDING"
      }
    });
  },

  async getUserDocuments(userId) {
    return prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: "desc" }
    });
  },

  async getDocumentByType(userId, type) {
    return prisma.userDocument.findFirst({
      where: { userId, type }
    });
  },

  async updateStatus(documentId, status, remarks = null) {
    return prisma.userDocument.update({
      where: { id: Number(documentId) },
      data: {
        status,
        remarks,
        verifiedAt: status === "APPROVED" ? new Date() : null
      }
    });
  },

  async deleteDocument(documentId) {
    return prisma.userDocument.delete({
      where: { id: Number(documentId) }
    });
  }
};

module.exports = DocumentUploadModel;
