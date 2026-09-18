const prisma = require('../utils/prismaClient');
const AadhaarModel = require('../models/aadhaarModel');
const AddressModel = require('../models/adressModel');
const UserModel = require('../models/userModel');
const signzyService = require('./signzyService');
const documentService = require('./documentService');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');

const decodeProviderFile = (value) => {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;

  const encoded = String(value).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;

  return Buffer.from(encoded, 'base64');
};

const uploadDigilockerDocument = async (userId, tx, { value, docType, filename, mimetype }) => {

  const buffer = decodeProviderFile(value);
  if (!buffer) return null;

  const existing = await tx.userDocument.findFirst({
    where: {
      userId: Number(userId),
      docType,
      fileName: filename,
    },
  });
  console.log("existing", existing)
  if (existing) return existing;

  return documentService.uploadDocument(userId, {
    buffer,
    originalname: filename,
    mimetype,
    size: buffer.length,
  }, docType, tx);
};

class AadhaarService {

  /**
   * Mask Aadhaar number - shows only last 4 digits
   * Example: 1234 5678 9012 -> ********9012
   */
  maskAadhaar(aadhaar) {
    return aadhaar.replace(/.(?=....)/g, "*");
  }

  /**
   * Validate Aadhaar number format
   * Format: Must be 12 digits starting with 2-9
   */
  validateAadhaarFormat(aadhaar) {
    const regex = /^[2-9]{1}[0-9]{11}$/;
    return regex.test(aadhaar);
  }

  /**
   * Submit Aadhaar number - creates or updates record
   */
  async submitAadhaar(userId, number) {
    if (!number) throw new BadRequestError("Aadhaar number is required");

    // Remove spaces if any
    const cleanedNumber = number.toString().replace(/\s/g, '');

    if (!this.validateAadhaarFormat(cleanedNumber)) {
      throw new BadRequestError("Invalid Aadhaar number format. Must be 12 digits starting with 2-9");
    }

    // Do not mask the Aadhaar before storing as per new requirement
    const finalAadhaar = cleanedNumber;

    return prisma.$transaction(async (tx) => {
      const existing = await AadhaarModel.findByUserId(userId, tx);

      if (existing) {
        // Update existing record — try to update with real number
        try {
          return await AadhaarModel.updateAadhaarRecord(userId, {
            aadhaarNumber: finalAadhaar
          }, tx);
        } catch (err) {
          if (err.code === 'P2002') {
            throw new BadRequestError("This Aadhaar number is already registered with another account.");
          }
          throw err;
        }
      }

      // Create new record
      try {
        return await AadhaarModel.createAadhaarRecord(userId, finalAadhaar, tx);
      } catch (err) {
        if (err.code === 'P2002') {
          throw new BadRequestError("This Aadhaar number is already registered with another account.");
        }
        throw err;
      }
    });
  }

  /**
   * Get Aadhaar verification status
   */
  async getAadhaarStatus(userId) {
    const record = await AadhaarModel.findByUserId(userId);
    if (!record) throw new NotFoundError("Aadhaar not submitted");

    return {
      aadhaarNumber: record.aadhaarNumber, // already masked in DB
      verified: record.verified,
      verifiedAt: record.verifiedAt,
      submittedAt: record.createdAt || null
    };
  }

  /**
   * Verify Aadhaar - typically called by admin/automated system
   */
  async verifyAadhaar(userId) {
    return prisma.$transaction(async (tx) => {
      const existing = await AadhaarModel.findByUserId(userId, tx);
      if (!existing) throw new NotFoundError("Aadhaar record not found");

      const updated = await AadhaarModel.verifyAadhaar(userId, tx);
      return { message: "Aadhaar verified successfully", updated };
    });
  }

  /**
   * Get full Aadhaar details (admin only)
   */
  async getAadhaarDetails(userId) {
    const data = await AadhaarModel.findByUserId(userId);
    if (!data) throw new NotFoundError("Aadhaar record not found");
    return data;
  }

  /**
   * Generate a Digilocker consent URL via Signzy and record the requestId
   * against the user so the frontend can later resolve it after redirect.
   * @param {number} userId
   * @param {string} aadhaarNumber
   * @param {Object} [options]
   */
  async requestDigilockerUrl(userId, aadhaarNumber, options = {}) {
    if (!aadhaarNumber) {
      throw new BadRequestError("Aadhaar number is required");
    }

    const cleanedNumber = aadhaarNumber.toString().replace(/\s/g, '');

    if (!this.validateAadhaarFormat(cleanedNumber)) {
      throw new BadRequestError("Invalid Aadhaar number format. Must be 12 digits starting with 2-9");
    }

    const existingAadhaar = await AadhaarModel.findByAadhaarNumber(cleanedNumber);
    if (existingAadhaar && existingAadhaar.userId !== userId) {
      throw new BadRequestError("This Aadhaar number is already registered with another account.");
    }

    let digilockerDetails = await signzyService.createDigilockerUrl(userId, options);
    await UserModel.updateUser(userId, {
      digilockerRequestId: digilockerDetails.requestId,
      digilockerStatus: 'URL_CREATED',
    });

    let aadhaarDetails = await AadhaarModel.findByUserId(userId);
    try {
      if (aadhaarDetails) {
        await AadhaarModel.updateAadhaarRecord(userId, { aadhaarNumber: cleanedNumber, verified: false, verifiedAt: null });
      } else {
        await AadhaarModel.createAadhaarRecord(userId, cleanedNumber);
      }
    } catch (err) {
      if (err.code === 'P2002') {
        throw new BadRequestError("This Aadhaar number is already registered with another account.");
      }
      throw err;
    }

    logger.info(`[DIGILOCKER] URL created for user ${userId}, requestId=${digilockerDetails.requestId}`);

    return digilockerDetails;
  }



