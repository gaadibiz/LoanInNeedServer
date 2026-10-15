// controllers/authController.js
const authService = require('../services/authService');
const { evaluateEligibility, buildSignupRedirectUrl } = require('../services/loanService');
const asyncHandler = require('express-async-handler'); // cleaner try/catch
const surepassService = require('../services/surepassService');
const aadhaarService = require('../services/aadharService');
const AadhaarModel = require('../models/aadhaarModel');
const PanModel = require('../models/panModel');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { sendLoanApplicationToBumchum, checkAndPushBumchumIfReady } = require('../services/loanService');
const logger = require('../utils/logger');
const prisma = require('../utils/prismaClient');
const userServices = require('../services/userServices');
const documentService = require('../services/documentService');
const axios = require('axios');

require('dotenv').config()
// Request OTP
const requestPhoneOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.requestPhoneOtp(phone);
  res.json(result);
});

// Verify OTP
const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { phone, code, utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent } = req.body;
  // Pass attribution if available (from middleware)
  const attribution = req.attribution || null;
  const utm = { utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent };
  console.log('[DEBUG] Auth Controller - Attribution:', attribution); // DEBUG LOG
  const result = await authService.verifyPhoneOtp(phone, code, attribution, utm);
  res.json(result);
  let { user } = result;
  (async () => {

    try {
      // Persist UTM attribution params (if the client sent any) for this user
      await authService.saveUtmIfPresent(user.userId, utm);
    } catch (error) {
      console.log(error, "[ERROR] Error saving UTM params");
    }
    // try {
    //   console.log("[BUMCHUM] Sending Loan Application to Bumchum", user.id);
    //   if (user) {
    //     await sendLoanApplicationToBumchum(user.userId, '');
    //   }
    // } catch (error) {
    //   console.log(error, "[ERROR] Error sending loan application to Bumchum");
    // }

  })();
});

