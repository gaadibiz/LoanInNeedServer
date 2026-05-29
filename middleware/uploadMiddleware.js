const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Storage (conditionally local disk or memory for S3)
let storage;
if (process.env.STORAGE_PROVIDER === 's3') {
  storage = multer.memoryStorage();
} else {
  // Ensure uploads directory exists only if using local storage
  const uploadDir = path.join(__dirname, "../uploads/temp");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    },
  });
}

// Allowed MIME types
const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

// File Filter for validation
const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Allowed: PDF, JPG, PNG."), false);
  }
  cb(null, true);
};

// Max upload size per file (defaults to 10MB)
const maxUploadSizeMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB) || 10;

const upload = multer({ 
  storage: storage,
  limits: { fileSize: maxUploadSizeMb * 1024 * 1024 },
  fileFilter: fileFilter
});

module.exports = upload;
