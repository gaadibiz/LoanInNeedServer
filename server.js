// server.js

// Import dependencies
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const kycRoutes = require('./routes/kycRoutes'); // ✅ Added KYC routes
const documentVerificationRoutes = require('./routes/documentVerificationRoutes'); // ✅ Added Document routes
const selfieRoutes = require('./routes/selfieRoutes'); // ✅ Added Selfie routes
const logger = require('./utils/logger'); // Winston logger
const errorHandler = require('./GlobalExceptionHandler/errorHandler'); // Central error handler
const { startLosWorker } = require('./scripts/losWorker'); // ✅ LOS Integration Worker

// Load environment variables from .env file
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: false })); // Adjust helmet to allow local static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Enable CORS with specific options
const allowedOrigins = [
  'http://localhost:3000', // Local Frontend (Next.js default)
  'http://localhost:5173', // Local Frontend (Vite default)
  'https://loaninneed.vercel.app', // Production Frontend
  'https://seahorse-app-92emo.ondigitalocean.app', // DigitalOcean Frontend
  'https://loaninneed.in', // New Production Frontend
  'https://www.loaninneed.in', // New Production Frontend (www)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Allow all Vercel preview deployments (*.vercel.app)
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Allow all subdomains of loaninneed.in (*.loaninneed.in)
    if (origin.endsWith('.loaninneed.in') || origin === 'https://loaninneed.in') {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true
}));

// Use morgan with winston for HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Log each incoming request manually (optional, more structured)
app.use((req, res, next) => {
  logger.info('Incoming request: %s %s from %s', req.method, req.originalUrl, req.ip);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  logger.info('Health check endpoint called');
  res.status(200).json({
    status: 'healthy',
    message: 'LoanInNeed Backend is up and running!',
    timestamp: new Date().toISOString()
  });
});

// ✅ Route handlers
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes); // ✅ Mounted KYC
app.use('/api/document', documentVerificationRoutes); // ✅ Mounted Document Verification
app.use('/api/selfie', selfieRoutes); // ✅ Mounted Selfie routes
app.use('/api/partners', require('./routes/partnerRoutes')); // ✅ Mounted Partner routes
app.use('/api/loans', require('./routes/loanRoutes')); // ✅ Mounted Loan routes

// ✅ LOS Bridge Routes
app.use('/api/los', require('./routes/losRoutes')); // ✅ Mounted LOS routes

// ✅ Application Audit Routes
app.use('/api/audit', require('./routes/auditRoutes')); // ✅ Mounted Audit routes

// ✅ Utility Routes
app.use('/api/utils', require('./routes/utilityRoutes')); // ✅ Mounted Utilities (Base64)

// ✅ Global error handler should be last
app.use(errorHandler);

// Define the port
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// ✅ Start Background Workers
startLosWorker();

// Start the server and log startup
app.listen(PORT, HOST, () => {
  logger.info(`Server is running on ${HOST}:${PORT}`);
});

// Handle unexpected errors gracefully
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception: %s', err.stack || err.message);
  process.exit(1); // Optional: exit after logging
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at: %s, reason: %s', promise, reason);
  // Optionally exit process or handle appropriately
});

module.exports = app;
