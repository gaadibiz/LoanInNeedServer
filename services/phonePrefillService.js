const PhonePrefillModel = require('../models/phonePrefillModel');
const addressDetail = require('../models/adressModel');
const UserModel = require('../models/userModel');
const PanModel = require('../models/panModel');
const signzyService = require('./signzyService');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');

class PhonePrefillService {
  /**
   * Split a single "name" field into firstName/lastName the way the
   * Phone Prefill API expects them.
   */
  splitName(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || undefined,
    };
  }

  /**
   * Fetch prefill details for a user from Signzy (using their phone/name/PAN
   * already on file) and persist the raw response as-is in a dedicated table.
   */
  async fetchAndSavePrefillDetails(userId) {
    const user = await UserModel.findUserById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (!user.phone) throw new BadRequestError('User phone number is required for prefill');

    const { firstName, lastName } = this.splitName(user.name);
    if (!firstName) throw new BadRequestError('User first name is required for prefill');

    const panRecord = await PanModel.findByUserId(userId);

    function getLastTenDigits(phone) {
      const digits = phone.replace(/\D/g, '');
      return digits.slice(-10);
    }
    let phone = getLastTenDigits(user.phone);
    const requestPayload = {
      phoneNumber: phone,
      firstName,
      lastName,
      pan: panRecord?.panNumber,
    };

    const response = await signzyService.getPhonePrefillDetails(requestPayload);

    let primaryAddress = {};
    response?.address?.map(async (address) => {
      if (address.Type === 'Primary') {
        try {
          primaryAddress = {
            "state": address.State,
            "postalCode": address.Postal,
            "currentAddress": address.Address,
            "permanentAddress": address.Address,
          }
          await addressDetail.upsertAddress(userId, primaryAddress)
        } catch (e) {
          console.log(e, "----><")
        }
      }
    })

    const saved = await PhonePrefillModel.savePrefillDetails(userId, {
      phoneNumber: user.phone,
      pan: requestPayload.pan,
      firstName,
      lastName,
      response,
    });

    logger.info(`[PHONE_PREFILL] Details fetched and saved for user ${userId}`);

    return response;
  }

  /**
   * Get previously saved prefill details for a user.
   */
  async getPrefillDetails(userId) {
    const record = await PhonePrefillModel.findByUserId(userId);
    if (!record) throw new NotFoundError('Phone prefill details not found');
    return record;
  }
}

module.exports = new PhonePrefillService();
