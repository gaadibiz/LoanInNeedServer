const partnerService = require('../services/partnerService');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Register a new Partner
 * @route   POST /api/partners/register
 * @access  Public
 */
const registerPartner = asyncHandler(async (req, res) => {
    const result = await partnerService.registerPartner(req.body);
    res.status(201).json(result);
});

/**
 * @desc    Login Partner
 * @route   POST /api/partners/login
 * @access  Public
 */
const loginPartner = asyncHandler(async (req, res) => {
    const { identifier, email, password } = req.body;
    // Support both 'identifier' (from new frontend) and 'email' (legacy/direct)
    const result = await partnerService.loginPartner(identifier || email, password);
    res.json(result);
});

/**
 * @desc    Get Partner Profile
 * @route   GET /api/partners/profile
 * @access  Private (Partner)
 */
const getPartnerProfile = asyncHandler(async (req, res) => {
    // req.partner is set by partnerAuthMiddleware
    const result = await partnerService.getPartnerProfile(req.partner.id);
    res.json(result);
});

/**
 * @desc    Generate Referral Link
 * @route   GET /api/partners/link
 * @access  Private (Partner)
 */
const generateReferralLink = asyncHandler(async (req, res) => {
    const result = await partnerService.generateReferralLink(req.partner.id);
    res.json(result);
});

/**
 * @desc    Update Partner Profile
 * @route   PUT /api/partners/profile
 * @access  Private (Partner)
 */
const updatePartnerProfile = asyncHandler(async (req, res) => {
    const result = await partnerService.updatePartnerProfile(req.partner.id, req.body);
    res.json(result);
});

/**
 * @desc    Change Partner Password
 * @route   PUT /api/partners/password
 * @access  Private (Partner)
 */
const changePartnerPassword = asyncHandler(async (req, res) => {
    const { oldPassword, currentPassword, newPassword } = req.body;
    // Support both oldPassword and currentPassword
    const passwordToVerify = oldPassword || currentPassword;

    const result = await partnerService.changePartnerPassword(req.partner.id, passwordToVerify, newPassword);
    res.json(result);
});

/**
 * @desc    Get Partner Dashboard Stats
 * @route   GET /api/partners/dashboard
 * @access  Private (Partner)
 */
const getPartnerDashboard = asyncHandler(async (req, res) => {
    const result = await partnerService.getPartnerDashboard(req.partner.id);
    res.json(result);
});

/**
 * @desc    Get Partner Earnings
 * @route   GET /api/partners/earnings
 * @access  Private (Partner)
 */
const getPartnerEarnings = asyncHandler(async (req, res) => {
    const result = await partnerService.getPartnerEarnings(req.partner.id);
    res.json({
        success: true,
        message: "Earnings fetched successfully",
        data: result
    });
});

module.exports = {
    registerPartner,
    loginPartner,
    getPartnerProfile,
    generateReferralLink,
    updatePartnerProfile,
    updatePartnerProfile,
    changePartnerPassword,
    getPartnerDashboard,
    getPartnerEarnings
};