//Register phone number without verification
const registerPhoneWithoutVerification = asyncHandler(async (req, res) => {
  console.log(req.body, "---->");
  const { phone } = req.body;

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  let user = await prisma.user.findUnique({
    where: {
      phone: phone
    },
    select: {
      id: true,
    }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: phone,
        role: req.body.role ? req.body.role.toUpperCase() : 'CUSTOMER',
        phoneVerified: false
      }
    });

    const customUserId = `LIN${user.id.toString().padStart(3, '0')}`;
    user = await prisma.user.update({
      where: { id: user.id },
      data: { customUserId },
      select: { id: true }
    });
  }

  const userId = user.id;

  // Fetch existing complete profile
  const completeProfile = await userServices.getCompleteProfile(userId);

  // 1. User Basic Information (req.body.[field] || completeProfile.[field])
  const name = req.body.name || completeProfile.name || null;
  const email = req.body.email || completeProfile.email || null;
  const professionalEmail = req.body.professionalEmail || completeProfile.professionalEmail || null;
  const dob = req.body.dob ? new Date(req.body.dob) : (completeProfile.dob || null);

  let gender = completeProfile.gender || null;
  if (req.body.gender) {
    const g = req.body.gender.toUpperCase();
    gender = g.startsWith('M') ? 'MALE' : (g.startsWith('F') ? 'FEMALE' : 'OTHER');
  }

  let role = completeProfile.role || 'CUSTOMER';
  if (req.body.role) {
    role = req.body.role.toUpperCase();
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      professionalEmail,
      dob,
      gender,
      role
    }
  });

  // 2. Aadhaar Verification
  const reqAadhaar = req.body.aadhaarVerification || {};
  const rawAadhaar = reqAadhaar.aadhaarNumber || completeProfile.aadhaarVerification?.aadhaarNumber || null;

  if (rawAadhaar) {
    const cleanAadhaar = rawAadhaar.toString().replace(/\D/g, '');
    const verified = reqAadhaar.verified !== undefined ? Boolean(reqAadhaar.verified) : (completeProfile.aadhaarVerification?.verified ?? false);
    const verifiedAt = reqAadhaar.verifiedAt ? new Date(reqAadhaar.verifiedAt) : (completeProfile.aadhaarVerification?.verifiedAt || (verified ? new Date() : null));

    await prisma.aadhaarVerification.upsert({
      where: { userId },
      update: {
        aadhaarNumber: cleanAadhaar,
        verified,
        verifiedAt
      },
      create: {
        userId,
        aadhaarNumber: cleanAadhaar,
        verified,
        verifiedAt
      }
    });
  }

  // 3. PAN Verification
  const reqPan = req.body.panVerification || {};
  const rawPan = (reqPan.panNumber || completeProfile.panVerification?.panNumber || '').trim().toUpperCase();

  if (rawPan) {
    const aadhaar_linked = reqPan.aadhaar_linked !== undefined ? Boolean(reqPan.aadhaar_linked) : (completeProfile.panVerification?.aadhaar_linked ?? false);
    const masked_aadhaar = reqPan.masked_aadhaar || completeProfile.panVerification?.masked_aadhaar || null;
    const verified = reqPan.verified !== undefined ? Boolean(reqPan.verified) : (completeProfile.panVerification?.verified ?? false);
    const verifiedAt = reqPan.verifiedAt ? new Date(reqPan.verifiedAt) : (completeProfile.panVerification?.verifiedAt || (verified ? new Date() : null));

    await prisma.panVerification.upsert({
      where: { userId },
      update: {
        panNumber: rawPan,
        aadhaar_linked,
        masked_aadhaar,
        verified,
        verifiedAt
      },
      create: {
        userId,
        panNumber: rawPan,
        aadhaar_linked,
        masked_aadhaar,
        verified,
        verifiedAt
      }
    });
  }

  // 4. Employment Details
  const reqEmp = req.body.employment || {};
  let empType = (reqEmp.employmentType || completeProfile.employment?.employmentType || 'SALARIED').toUpperCase();
  if (empType === 'BUSINESS') empType = 'SELF_EMPLOYED';
  const validEmploymentTypes = ['SALARIED', 'SELF_EMPLOYED', 'STUDENT', 'UNEMPLOYED', 'OTHER'];
  if (!validEmploymentTypes.includes(empType)) empType = 'OTHER';

  const employerName = reqEmp.employerName || completeProfile.employment?.employerName || null;
  const monthlyIncome = reqEmp.monthlyIncome !== undefined ? Number(reqEmp.monthlyIncome) : (completeProfile.employment?.monthlyIncome || null);
  const companyAddress = reqEmp.companyAddress || completeProfile.employment?.companyAddress || null;

  await prisma.employmentDetail.upsert({
    where: { userId },
    update: {
      employmentType: empType,
      employerName,
      monthlyIncome,
      companyAddress
    },
    create: {
      userId,
      employmentType: empType,
      employerName,
      monthlyIncome,
      companyAddress
    }
  });

  // 5. Address Details
  const reqAddr = req.body.address || {};
  const currentAddress = reqAddr.currentAddress || completeProfile.address?.currentAddress || null;
  const permanentAddress = reqAddr.permanentAddress || completeProfile.address?.permanentAddress || null;
  const city = reqAddr.city || completeProfile.address?.city || null;
  const state = reqAddr.state || completeProfile.address?.state || null;
  const postalCode = reqAddr.postalCode || completeProfile.address?.postalCode || null;
  const district = reqAddr.district || completeProfile.address?.district || null;
  const landmark = reqAddr.landmark || completeProfile.address?.landmark || null;

  await prisma.addressDetail.upsert({
    where: { userId },
    update: {
      currentAddress,
      permanentAddress,
      city,
      state,
      postalCode,
      district,
      landmark
    },
    create: {
      userId,
      currentAddress,
      permanentAddress,
      city,
      state,
      postalCode,
      district,
      landmark
    }
  });

  // 6. Documents: Download buffer from fileUrl and upload to document storage
  if (Array.isArray(req.body.documents) && req.body.documents.length > 0) {
    for (const doc of req.body.documents) {
      try {
        if (doc.fileUrl) {
          const response = await axios.get(doc.fileUrl, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(response.data);
          const fileName = doc.fileName
          const mimeType = doc.mimeType

          const fileObj = {
            originalname: fileName,
            mimetype: mimeType,
            buffer: buffer,
            size: doc.size || buffer.length
          };

          await documentService.uploadDocument(userId, fileObj, doc.docType);
        }
      } catch (docErr) {
        logger.error(`[DOCUMENT_UPLOAD_ERROR] Failed to process document ${doc.docType} for user ${userId}: ${docErr.message}`);
      }
    }
  }

  // 7. Locations
  if (Array.isArray(req.body.locations) && req.body.locations.length > 0) {
    for (const loc of req.body.locations) {
      if (loc.latitude !== undefined && loc.longitude !== undefined) {
        await prisma.userLocation.create({
          data: {
            userId,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            accuracy: loc.accuracy ? Number(loc.accuracy) : null,
            locality: loc.locality || null,
            city: loc.city || null,
            state: loc.state || null,
            country: loc.country || null,
            postalCode: loc.postalCode || null,
            placeName: loc.placeName || null
          }
        });
      }
    }
  }

  // 8. Loan Applications
  if (Array.isArray(req.body.loanApplications) && req.body.loanApplications.length > 0) {
    const empRecord = await prisma.employmentDetail.findUnique({ where: { userId } });
    for (const app of req.body.loanApplications) {
      let loanType = (app.loanType || 'OTHER').toUpperCase();
      const validLoanTypes = ['MEDICAL_EMERGENCY', 'EDUCATION', 'HOME_RENOVATION', 'DEBT_CONSOLIDATION', 'WEDDING', 'BUSINESS', 'TRAVEL', 'OTHER'];
      if (!validLoanTypes.includes(loanType)) {
        loanType = 'OTHER';
      }

      await prisma.loanApplication.create({
        data: {
          userId,
          employmentDetailId: empRecord ? empRecord.id : null,
          loanType,
          loanAmount: app.loanAmount ? Number(app.loanAmount) : null,
          ipAddress: app.ipAddress || null,
          status: app.status || 'PENDING',
          otpVerified: app.otpVerified !== undefined ? app.otpVerified : false
        }
      });
    }
  }

  // 9. Bumchum Sync (asynchronous)
  (async () => {
    try {
      await checkAndPushBumchumIfReady(userId);
    } catch (error) {
      logger.error(`[BUMCHUM] Failed to sync after registerPhoneWithoutVerification for User ${userId}: ${error.message}`);
    }
  })();

  const updatedProfile = await userServices.getCompleteProfile(userId);

  return res.status(200).json({
    success: true,
    message: 'User registered/updated successfully',
    data: updatedProfile
  });
});

