const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { saveFullKYC } = require('../services/kycService');
const documentVerificationService = require('../services/documentService'); // Import Document Service
const PanModel = require('../models/panModel'); // Import PanModel for direct access
const EmploymentModel = require('../models/employmentModel');
const AddressModel = require('../models/adressModel');
const LoanModel = require('../models/loanModel');
const kycService = require('../services/kycService'); // Import generic service for access if needed



/**
 * Controller to handle full KYC submission (Employment + Address + Loan)
 * Expects a single form submission with all details.
 */
exports.getKYC = async (req, res, next) => {
  // Stub implementation to prevent crash
  res.status(200).json({ message: "KYC details not implemented yet" });
};

/**
 * Controller to handle full KYC submission (Employment + Address + Loan)
 * Expects a single form submission with all details.
 */
exports.submitKYC = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId;
    if (!userId) throw new BadRequestError('User not found ❌');

    logger.info('📝 [KYC] Full KYC submission request for userId=%s', userId);

    const data = req.body;

    const result = await saveFullKYC(userId, data);

    logger.info('✅ [KYC] Full KYC saved successfully for userId=%s', userId);

    return res.status(200).json({
      success: true,
      message: 'Full KYC details saved successfully ✔️',
      data: result
    });

  } catch (error) {
    // ✅ Fixed log to always use userId
    const userId = req.user?.id || req.params.userId;
    logger.error('❌ [KYC] Error saving full KYC for userId=%s: %s', userId, error.message);
    next(error);
  }
};

/**
 * Verify PAN (Bypass Mode)
 * Accepts any PAN number and stores the uploaded image.
 * Does NOT perform actual external verification.
 */
exports.verifyPAN = async (req, res, next) => {
  try {
    const { panNumber } = req.body;
    const panImage = req.file;
    const userId = req.user.id;

    if (!panNumber) throw new BadRequestError('PAN number is required ❌');
    if (!panImage) throw new BadRequestError('PAN image is required ❌');

    logger.info('📝 [KYC] PAN verification request for userId=%s, PAN=%s', userId, panNumber);

    // 1. Upload PAN Image to Supabase (using documentService)
    // We treat this as a 'PAN' document type
    const uploadedDoc = await documentVerificationService.uploadDocument(
      userId,
      panImage,
      'PAN'
    );

    logger.info('✅ [KYC] PAN image uploaded successfully for userId=%s', userId);

    // 2. Persist PAN in DB (Bypass Mode)
    // Check if record exists
    const existingPan = await PanModel.findByUserId(userId);

    let panRecord;
    if (existingPan) {
      // Update existing
      panRecord = await PanModel.updatePanRecord(userId, {
        panNumber: panNumber.toUpperCase(),
        verified: true,
        verifiedAt: new Date()
      });
    } else {
      // Create new (directly verified)
      panRecord = await PanModel.createPanRecord(userId, panNumber.toUpperCase());
      // createPanRecord defaults verified to false, so we must update it immediately or custom create
      // Actually, createPanRecord implementation: verified: false. 
      // So we need to update it to true right after, or just use updatePanRecord if we could upsert.
      // Let's just update it immediately.
      panRecord = await PanModel.verifyPan(userId);
    }

    logger.info('✅ [KYC] PAN verified and saved in DB for userId=%s', userId);

    // 3. Mock Success Response
    // We return success but NO specific user details, so the frontend stays empty/editable.
    return res.status(200).json({
      success: true,
      message: 'PAN verified successfully (Bypass) ✔️',
      data: {
        panNumber: panNumber.toUpperCase(),
        // We do NOT return firstName, lastName, dob, etc. so frontend won't autofill.
        isVerified: true
      }
    });

  } catch (error) {
    logger.error('❌ [KYC] Error verifying PAN for userId=%s: %s', req.user?.id, error.message);
    next(error);
  }
};

/**
 * Update Employment Details (PUT)
 */
exports.updateEmployment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = req.body;
    logger.info('📝 [KYC] Update Employment request for userId=%s', userId);

    // Map frontend job stability values to enum values
    const stabilityMap = {
      'Very unstable': 'VERY_UNSTABLE',
      'Somewhat unstable': 'SOMEWHAT_UNSTABLE',
      'Neutral / moderate': 'NEUTRAL',
      Neutral: 'NEUTRAL',
      Stable: 'STABLE',
      'Very Stable': 'VERY_STABLE',
      // Also handle if already in enum format
      VERY_UNSTABLE: 'VERY_UNSTABLE',
      SOMEWHAT_UNSTABLE: 'SOMEWHAT_UNSTABLE',
      NEUTRAL: 'NEUTRAL',
      STABLE: 'STABLE',
      VERY_STABLE: 'VERY_STABLE',
    };

    const stabilityValue = data.stability ?
      (stabilityMap[data.stability] ||
        String(data.stability)
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/\/\s*MODERATE/gi, '')
          .trim()) : undefined;

    // Basic mapping
    const employmentPayload = {
      employmentType: data.employmentType, // Optional in update
      employerName: data.companyName,
      companyAddress: data.companyAddress,
      monthlyIncome: data.monthlyIncome ? Number(data.monthlyIncome) : undefined,
      stability: stabilityValue,
    };

    // Filter undefined values
    Object.keys(employmentPayload).forEach(key => employmentPayload[key] === undefined && delete employmentPayload[key]);

    let employment = await EmploymentModel.findByUserId(userId);
    if (employment) {
      employment = await EmploymentModel.updateEmploymentDetails(userId, employmentPayload);
    } else {
      // If not exists, create
      if (!employmentPayload.employerName || !employmentPayload.monthlyIncome) {
        throw new BadRequestError("Employment record not found and payload incomplete for creation.");
      }
      employment = await EmploymentModel.createEmploymentDetails(userId, employmentPayload);
    }

    return res.status(200).json({ success: true, message: 'Employment details updated', data: employment });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Address Details (PUT)
 */
exports.updateAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = req.body;
    logger.info('📝 [KYC] Update Address request for userId=%s', userId);

    // Map frontend address type values to enum values
    const addressTypeMap = {
      'Owner(Self or Family)': 'OWNER_SELF_OR_FAMILY',
      Rented: 'RENTED',
      // Also handle if already in enum format
      OWNER_SELF_OR_FAMILY: 'OWNER_SELF_OR_FAMILY',
      OWNER: 'OWNER_SELF_OR_FAMILY', // Backward compatibility
      RENTED: 'RENTED',
    };

    const addressTypeValue = data.currentAddressType ?
      (addressTypeMap[data.currentAddressType] ||
        String(data.currentAddressType).toUpperCase().replace(/\s+/g, '_').replace(/[()]/g, '')) : undefined;

    const addrPayload = {
      currentAddress: data.currentAddress,
      permanentAddress: data.permanentAddress,
      city: data.city || data.currentCity,
      state: data.state || data.currentState,
      postalCode: data.postalCode || data.pinCode || data.currentPostalCode,
      currentAddressType: addressTypeValue,
    };

    // Cleanup undefined
    Object.keys(addrPayload).forEach(key => addrPayload[key] === undefined && delete addrPayload[key]);

    let address = await AddressModel.findByUserId(userId);
    if (address) {
      address = await AddressModel.updateAddress(userId, addrPayload);
    } else {
      if (!addrPayload.currentAddress) {
        throw new BadRequestError("Address record not found and payload incomplete for creation.");
      }
      address = await AddressModel.createAddress(userId, addrPayload);
    }

    return res.status(200).json({ success: true, message: 'Address details updated', data: address });
  } catch (error) {
    next(error);
  }
};

