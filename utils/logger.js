/**
 * 🚀 Enterprise-Grade Winston Logger
 * -----------------------------------
 * ✅ Multi-color console output with emojis
 * ✅ Daily file rotation per level
 * ✅ Structured JSON logs for aggregators
 * ✅ Context-based logging (service, userId, requestId)
 * ✅ Express HTTP logging middleware
 * ✅ Optional remote integration: Grafana Loki / ELK / AWS CloudWatch
 */

const { createLogger, format, transports, addColors } = require('winston');
const path = require('path');
const fs = require('fs');
require('winston-daily-rotate-file');

// Optional remote transports
let LokiTransport, CloudWatchTransport, ElasticsearchTransport;
try {
  LokiTransport = require('winston-loki');
  CloudWatchTransport = require('winston-cloudwatch');
  ElasticsearchTransport = require('winston-elasticsearch');
} catch (err) {
  // Optional dependencies
}

// ==============================
// 1️⃣ Create log directories
// ==============================
const baseLogDir = path.join(__dirname, '..', 'logs');
const levels = ['error', 'warn', 'info', 'http', 'debug'];
levels.forEach(level => {
  const dir = path.join(baseLogDir, level);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==============================
// 2️⃣ Colors + Emojis
// ==============================
const logColors = {
  error: 'bold red',
  warn: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'magenta',
};
const levelEmojis = {
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  http: '🌐',
  debug: '🔍',
};
addColors(logColors);

// ==============================
// 3️⃣ Formatters
// ==============================
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, service, context, requestId, userId, stack }) => {
    const emoji = levelEmojis[level] || '';
    const svc = service ? `📦 ${service}` : '';
    const ctx = context ? `🧩 ${context}` : '';
    const req = requestId ? `🔗 req:${requestId}` : '';
    const usr = userId ? `👤 user:${userId}` : '';
    const meta = [svc, ctx, req, usr].filter(Boolean).join(' | ');

    return `${emoji} [${timestamp}] ${level.toUpperCase().padEnd(5)} | ${meta} → ${stack || message}`;
  })
);

const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// ==============================
// 4️⃣ Daily File Transports
// ==============================
const createDailyTransport = (level) => new transports.DailyRotateFile({
  filename: path.join(baseLogDir, level, `%DATE%.${level}.log`),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level,
  format: fileFormat,
});

// ==============================
// 5️⃣ Logger Core
// ==============================
const logger = createLogger({
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  level: process.env.LOG_LEVEL || 'debug',
  transports: [
    ...levels.map(level => createDailyTransport(level)),
    new transports.Console({ format: consoleFormat, handleExceptions: true }),
  ],
  exitOnError: false,
});

// ==============================
// 6️⃣ Contextual Logger Helper
// ==============================
logger.getLogger = (service) => ({
  error: (msg, meta = {}) => logger.error(msg, { ...meta, service }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, service }),
  info: (msg, meta = {}) => logger.info(msg, { ...meta, service }),
  http: (msg, meta = {}) => logger.http(msg, { ...meta, service }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, service }),
});

// ==============================
// 7️⃣ Express HTTP Logger Middleware
// ==============================
logger.httpLogger = () => (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`;
    logger.http(msg, {
      context: 'HTTP',
      userId: req.user?.id || 'guest',
      requestId: req.headers['x-request-id'] || null,
      meta: { userAgent: req.headers['user-agent'] },
    });
  });
  next();
};

// ==============================
// 8️⃣ Optional Remote Integrations
// ==============================
if (process.env.LOKI_URL && LokiTransport) {
  logger.add(new LokiTransport({
    host: process.env.LOKI_URL,
    labels: { app: process.env.APP_NAME || 'MyApp', env: process.env.NODE_ENV || 'development' },
    json: true,
    format: fileFormat,
  }));
}

if (process.env.ELASTICSEARCH_NODE && ElasticsearchTransport) {
  const esTransport = new ElasticsearchTransport({
    level: 'info',
    clientOpts: {
      node: process.env.ELASTICSEARCH_NODE,
      auth: process.env.ELASTICSEARCH_AUTH ? JSON.parse(process.env.ELASTICSEARCH_AUTH) : undefined,
    },
  });
  logger.add(esTransport);
}

if (process.env.CLOUDWATCH_GROUP && CloudWatchTransport) {
  logger.add(new CloudWatchTransport({
    logGroupName: process.env.CLOUDWATCH_GROUP,
    logStreamName: process.env.CLOUDWATCH_STREAM || 'default',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    jsonMessage: true,
  }));
}

module.exports = logger;