  /**
   * Called once the user is back from the Digilocker consent flow: look up
   * the requestId already stored on this user, fetch the e-Aadhaar via
   * Signzy, and persist it.
   */
  async handleDigilockerCallback(userId, status, aadhaarNumber) {
    let requestId = (await UserModel.findUserById(userId)).digilockerRequestId;
    if (!requestId) throw new BadRequestError('requestId is required');

    const user = await UserModel.findUserById(userId);
    if (!user) throw new NotFoundError(`No user found for Digilocker requestId ${requestId}`);

    if (status !== 'success') {
      await UserModel.updateUser(user.id, { digilockerStatus: 'CONSENT_FAILED' });
      logger.warn(`[DIGILOCKER] Consent not completed for user ${user.id}, requestId=${requestId}`);
      return { userId: user.id, saved: false };
    }

    let eAadhaar;
    try {
      eAadhaar = await signzyService.getEAadhaarDetails(requestId, aadhaarNumber);
    } catch (err) {
      await UserModel.updateUser(user.id, { digilockerStatus: 'FETCH_FAILED' });
      logger.error(`[DIGILOCKER] Get e-Aadhaar failed for user ${user.id}, requestId=${requestId}: ${err.message}`);
      throw err;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await AadhaarModel.saveEAadhaarDetails(user.id, eAadhaar, tx);

        const { splitAddress = {} } = eAadhaar;

        // Helper to extract clean string whether it's a string, array, or nested array
        const extractFirst = (val) => {
          if (!val) return null;
          if (Array.isArray(val)) {
            const first = val[0];
            return Array.isArray(first) ? (first[0] ? String(first[0]).trim() : null) : (first ? String(first).trim() : null);
          }
          return String(val).trim() || null;
        };

        const city = extractFirst(splitAddress.city) || extractFirst(splitAddress.district);
        const state = extractFirst(splitAddress.state);
        const postalCode = splitAddress.pincode ? String(splitAddress.pincode).trim() : null;
        const addressLine = splitAddress.addressLine ? String(splitAddress.addressLine).trim() : null;
        const landmark = splitAddress.landMark ? String(splitAddress.landMark).trim() : null;
        const district = extractFirst(splitAddress.district);

        // If addressLine is already present, use it; otherwise fallback to joining components
        const permanentAddress = addressLine || [landmark, city, district, state, postalCode].filter(Boolean).join(', ') || null;

        const addressData = {
          district,
          city,
          landmark,
          state,
          postalCode,
          permanentAddress,
        };

        await AddressModel.upsertAddress(user.id, addressData, tx);

        // const { splitAddress = {} } = eAadhaar;

        // const addressLine = String(splitAddress.addressLine)
        // const district = String(splitAddress?.district?.[0]);
        // const landmark = String(splitAddress.landMark);
        // const addressData = {
        //   city: String(splitAddress.city[0]),
        //   state: String(splitAddress.state?.[0]?.[0]),
        //   postalCode: String(splitAddress.pincode),
        //   permanentAddress: [addressLine, district, landmark].filter(Boolean).join(' ') || null,
        // };
        // await AddressModel.upsertAddress(user.id, addressData, tx);
        await UserModel.updateUser(user.id, { digilockerStatus: 'CONSENT_COMPLETED' }, tx);

        try {
          eAadhaar?.photo ? await uploadDigilockerDocument(user.id, tx, {
            value: eAadhaar.photo,
            docType: 'DIGILOCKER_PHOTO',
            filename: 'DIGILOCKER_PHOTO.jpg',
            mimetype: 'image/jpeg',
          }) : null
          eAadhaar?.rawResponse?.aadhaarJpeg ? await uploadDigilockerDocument(user.id, tx, {
            value: eAadhaar.rawResponse.aadhaarJpeg,
            docType: 'DIGILOCKER_AADHAAR',
            filename: 'DIGILOCKER_AADHAAR.jpg',
            mimetype: 'image/jpeg',
          }) : null

        } catch (e) {
          logger.error("Error uploading Digilocker documents", e)
        }
      });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new BadRequestError("This Aadhaar number is already registered with another account.");
      }
      throw err;
    }

    logger.info(`[DIGILOCKER] e-Aadhaar fetched and saved for user ${user.id}`);

    return { userId: user.id, saved: true, data: eAadhaar };
  }
}

module.exports = new AadhaarService();
