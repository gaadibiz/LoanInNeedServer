// Mock dependencies first to ensure require hoisting works
const mockUserDocument = {
  create: jest.fn(),
  findFirst: jest.fn(),
};

jest.mock('../../../utils/prismaClient', () => ({
  userDocument: mockUserDocument,
}));

jest.mock('../../../config/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: 'https://supabase.co/storage/selfie.jpg' },
        })),
      }),
    },
  },
}));

jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      ...originalFs.promises,
      readFile: jest.fn(() => Promise.resolve(Buffer.from('file content'))),
      unlink: jest.fn(() => Promise.resolve()),
    },
  };
});

const SelfieService = require('../../../services/selfieService');
const { supabase } = require('../../../config/supabase');
const { BadRequestError } = require('../../../GlobalExceptionHandler/exception');
const { mockMulterFile } = require('../../test-helpers/mock-factories');

describe('📸 SelfieService Unit Tests', () => {
  const userId = 1;
  let mockFile;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFile = mockMulterFile();
  });

  describe('saveSelfie', () => {
    it('✅ should save selfie successfully', async () => {
      mockUserDocument.create.mockResolvedValue({ id: 1, docType: 'PHOTO' });

      const result = await SelfieService.saveSelfie(userId, mockFile);

      expect(supabase.storage.from).toHaveBeenCalled();
      expect(mockUserDocument.create).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('selfie');
    });

    it('❌ should reject if no file provided', async () => {
      await expect(SelfieService.saveSelfie(userId, null)).rejects.toThrow(
        BadRequestError
      );
    });

    it('❌ should handle Supabase upload errors', async () => {
      supabase.storage.from.mockReturnValue({
        upload: jest.fn(() => Promise.resolve({ error: { message: 'Upload failed' } })),
      });

      await expect(SelfieService.saveSelfie(userId, mockFile)).rejects.toThrow();
    });
  });

  describe('getSelfieStatus', () => {
    it('✅ should return selfie status if exists', async () => {
      mockUserDocument.findFirst.mockResolvedValue({ id: 1, docType: 'PHOTO', status: 'SUBMITTED' });

      const result = await SelfieService.getSelfieStatus(userId);

      expect(mockUserDocument.findFirst).toHaveBeenCalled();
      expect(result).toHaveProperty('uploaded');
      expect(result.uploaded).toBe(true);
    });

    it('✅ should return not uploaded if no selfie exists', async () => {
      mockUserDocument.findFirst.mockResolvedValue(null);

      const result = await SelfieService.getSelfieStatus(userId);

      expect(mockUserDocument.findFirst).toHaveBeenCalled();
      expect(result).toHaveProperty('uploaded');
      expect(result.uploaded).toBe(false);
    });
  });
});
