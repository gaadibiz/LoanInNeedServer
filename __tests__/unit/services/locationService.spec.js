const LocationService = require('../../../services/locationService');
const UserLocationModel = require('../../../models/userLocationModel');
const { BadRequestError } = require('../../../GlobalExceptionHandler/exception');
const TestFactories = require('../../test-helpers/test-factories');

jest.mock('../../../models/userLocationModel');

describe('📍 LocationService Unit Tests', () => {
  const userId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveLocation', () => {
    it('✅ should save location successfully', async () => {
      const locationData = TestFactories.location();
      const mockLocation = { id: 1, ...locationData, userId };

      UserLocationModel.createLocation.mockResolvedValue(mockLocation);

      const result = await LocationService.saveLocation(userId, locationData);

      expect(UserLocationModel.createLocation).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        })
      );
      expect(result).toEqual(mockLocation);
    });

    it('❌ should reject location without latitude', async () => {
      const locationData = TestFactories.location();
      delete locationData.latitude;

      await expect(LocationService.saveLocation(userId, locationData)).rejects.toThrow(
        BadRequestError
      );
    });

    it('❌ should reject location without longitude', async () => {
      const locationData = TestFactories.location();
      delete locationData.longitude;

      await expect(LocationService.saveLocation(userId, locationData)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('getLatestLocation', () => {
    it('✅ should return latest location', async () => {
      const mockLocation = TestFactories.location();
      UserLocationModel.getLatestLocation.mockResolvedValue(mockLocation);

      const result = await LocationService.getLatestLocation(userId);

      expect(UserLocationModel.getLatestLocation).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockLocation);
    });

    it('✅ should return null if no location exists', async () => {
      UserLocationModel.getLatestLocation.mockResolvedValue(null);

      const result = await LocationService.getLatestLocation(userId);

      expect(result).toBeNull();
    });
  });
});

