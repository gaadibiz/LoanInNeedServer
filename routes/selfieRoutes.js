const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  uploadSelfie,
  getSelfieStatus
} = require("../controllers/selfieController");

/**
 * @route POST /api/selfie/upload
 * @desc Upload selfie for identity verification
 * @access Private
 */
router.post(
  "/upload",
  authenticate,
  upload.fields([{ name: "selfie", maxCount: 1 }]),
  uploadSelfie
);

/**
 * @route GET /api/selfie/status
 * @desc Get selfie upload status
 * @access Private
 */
router.get("/status", authenticate, getSelfieStatus);

module.exports = router;
