const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
require('dotenv').config();

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');


// Retrieve SMTP Configurations with sensible defaults and fallbacks
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_USER = process.env.SMTP_USER
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;

/**
 * Create Nodemailer Transporter
 */
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const isGmail = SMTP_HOST.includes('gmail.com');

    transporter = nodemailer.createTransport({
      ...(isGmail
        ? {
          service: 'gmail',
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        }
        : {
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_SECURE,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        }),
      tls: {
        rejectUnauthorized: false,
      },
      family: 4, // Force IPv4 to avoid IPv6 unreachable errors
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return transporter;
}

/**
 * Verify SMTP connection
 */
async function verifyConnection() {
  try {
    const transport = getTransporter();
    await transport.verify();
    logger.info(`✅ [EMAIL SERVICE] SMTP Server is ready at ${SMTP_HOST}:${SMTP_PORT}`);
    return true;
  } catch (error) {
    logger.error(`❌ [EMAIL SERVICE] SMTP Connection error: ${error.message}`);
    return false;
  }
}

/**
 * Generate HTML template for OTP verification email
 * @param {string} otpCode
 * @param {number} expiryMinutes
 */
function getOtpEmailTemplate(otpCode, expiryMinutes = 10) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification - LoanInNeed</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #333333;
    }
    .container {
      max-width: 580px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border: 1px solid #eef2f6;
    }
    .header {
      background: linear-gradient(135deg, #0d3b66 0%, #001e3d 100%);
      padding: 30px 20px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 6px 0 0;
      font-size: 13px;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .content {
      padding: 36px 32px;
      text-align: center;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1e293b;
    }
    .instructions {
      font-size: 15px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .otp-card {
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      padding: 20px;
      margin: 0 auto 28px;
      display: inline-block;
      min-width: 220px;
    }
    .otp-code {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0d3b66;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      margin: 0;
    }
    .expiry-note {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 8px;
    }
    .warning-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      text-align: left;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .warning-box p {
      margin: 0;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
    }
    .footer {
      background: #f8fafc;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #f1f5f9;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer a {
      color: #0d3b66;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LoanInNeed</h1>
      <p>Secure Financial Solutions</p>
    </div>
    <div class="content">
      <div class="greeting">Verify Your Email Address</div>
      <p class="instructions">
        Thank you for choosing LoanInNeed. Use the One-Time Password (OTP) below to verify your email address.
      </p>
      <div class="otp-card">
        <div class="otp-code">${otpCode}</div>
        <div class="expiry-note">Valid for ${expiryMinutes} minutes</div>
      </div>
      <div class="warning-box">
        <p><strong>Security Alert:</strong> Please do NOT share this OTP with anyone. LoanInNeed representatives will never ask for your OTP or password.</p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        If you did not request this verification, please disregard this email or contact our support team immediately.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} LoanInNeed. All rights reserved.<br>
      For support inquiries, reach out to <a href="mailto:information@loaninneed.in">information@loaninneed.in</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send OTP Verification Email
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit OTP
 * @param {number} expiryMinutes - Expiry in minutes (default 10)
 */
async function sendOtpEmail(toEmail, otpCode, expiryMinutes = 10) {
  try {
    const transport = getTransporter();
    console.log("SMTP DETAILS : SMTP_HOST- ", SMTP_HOST, " SMTP_PASS- ", SMTP_PASS, " SMTP_PORT- ", SMTP_PORT, " SMTP_USER- ", SMTP_USER, " SMTP_SECURE- ", SMTP_SECURE)

    const mailOptions = {
      from: SMTP_USER,
      to: toEmail,
      subject: `Your LoanInNeed Email Verification Code: ${otpCode}`,
      text: `Dear Customer, your OTP for LoanInNeed email verification is ${otpCode}. This OTP is valid for ${expiryMinutes} minutes. Please do not share it with anyone.`,
      html: getOtpEmailTemplate(otpCode, expiryMinutes),
    };

    logger.info(`📧 [EMAIL SERVICE] Dispatching OTP email to ${toEmail}`);
    const info = await transport.sendMail(mailOptions);
    logger.info(`✅ [EMAIL SERVICE] OTP email delivered to ${toEmail}. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      to: toEmail,
    };
  } catch (error) {
    console.log(error)
    logger.error(`❌ [EMAIL SERVICE] Failed to send OTP email to ${toEmail}: ${error.message}`);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}

module.exports = {
  sendOtpEmail,
  verifyConnection,
  getTransporter,
};
