// controllers/userController.js
const asyncHandler = require('express-async-handler');
const userService = require('../services/userServices');
const locationService = require('../services/locationService');
const logger = require('../utils/logger');

// ✅ Basic Registration
const registerUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await userService.registerUser(userId, req.body);

  res.status(200).json({
    message: 'Registration completed successfully.',
    user: result.user,
  });
});

// ✅ Get Profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  res.json({ message: 'Profile fetched successfully.', user });
});

// ✅ Get Complete Profile with all KYC details
const getCompleteProfile = asyncHandler(async (req, res) => {
  const completeProfile = await userService.getCompleteProfile(req.user.id);
  res.json({
    message: 'Complete profile fetched successfully.',
    profile: completeProfile
  });
});

// ✅ Login via Phone + DOB → Send OTP
const loginUser = asyncHandler(async (req, res) => {
  const { phone, dob } = req.body;

  logger.info(`[USER CONTROLLER] Login attempt for phone: ${phone}`);

  const result = await userService.loginViaPhoneAndDob(phone, dob);

  res.status(200).json({
    message: result.message, // "OTP sent for login. Please verify to continue."
    phone: result.phone
  });
});

// ✅ Admin Login (Email + Password)
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await userService.loginAdmin(email, password);
  res.status(200).json(result);
});

// ✅ Submit Location
const submitLocation = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const locationData = req.body;

  logger.info(`[USER CONTROLLER] Location submission for userId: ${userId}`);

  const location = await locationService.saveLocation(userId, locationData);

  res.status(200).json({
    message: 'Location saved successfully',
    location: location
  });
});

// ✅ Get Latest Location
const getLocation = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const location = await locationService.getLatestLocation(userId);

  if (!location) {
    return res.status(404).json({
      message: 'No location found'
    });
  }

  res.status(200).json({
    location: location
  });
});

module.exports = {
  registerUser,
  getProfile,
  getCompleteProfile,
  loginUser,
  submitLocation,
  getLocation,
  loginAdmin
};
