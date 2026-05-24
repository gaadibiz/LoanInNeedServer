const express = require("express");
const router = express.Router();

const {
  submitDocumentVerification,
  getVerificationStatus,
} = require("../controllers/documentVerificationController");

const { authenticate } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

/**
 * @route POST /api/document/submit
 * @desc Submit KYC Documents (bulk)
 * @access Private
 */
router.post(
  "/submit",
  authenticate,
  upload.fields([
    { name: "salarySlips", maxCount: 5 },
    { name: "bankStatements", maxCount: 5 },
    { name: "selfie", maxCount: 1 },
  ]),
  submitDocumentVerification
);

const { uploadDocument } = require("../controllers/documentVerificationController");

/**
 * @route POST /api/document/upload/:type
 * @desc Upload a single document by type (e.g., AADHAAR, PAN)
 * @access Private
 */
router.post(
  "/upload/:type",
  authenticate,
  upload.single("file"),
  uploadDocument
);

/**
 * @route GET /api/document/status
 * @desc Get document verification status
 * @access Private
 */
router.get("/status", authenticate, getVerificationStatus);

module.exports = router;
