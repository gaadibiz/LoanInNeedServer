// server.js

// Import dependencies
const express = require('express');
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

// Load environment variables from .env file
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet()); // Secure HTTP headers
app.use(cors());   // Enable CORS

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

// ✅ Global error handler should be last
app.use(errorHandler);

// Define the port
const PORT = process.env.PORT || 5000;

// Start the server and log startup
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
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
