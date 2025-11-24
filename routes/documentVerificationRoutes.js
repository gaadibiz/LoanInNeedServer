const express = require("express");
const router = express.Router();

const {
  submitDocumentVerification,
  getVerificationStatus,
} = require("../controllers/documentVerificationController");

const {authenticate} = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

/**
 * @route POST /api/document/submit
 * @desc Submit KYC Documents
 * @access Private
 */
router.post(
  "/submit",
  authenticate,
  (req, res, next) => {
    console.log("✅ Upload middleware check:", typeof upload.fields);
    next();
  },
  upload.fields([
    { name: "salarySlips", maxCount: 5 },
    { name: "bankStatements", maxCount: 5 },
    { name: "selfie", maxCount: 1 },
  ]),
  submitDocumentVerification
);

/**
 * @route GET /api/document/status
 * @desc Get document verification status
 * @access Private
 */
router.get("/status", authenticate, getVerificationStatus);

module.exports = router;
