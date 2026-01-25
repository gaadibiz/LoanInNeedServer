// services/kycService.js
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');

const EmploymentModel = require('../models/employmentModel');
const LoanModel = require('../models/loanModel');
const AddressModel = require('../models/adressModel');
const UserModel = require('../models/userModel');

async function saveFullKYC(userId, data) {
  if (!userId) {
    throw new BadRequestError('User ID is required ❌');
  }

  // Increase transaction timeout to 30s to avoid "transaction already closed" errors
  return prisma.$transaction(
    async tx => {
      // ---------- Employment ----------
      if (!data.companyName || !data.companyAddress || !data.monthlyIncome || !data.stability) {
        throw new BadRequestError('Employment data incomplete ❌');
      }

      const monthlyIncome = Number(data.monthlyIncome);
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

      const stabilityValue =
        stabilityMap[data.stability] ||
        String(data.stability)
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/\/\s*MODERATE/gi, '')
          .trim();

      const employmentPayload = {
        employmentType: data.employmentType || 'OTHER',
        employerName: data.companyName,
        companyAddress: data.companyAddress,
        monthlyIncome,
        stability: stabilityValue,
      };

      let employment = await EmploymentModel.findByUserId(userId, tx);
      employment = employment
        ? await EmploymentModel.updateEmploymentDetails(userId, employmentPayload, tx)
        : await EmploymentModel.createEmploymentDetails(userId, employmentPayload, tx);

      logger.info('✅ Employment saved userId=%s employmentId=%s', userId, employment.id);

      // ---------- Address ----------
      if (!data.currentAddress || !data.currentAddressType || !data.permanentAddress) {
        throw new BadRequestError('Address data incomplete ❌');
      }

      // Map frontend address type values to enum values
      const addressTypeMap = {
        'Owner(Self or Family)': 'OWNER_SELF_OR_FAMILY',
        Rented: 'RENTED',
        // Also handle if already in enum format
        OWNER_SELF_OR_FAMILY: 'OWNER_SELF_OR_FAMILY',
        OWNER: 'OWNER_SELF_OR_FAMILY', // Backward compatibility
        RENTED: 'RENTED',
      };

      const addressTypeValue =
        addressTypeMap[data.currentAddressType] ||
        String(data.currentAddressType).toUpperCase().replace(/\s+/g, '_').replace(/[()]/g, '');

      const addrPayload = {
        currentAddress: data.currentAddress,
        permanentAddress: data.permanentAddress,
        city: data.currentCity || null,
        state: data.currentState || null,
        postalCode: data.currentPostalCode || null,
        currentAddressType: addressTypeValue,
      };

      let addressDetail = await AddressModel.findByUserId(userId, tx);
      addressDetail = addressDetail
        ? await AddressModel.updateAddress(userId, addrPayload, tx)
        : await AddressModel.createAddress(userId, addrPayload, tx);

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

      // ---------- Return ----------
      const updatedUser = await UserModel.findUserById(userId, tx);

      return { user: updatedUser, employment, addressDetail, loan };
    },
    { timeout: 50000 } // 30 seconds timeout
  );
}

module.exports = { saveFullKYC };
