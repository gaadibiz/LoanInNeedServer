// middleware/botProtection.js
const logger = require('../utils/logger');

// Signatures for known CLI tools, scrapers, and scripted HTTP clients
const SCRIPTED_USER_AGENTS = [
  /curl\//i,
  /wget/i,
  /python/i,          // python-requests, urllib, aiohttp, httpx
  /postmanruntime/i,
  /insomnia/i,
  /go-http-client/i,
  /node-fetch/i,
  /undici/i,
  /axios\//i,
  /libwww-perl/i,
  /httpclient/i,
  /scrapy/i,
  /java\//i,
  /apache-httpclient/i,
];

/**
 * Validates if a URL string (from Origin or Referer) belongs to an allowed frontend domain.
 * @param {string} urlStr
 * @returns {boolean}
 */
const isAllowedOriginOrReferer = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Localhost & internal IP addresses for development
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    ) {
      return true;
    }

    // Allowed domains & subdomains
    if (
      hostname === 'loaninneed.in' ||
      hostname.endsWith('.loaninneed.in') ||
      hostname === 'naveenfinance.com' ||
      hostname.endsWith('.naveenfinance.com') ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.ondigitalocean.app') ||
      hostname === 'talkapiprod.bumchumfinserve.com'
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Express middleware to block automated script clients and enforce legitimate origin headers
 * on sensitive endpoints (e.g. OTP request / verification).
 */
const botProtection = (req, res, next) => {
  // Allow disabling via environment variable if needed
  if (process.env.ENABLE_BOT_PROTECTION === 'false') {
    return next();
  }

  // Bypass for automated Jest integration tests unless explicitly enabled for testing
  if (process.env.NODE_ENV === 'test' && !req.headers['x-enforce-bot-protection']) {
    return next();
  }

  const userAgent = req.get('User-Agent') || '';
  const origin = req.get('Origin') || '';
  const referer = req.get('Referer') || '';

  // 1. Validate User-Agent exists and has reasonable length
  if (!userAgent || userAgent.trim().length < 5) {
    logger.warn(`[BOT BLOCKED] Empty or invalid User-Agent | IP: ${req.ip} | URL: ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied: missing or invalid User-Agent header.'
    });
  }

  // 2. Reject known script/bot User-Agents
  const isScripted = SCRIPTED_USER_AGENTS.some((pattern) => pattern.test(userAgent));
  if (isScripted) {
    logger.warn(`[BOT BLOCKED] Scripted User-Agent: "${userAgent}" | IP: ${req.ip} | URL: ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied: automated requests are prohibited.'
    });
  }

  // 3. Enforce legitimate Origin or Referer
  const hasValidOrigin = isAllowedOriginOrReferer(origin);
  const hasValidReferer = isAllowedOriginOrReferer(referer);

  if (!hasValidOrigin && !hasValidReferer) {
    logger.warn(`[BOT BLOCKED] Missing or unauthorized Origin/Referer | Origin: "${origin}" | Referer: "${referer}" | IP: ${req.ip} | URL: ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied: unauthorized request origin.'
    });
  }

  next();
};

module.exports = {
  botProtection,
  isAllowedOriginOrReferer,
  SCRIPTED_USER_AGENTS
};
