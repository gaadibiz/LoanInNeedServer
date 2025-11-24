const UserLocationModel = require('../models/userLocationModel');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');

/**
 * Save user location
 */
const saveLocation = async (userId, locationData) => {
  if (!locationData.latitude || !locationData.longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const location = await UserLocationModel.createLocation(userId, {
    latitude: parseFloat(locationData.latitude),
    longitude: parseFloat(locationData.longitude),
    accuracy: locationData.accuracy ? parseFloat(locationData.accuracy) : null,
    placeName: locationData.placeName || null,
    locality: locationData.locality || null,
    city: locationData.city || null,
    state: locationData.state || null,
    country: locationData.country || null,
    postalCode: locationData.postalCode || null,
  });

  return location;
};

/**
 * Get latest location for a user
 */
const getLatestLocation = async (userId) => {
  return await UserLocationModel.getLatestLocation(userId);
};

/**
 * Get all locations for a user
 */
const getUserLocations = async (userId) => {
  return await UserLocationModel.getUserLocations(userId);
};

module.exports = {
  saveLocation,
  getLatestLocation,
  getUserLocations,
};

