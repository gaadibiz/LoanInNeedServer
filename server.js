// server.js

// Import dependencies
const express = require('express');
const cluster = require('cluster');
const os = require('os');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
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
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: false })); // Adjust helmet to allow local static files

// Trust proxy (required if running behind DO Load Balancer / Reverse Proxy)
app.set('trust proxy', 1);

// Global Rate Limiting
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 mins
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const globalLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter); // Apply to all API routes

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
  credentials: false
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

// ✅ Idempotency Middleware (Interprets Idempotency-Key headers before routing)
app.use(require('./middleware/idempotencyMiddleware'));

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

// ✅ Utility Routes
app.use('/api/utils', require('./routes/utilityRoutes')); // ✅ Mounted Utilities (Base64)

// ✅ Global error handler should be last
app.use(errorHandler);

// Define the port
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

if (cluster.isPrimary && process.env.NODE_ENV !== 'test') {
  const cpus = os.cpus();
  const cpuCount = (cpus && cpus.length) ? cpus.length : 1;
  // Set max workers based on environment variable (or default to 2 to prevent heavy memory usage on DO app platform)
  const maxWorkers = parseInt(process.env.MAX_CLUSTER_WORKERS) || 2;
  const numCPUs = Math.max(1, Math.min(cpuCount, maxWorkers)); 
  logger.info(`Primary ${process.pid} is running. Forking ${numCPUs} workers for Load Balancing...`);

  // Start Background Workers ONLY on Primary to avoid duplicating Cron/LOS jobs
  startLosWorker();

  // --- Dynamic IPC Global Traffic Controller ---
  const globalActiveTasks = new Map();

  const handleIpcMessage = (worker, msg) => {
    if (msg.cmd && msg.cmd.startsWith('request') && msg.cmd.endsWith('Slot')) {
        const action = msg.cmd.replace('request', '').replace('Slot', '');
        const maxLimit = msg.maxLimit || 10;
        const current = globalActiveTasks.get(action) || 0;
        
        if (current < maxLimit) {
            globalActiveTasks.set(action, current + 1);
            worker.send({ cmd: `${action}SlotGranted`, reqId: msg.reqId });
        } else {
            worker.send({ cmd: `${action}SlotDenied`, reqId: msg.reqId });
        }
    } else if (msg.cmd && msg.cmd.startsWith('release') && msg.cmd.endsWith('Slot')) {
        const action = msg.cmd.replace('release', '').replace('Slot', '');
        const current = globalActiveTasks.get(action) || 0;
        globalActiveTasks.set(action, Math.max(0, current - 1));
    }
  };

  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    worker.on('message', (msg) => handleIpcMessage(worker, msg));
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code: ${code}. Forking a replacement...`);
    const newWorker = cluster.fork();
    newWorker.on('message', (msg) => handleIpcMessage(newWorker, msg));
  });
} else {
  // Worker process or Test environment
  // Start the server and log startup
  const server = app.listen(PORT, HOST, () => {
    logger.info(`Worker ${process.pid} started and listening on ${HOST}:${PORT}`);
  });

  const prisma = require('./utils/prismaClient');

  const gracefulShutdown = (signal) => {
    logger.info(`Worker ${process.pid} received ${signal}. Initiating graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error(`Error closing HTTP server: ${err.message}`);
      } else {
        logger.info(`Worker ${process.pid} HTTP server closed.`);
      }
      
      try {
        await prisma.$disconnect();
        logger.info(`Worker ${process.pid} Prisma disconnected successfully.`);
        process.exit(0);
      } catch (dbErr) {
        logger.error(`Worker ${process.pid} Error disconnecting Prisma: ${dbErr.message}`);
        process.exit(1);
      }
    });

    // Force close after 10 seconds if connections are hanging
    setTimeout(() => {
      logger.error(`Worker ${process.pid} forcefully terminating after 10s timeout.`);
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle unexpected errors gracefully
  process.on('uncaughtException', (err) => {
    logger.error(`Worker ${process.pid} - Uncaught Exception: %s`, err.stack || err.message);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Worker ${process.pid} - Unhandled Rejection at: %s, reason: %s`, promise, reason);
    gracefulShutdown('unhandledRejection');
  });
}

module.exports = app;
