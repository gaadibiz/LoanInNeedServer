// services/kycService.js
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');

const EmploymentModel = require('../models/employmentModel');
const LoanModel = require('../models/loanModel');
const AddressModel = require('../models/adressModel');
const UserModel = require('../models/userModel');
const { buildFinnauxJobPayload } = require('./finnauxIntegrationService');
const { checkAndPushBumchumIfReady } = require('./loanService');
const phonePrefillService = require('./phonePrefillService');

async function saveFullKYC(userId, data) {
  if (!userId) {
    throw new BadRequestError('User ID is required ❌');
  }
  console.log(data,"DATA PRESENTS HERE")
  // Increase transaction timeout to 30s to avoid "transaction already closed" errors
  const result = await prisma.$transaction(
    async tx => {
      // Fetch existing records first (within the transaction tx)
      const existingEmployment = await EmploymentModel.findByUserId(userId, tx);
      const existingAddress = await AddressModel.findByUserId(userId, tx);

      // Helper to check if a value is a dummy placeholder
      const isPlaceholder = (val) => {
        if (!val) return true;
        const v = String(val).trim().toLowerCase();
        return v === '-' || v === 'n/a' || v === 'none' || v === '000000' || v === 'delhi' || v === 'undefined';
      };

      // Merge data with existing records to autofetch from the database
      const companyName = !isPlaceholder(data.companyName) ? data.companyName : (existingEmployment && existingEmployment.employerName ? existingEmployment.employerName : data.companyName);
      const companyAddress = !isPlaceholder(data.companyAddress) ? data.companyAddress : (existingEmployment && existingEmployment.companyAddress ? existingEmployment.companyAddress : data.companyAddress);
      const monthlyIncomeRaw = data.monthlyIncome && Number(data.monthlyIncome) > 0 ? data.monthlyIncome : (existingEmployment && existingEmployment.monthlyIncome ? existingEmployment.monthlyIncome : data.monthlyIncome);
      const stability = !isPlaceholder(data.stability) ? data.stability : (existingEmployment && existingEmployment.stability ? existingEmployment.stability : data.stability);
      const employmentType = !isPlaceholder(data.employmentType) ? data.employmentType : (existingEmployment && existingEmployment.employmentType ? existingEmployment.employmentType : 'OTHER');

      const currentAddress = !isPlaceholder(data.currentAddress) ? data.currentAddress : (existingAddress && existingAddress.currentAddress ? existingAddress.currentAddress : data.currentAddress);
      const currentAddressType = !isPlaceholder(data.currentAddressType) ? data.currentAddressType : (existingAddress && existingAddress.currentAddressType ? existingAddress.currentAddressType : data.currentAddressType);
      const permanentAddress = !isPlaceholder(data.permanentAddress) ? data.permanentAddress : (existingAddress && existingAddress.permanentAddress ? existingAddress.permanentAddress : data.permanentAddress);
      const city = !isPlaceholder(data.currentCity || data.city) ? (data.currentCity || data.city) : (existingAddress && existingAddress.city ? existingAddress.city : (data.currentCity || data.city));
      const state = !isPlaceholder(data.currentState || data.state) ? (data.currentState || data.state) : (existingAddress && existingAddress.state ? existingAddress.state : null);
      const postalCode = !isPlaceholder(data.currentPostalCode || data.postalCode || data.pinCode) ? (data.currentPostalCode || data.postalCode || data.pinCode) : (existingAddress && existingAddress.postalCode ? existingAddress.postalCode : (data.currentPostalCode || data.postalCode || data.pinCode));

      // ---------- Employment ----------
      if (!companyName || !monthlyIncomeRaw) {
        throw new BadRequestError('Employment data incomplete ❌ (Company Name and Income required)');
      }

      const monthlyIncome = Number(monthlyIncomeRaw);
      if (isNaN(monthlyIncome) || monthlyIncome < 0) {
        throw new BadRequestError('Invalid monthly income ❌');
      }

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

      const stabilityValue = stability
        ? stabilityMap[stability] || String(stability).toUpperCase().replace(/\s+/g, '_').replace(/\/\s*MODERATE/gi, '').trim()
        : null;

      const employmentPayload = {
        employmentType: employmentType,
        employerName: companyName,
        companyAddress: companyAddress || null,
        monthlyIncome,
        stability: stabilityValue,
      };

      let employment = await EmploymentModel.upsertEmploymentDetails(userId, employmentPayload, tx);

      logger.info('✅ Employment saved userId=%s employmentId=%s', userId, employment.id);

      // ---------- Address ----------
      // Address data is optional for initial creation, so we don't throw an error if incomplete

      // Map frontend address type values to enum values
      const addressTypeMap = {
        'Owner(Self or Family)': 'OWNER_SELF_OR_FAMILY',
        Rented: 'RENTED',
        // Also handle if already in enum format
        OWNER_SELF_OR_FAMILY: 'OWNER_SELF_OR_FAMILY',
        OWNER: 'OWNER_SELF_OR_FAMILY', // Backward compatibility
        OWN: 'OWNER_SELF_OR_FAMILY', // Handle "OWN" mapping
        OWNED: 'OWNER_SELF_OR_FAMILY',
        RENTED: 'RENTED',
      };

      let addressTypeValue = null;
      if (currentAddressType) {
        addressTypeValue = addressTypeMap[currentAddressType] ||
          String(currentAddressType).toUpperCase().replace(/\s+/g, '_').replace(/[()]/g, '');
        if (!['OWNER_SELF_OR_FAMILY', 'RENTED'].includes(addressTypeValue)) {
          addressTypeValue = null;
        }
      }

      const addrPayload = {
        currentAddress: currentAddress || null,
        permanentAddress: permanentAddress || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        currentAddressType: addressTypeValue,
      };

      let addressDetail = await AddressModel.upsertAddress(userId, addrPayload, tx);

      logger.info('✅ Address saved userId=%s addressDetailId=%s', userId, addressDetail.id);

      // ---------- Loan ----------
      if (!data.loanAmount || !data.purpose) {
        throw new BadRequestError('Loan data incomplete ❌');
      }

      const loanAmount = Number(data.loanAmount);
      if (isNaN(loanAmount) || loanAmount <= 0) {
        throw new BadRequestError('Invalid loan amount ❌');
      }

      const loanPayload = {
        loanAmount,
        purposeOfLoan: data.purpose,
        status: data.status || 'PENDING',
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        interestRate: Number(data.interestRate) || 0,
        termMonths: Number(data.termMonths) || null,
      };

      const loan = await LoanModel.createLoan(userId, loanPayload, tx);
      logger.info('✅ Loan saved userId=%s loanId=%s', userId, loan.id);

      // Fetch user data for attribution sync
      const user = await UserModel.findUserById(userId, tx);

      // ---------- Sync with LoanApplication for LOS Fetching ----------
      // Map purpose to LoanType enum, default to 'OTHER'
      const purposeStr = data.purpose ? String(data.purpose).toUpperCase().replace(/\s+/g, '_') : 'OTHER';
      const validLoanTypes = [
        'MEDICAL_EMERGENCY', 'EDUCATION', 'HOME_RENOVATION',
        'DEBT_CONSOLIDATION', 'WEDDING', 'BUSINESS', 'TRAVEL', 'OTHER'
      ];
      const loanTypeEnum = validLoanTypes.includes(purposeStr) ? purposeStr : 'OTHER';

      // If this user already has a prior application, flag this one as a re-apply
      // (reason: '1') so Finnaux can see it's not the user's first application.
      const priorApplication =( await tx.loanApplication.findFirst({ where: { userId ,status : 'IN_PROGRESS' } })) || {};

      // This ensures that the LOS system (which queries LoanApplication) sees all entries.
      const application = await tx.loanApplication.create({
        data: {
          userId,
          loanAmount: loanAmount,
          loanType: loanTypeEnum,
          status: 'PENDING',
          attributedPartnerId: user.attributedPartnerId,
          attributionSource: user.attributionType || 'ORGANIC',
          ipAddress: data?.ipAddress || '',
          reloan: Object.keys(priorApplication).length > 0 ? 1 : 0,
        }
      });
      logger.info('✅ LoanApplication synced for userId=%s appId=%s', userId, application.id);

      try {
        await phonePrefillService.fetchAndSavePrefillDetails(userId);
        logger.info(`[LOAN] Phone prefill details fetched and saved for User ${userId}`);
      } catch (error) {
        logger.error(`[LOAN] Failed to fetch/save phone prefill details for User ${userId}: ${error.message}`);
      }
      // ---------- Queue for LOS Integration ----------
      await tx.losIntegrationJob.create({
        data: {
          ipAddress: data?.ipAddress || '',
          userId,
          applicationId: application.id,
          status: 'PENDING'
        }
      });
      logger.info('✅ LOS Integration Job queued for userId=%s appId=%s', userId, application.id);

      // ---------- Queue for Finnaux Integration ----------
      const isSubmitted = data.submitted === true || data.submitted === 'true';
      const finnauxRawRequest = isSubmitted ? (await buildFinnauxJobPayload(userId, application.id, data?.ipAddress || '', tx)): null
      isSubmitted ? (await tx.finnauxIntegrationJob.create({
        data: {
          ipAddress: data?.ipAddress || '',
          userId,
          applicationId: application.id,
          status: 'PENDING',
          rawRequest: JSON.parse(JSON.stringify(finnauxRawRequest))
        }
      })) : null
      logger.info('✅ Finnaux Integration Job queued for userId=%s appId=%s', userId, application.id);

      // ---------- Return ----------
      return { user, employment, addressDetail, loan, application };
    },
    { timeout: parseInt(process.env.DB_TRANSACTION_TIMEOUT_MS) || 50000 } // Configurable timeout
  );

  return result;
}

module.exports = { saveFullKYC };
