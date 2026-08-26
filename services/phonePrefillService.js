const PhonePrefillModel = require('../models/phonePrefillModel');
const addressDetail = require('../models/adressModel');
const UserModel = require('../models/userModel');
const PanModel = require('../models/panModel');
const signzyService = require('./signzyService');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');
const prisma = require('../utils/prismaClient');

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
   * Fetch prefill details for a user from Signzy (using their phone/name
   * already on file) and persist the raw response as-is in a dedicated table.
   */
  async fetchAndSavePrefillDetails(userId, tx = prisma) {
    const user = await UserModel.findUserById(userId, tx);
    if (!user) throw new NotFoundError('User not found');
    if (!user.phone) throw new BadRequestError('User phone number is required for prefill');

    const { firstName, lastName } = this.splitName(user.name);
    if (!firstName) throw new BadRequestError('User first name is required for prefill');

    const panRecord = await PanModel.findByUserId(userId, tx);

    function getLastTenDigits(phone) {
      const digits = phone.replace(/\D/g, '');
      return digits.slice(-10);
    }
    let phone = getLastTenDigits(user.phone);
    const requestPayload = {
      mobileNumber: phone,
      fullName: 'SATHISH KUMAR',
      consent: {
        consentFlag: 'true',
        consentTimestamp: 1100,
        consentIpAddress: '684D:1111:222:3333:4444:5555:6:77',
        consentMessageId: 'CM_1',
      },
    };

    let response = (await PhonePrefillModel.findByUserId(userId, tx)) || {};
    
    if (Object.keys(response?.response || {}).length) return response?.response

    response = await signzyService.getPhonePrefillDetails(requestPayload);

    let primaryAddress = {};
    let primaryAddressEntry = response?.address?.find((address) => address.Type === 'Primary');
    if (!primaryAddressEntry && response?.address?.length) {
      primaryAddressEntry = response.address.reduce((latest, address) => {
        return new Date(address?.ReportedDate) > new Date(latest?.ReportedDate) ? address : latest;
      });
    }
    if (primaryAddressEntry) {
      try {
        let previous_address = await prisma.addressDetail.findUnique({
          where: { userId },
          select: {
            city: true,
          }
        });
         
        primaryAddress = {
          "city": previous_address?.city || primaryAddressEntry.city,
          "state": primaryAddressEntry.State,
          "postalCode": primaryAddressEntry.Postal,
          "currentAddress": primaryAddressEntry.Address,
          "permanentAddress": primaryAddressEntry.Address,
        }
        await addressDetail.upsertAddress(userId, primaryAddress, tx)
      } catch (e) {
        console.log(e, "[ERROR IN FETCH AND SAVE]")
      }
    }

    const saved = await PhonePrefillModel.savePrefillDetails(userId, {
      phoneNumber: user.phone,
      pan: panRecord?.panNumber,
      firstName,
      lastName,
      response,
    }, tx);

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
