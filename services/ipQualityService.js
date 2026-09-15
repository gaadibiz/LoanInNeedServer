const IpQualityModel = require('../models/ipQualityModel');
const UserModel = require('../models/userModel');
const signzyService = require('./signzyService');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');
const prisma = require('../utils/prismaClient');

class IpQualityService {
  /**
   * Helper to extract a single clean IP address from headers or query
   */
  extractIp(ip) {
    if (!ip || typeof ip !== 'string') return '';
    return ip.split(',')[0].trim();
  }

  /**
   * Fetch IP Quality & Risk Score from Signzy and persist the raw response
   * and parsed attributes in IpQualityDetail table.
   *
   * @param {number} userId
   * @param {string} rawIp
   * @param {object} [tx=prisma]
   * @returns {Promise<Object>} The IP quality result
   */
  async fetchAndSaveIpQuality(userId, rawIp, tx = prisma) {
    const user = await UserModel.findUserById(userId, tx);
    if (!user) throw new NotFoundError('User not found');

    const cleanIp = this.extractIp(rawIp);
    if (!cleanIp || cleanIp === '::1' || cleanIp === '127.0.0.1') {
      logger.info(`[IP_QUALITY] Skipped check for local/empty IP: "${cleanIp}" for user ${userId}`);
      return null;
    }

    // Check if details already exist
    const existing = await IpQualityModel.findByUserId(userId, tx);
    if (existing && existing.response && Object.keys(existing.response).length) {
      return existing.response;
    }

    logger.info(`[IP_QUALITY] Fetching Signzy IP quality risk score for user ${userId} (IP: ${cleanIp})`);
    const result = await signzyService.getIpQualityRiskScores(cleanIp);

    await IpQualityModel.saveIpQualityDetails(
      userId,
      {
        ipAddress: cleanIp,
        result,
        response: result,
      },
      tx
    );

    logger.info(`[IP_QUALITY] Successfully saved IP quality risk score for user ${userId}`);
    return result;
  }

  /**
   * Get previously saved IP quality details for a user.
   *
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async getIpQualityDetails(userId) {
    const record = await IpQualityModel.findByUserId(userId);
    if (!record) throw new NotFoundError('IP quality details not found');
    return record;
  }
}

module.exports = new IpQualityService();
