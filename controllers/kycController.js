const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { saveFullKYC } = require('../services/kycService');

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