// Validate Aadhaar existence via Surepass (no DB write — for real-time frontend check)
const validateAadhaarExists = asyncHandler(async (req, res) => {
  const { aadhaarNumber } = req.body;

  if (!aadhaarNumber || aadhaarNumber.replace(/\D/g, '').length !== 12) {
    return res.status(400).json({ success: false, message: 'A valid 12-digit Aadhaar number is required' });
  }

  const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
  const userId = req.user?.id;

  if (userId) {
    const panRecord = await PanModel.findByUserId(userId);
    if (!panRecord) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your PAN card before validating Aadhaar.'
      });
    }
  }

  try {
    // Check if Aadhaar is already registered to another user in our DB
    const existing = await AadhaarModel.findByAadhaarNumber(cleanAadhaar);
    if (existing && existing.userId !== req.user?.id) {
      return res.status(409).json({ success: false, message: 'This Aadhaar number is already registered with another account.' });
    }

    return res.json({ success: true, message: 'Aadhaar number is valid' });
  } catch (err) {
    return res.status(422).json({ success: false, message: 'Invalid Aadhaar number. Please enter a valid Aadhaar card number.' });
  }
});

// Verify Aadhaar OTP (Using Surepass Validation endpoint OR master OTP bypass)
const MASTER_OTP = process.env.MASTER_OTP || '261102';

const verifyAadhaarOtp = asyncHandler(async (req, res) => {
  const { aadhaarNumber, otp } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!aadhaarNumber) {
    return res.status(400).json({ success: false, message: 'Aadhaar number is required' });
  }


  // Persist Aadhaar Validation in DB
  try {
    await aadhaarService.submitAadhaar(userId, aadhaarNumber);
  } catch (err) {
    if (err.isOperational || err.statusCode === 400) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
    throw err;
  }

  console.log(`[AUTH] Aadhaar Verified successfully for user: ${userId}`);
  res.json({
    success: true,
    message: "Aadhaar verified successfully",
    data: req.body
  });
});

// Request Aadhaar OTP (Stub/Bypass)
const requestAadhaarOtp = asyncHandler(async (req, res) => {
  // We do nothing, just return success so frontend proceeds
  res.json({ success: true, message: "OTP sent successfully" });
});

/**
 * POST /api/auth/aadhaar/request-digilocker
 * Generates a Digilocker consent URL for the logged-in user.
 * Accepts optional custom redirect URLs: successRedirectUrl, failureRedirectUrl, redirectUrl, callbackUrl
 */
const requestDigiLocker = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    throw new BadRequestError('userId is required');
  }

  const {
    aadhaarNumber,
    successRedirectUrl,
    failureRedirectUrl,
    redirectUrl,
    callbackUrl,
    successRedirectTime,
    failureRedirectTime
  } = req.body;

  const digilockerDetails = await aadhaarService.requestDigilockerUrl(userId, aadhaarNumber, {
    successRedirectUrl,
    failureRedirectUrl,
    redirectUrl,
    callbackUrl,
    successRedirectTime,
    failureRedirectTime
  });

  res.status(200).json({
    success: true,
    message: 'Digilocker URL generated successfully',
    data: digilockerDetails,
  });
});

