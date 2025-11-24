const AadhaarModel = require("../models/aadhaarModel");
const PanModel = require("../models/panModel");
const UserDocumentModel = require("../models/documentModel");
const { NotFoundError } = require("../GlobalExceptionHandler/exception");

class UserDocumentStatusService {

  async getOverallStatus(userId) {
    const aadhaar = await AadhaarModel.findByUserId(userId);
    const pan = await PanModel.findByUserId(userId);
    const documents = await UserDocumentModel.getDocumentsByUserId(userId);

    const hasDocs = documents && documents.length >= 7;
    const aadhaarVerified = aadhaar?.verified;
    const panVerified = pan?.verified;

    if (!aadhaar || !pan || !hasDocs) return { status: "PENDING_UPLOAD" };
    if (aadhaarVerified && panVerified && docsApproved(documents))
      return { status: "VERIFIED" };

    return { status: "SUBMITTED" };
  }
}

function docsApproved(docs) {
  return docs.every(doc => doc.status === "Approved");
}

module.exports = new UserDocumentStatusService();
