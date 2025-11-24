const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DocumentModel = {
  async createDocument(userId, payload, tx = prisma) {
    const client = tx;
    const data = {
      userId: Number(userId),
      fileName: payload.fileName || null,
      filePath: payload.filePath || null,
      fileUrl: payload.fileUrl || null,
      mimeType: payload.mimeType || null,
      size: payload.size || null,
      checksum: payload.checksum || null,
      docType: payload.type || null,
      status: payload.status || 'SUBMITTED',
      verified: payload.verified === true,
      verifiedBy: payload.verifiedBy || null,
      verifiedAt: payload.verifiedAt || null,
      notes: payload.notes || null,
    };
    return client.userDocument.create({ data });
  },

  async getDocumentsByUserId(userId, tx = prisma) {
    const client = tx;
    return client.userDocument.findMany({ where: { userId: Number(userId) }, orderBy: { uploadedAt: 'desc' } });
  },

  async getDocumentById(id, tx = prisma) {
    const client = tx;
    return client.userDocument.findUnique({ where: { id: Number(id) } });
  },

  async updateDocument(id, updates, tx = prisma) {
    const client = tx;
    const allowed = [
      'fileName', 'filePath', 'fileUrl', 'mimeType', 'size', 'checksum', 'docType', 'status', 'verified', 'verifiedBy', 'verifiedAt', 'notes'
    ];
    const data = {};
    for (const k of Object.keys(updates)) {
      if (allowed.includes(k)) data[k] = updates[k];
    }
    return client.userDocument.update({ where: { id: Number(id) }, data });
  },

  async deleteDocument(id, tx = prisma) {
    const client = tx;
    return client.userDocument.delete({ where: { id: Number(id) } });
  }
};

module.exports = DocumentModel;
