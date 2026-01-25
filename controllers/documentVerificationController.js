const DocumentVerificationService = require("../services/documentService");

exports.submitDocumentVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files;

    const result = await DocumentVerificationService.submitDocuments(userId, files);

    res.status(200).json(result);
  } catch (err) {
    console.error("Document Submit Error:", err.message);
    res.status(err.statusCode || 500).json({
      message: err.message || "Document upload failed",
    });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    const { type } = req.params;

    if (!file) throw new Error("No file uploaded");

    const result = await DocumentVerificationService.uploadDocument(userId, file, type);

    res.status(200).json({
      message: `${type} uploaded successfully`,
      document: result
    });
  } catch (err) {
    console.error("Single Document Upload Error:", err.message);
    res.status(err.statusCode || 500).json({
      message: err.message || "Document upload failed",
    });
  }
};

exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await DocumentVerificationService.getDocumentStatus(userId);

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch verification status" });
  }
};