/**
 * POST /api/auth/aadhaar/save-verified-adhaar-details
 * Called directly by our own frontend (authenticated, JWT required) once the
 * user lands back on successRedirectUrl/failureRedirectUrl after the
 * Digilocker consent flow. No Signzy webhook involved — this just invokes
 * aadhaarService.handleDigilockerCallback as a plain function for the
 * logged-in user.
 */
const saveVerifiedAadhaarDetails = asyncHandler(async (req, res) => {
  const userId = req.body.internalId || req.query.internalId;
  console.log("RAW_USER_ID--------", userId)
  if (!userId) {
    throw new BadRequestError('userId is required');
  }
  const aadhaarDetails = await AadhaarModel.findByUserId(Number(userId));
  if (!aadhaarDetails) {
    throw new BadRequestError('Aadhaar number is required');
  }

  const result = await aadhaarService.handleDigilockerCallback(
    Number(userId),
    req.body.status,
    aadhaarDetails.aadhaarNumber
  );

  res.status(200).json({
    status: req.body.status,
    message: result.saved ? 'Aadhaar details saved successfully' : 'Callback received',
    data: {
      ...req.body,
      ...result
    }
  });

  (async () => {
    try {
      await checkAndPushBumchumIfReady(Number(userId));
    } catch (error) {
      logger.error(`[BUMCHUM] Failed to sync after saving verified Aadhaar details for User ${userId}: ${error.message}`);
    }
  })();

});


// Request Email OTP
const requestEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const userId = req.user?.id || req.body?.userId || null;
  const result = await authService.requestEmailOtp(email, userId);
  res.status(200).json(result);
});

// Verify Email OTP
const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, code, otp } = req.body;
  const otpCode = code || otp;
  const userId = req.user?.id || req.body?.userId || null;
  const result = await authService.verifyEmailOtp(email, otpCode, userId);
  res.status(200).json(result);
});

const verify = asyncHandler(async (req, res) => {
  const { aadhaarNumber, panNumber, phone } = req.body;
  if (!phone) throw new BadRequestError("Phone number is required");

  if (!aadhaarNumber && !panNumber) throw new BadRequestError("Aadhaar number or PAN number is required");

  let user = await prisma.user.findUnique({
    where: {
      phone: phone
    },
    select: {
      id: true
    }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: phone
      }
    });
  }

  let result = {};

  if (aadhaarNumber) {
    const cleanAadhaar = aadhaarNumber.toString().replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      throw new BadRequestError('A valid 12-digit Aadhaar number is required');
    }

    const existingAadhaar = await AadhaarModel.findByAadhaarNumber(cleanAadhaar);
    if (existingAadhaar && existingAadhaar.userId !== user.id) {
      throw new BadRequestError('This Aadhaar number is already registered with another account.');
    }

    const aadhaarData = await surepassService.verifyAadhaar(cleanAadhaar);

    const existingUserAadhaar = await AadhaarModel.findByUserId(user.id);
    if (existingUserAadhaar) {
      await AadhaarModel.updateAadhaarRecord(user.id, {
        aadhaarNumber: cleanAadhaar,
        verified: true,
        verifiedAt: new Date()
      });
    } else {
      await AadhaarModel.createAadhaarRecord(user.id, cleanAadhaar);
      await AadhaarModel.verifyAadhaar(user.id);
    }

    result.aadhaarVerification = {
      verified: true,
      data: aadhaarData,
    };
  }

  if (panNumber) {
    const cleanPan = panNumber.trim().toUpperCase();

    const existingPan = await PanModel.findByPanNumber(cleanPan);
    if (existingPan && existingPan.userId !== user.id) {
      throw new BadRequestError('This PAN number is already registered with another account.');
    }

    const panDetails = await surepassService.verifyPAN(cleanPan);

    const panData = {
      panNumber: cleanPan,
      aadhaar_linked: Boolean(panDetails?.aadhaar_linked),
      masked_aadhaar: panDetails?.masked_aadhaar || null,
      verified: true,
      verifiedAt: new Date()
    };

    const existingUserPan = await PanModel.findByUserId(user.id);
    if (existingUserPan) {
      await PanModel.updatePanRecord(user.id, panData);
    } else {
      await PanModel.createPanRecord(user.id, panData);
    }

    result.panVerification = {
      verified: true,
      data: panDetails
    };
  }

  return res.json({
    success: true,
    data: result
  });
});


module.exports = {
  verify,
  requestPhoneOtp,
  verifyPhoneOtp,
  verifyAadhaarOtp,
  requestAadhaarOtp,
  validateAadhaarExists,
  saveVerifiedAadhaarDetails,
  requestDigiLocker,
  registerPhoneWithoutVerification,
  requestEmailOtp,
  verifyEmailOtp
};
