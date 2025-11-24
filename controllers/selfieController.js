const SelfieService = require("../services/selfieService");

exports.uploadSelfie = async (req, res) => {
  try {
    const userId = req.user.id;
    const selfieFile = req.files?.selfie?.[0]; // ✅ Multer File

    if (!selfieFile) {
      return res.status(400).json({
        message: "Selfie file is required"
      });
    }

    const result = await SelfieService.saveSelfie(userId, selfieFile);

    res.status(200).json(result);

  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message || "Selfie upload failed"
    });
  }
};

exports.getSelfieStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const status = await SelfieService.getSelfieStatus(userId);

    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch selfie status" });
  }
};
