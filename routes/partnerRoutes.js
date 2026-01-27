const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { protectPartner } = require('../middleware/partnerAuthMiddleware');
const { authenticate, superAdmin } = require('../middleware/authMiddleware');

// Restricted Partner Registration (Super Admin Only)
router.post('/register', authenticate, superAdmin, partnerController.registerPartner);

// Partner Login
router.post('/login', partnerController.loginPartner);

// Protected Partner Routes
// Partner Profile (Get & Update)
router.route('/profile')
    .get(protectPartner, partnerController.getPartnerProfile)
    .put(protectPartner, partnerController.updatePartnerProfile)
    .post(protectPartner, partnerController.updatePartnerProfile);

// Change Password
router.route('/password')
    .put(protectPartner, partnerController.changePartnerPassword)
    .post(protectPartner, partnerController.changePartnerPassword);

// Partner Dashboard
router.get('/dashboard', protectPartner, partnerController.getPartnerDashboard);

// Partner Earnings
router.get('/earnings', protectPartner, partnerController.getPartnerEarnings);

// For now, let's keep it minimal as per plan (Create, Login, Link Gen).
router.get('/link', protectPartner, partnerController.generateReferralLink);

module.exports = router;
