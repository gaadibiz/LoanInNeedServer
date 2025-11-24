const SelfieService = require('../../../services/selfieService');
const { PrismaClient } = require('@prisma/client');
const { supabase } = require('../../../config/supabase');
const { BadRequestError } = require('../../../GlobalExceptionHandler/exception');
const { mockMulterFile } = require('../../test-helpers/mock-factories');

jest.mock('@prisma/client');
jest.mock('../../../config/supabase');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(() => Promise.resolve(Buffer.from('file content'))),
    unlink: jest.fn(() => Promise.resolve()),
  },
}));

describe('📸 SelfieService Unit Tests', () => {
  const userId = 1;
  let mockFile;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFile = mockMulterFile();
    
    supabase.storage.from.mockReturnValue({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: 'https://supabase.co/storage/selfie.jpg' },
      })),
    });
  });

  describe('saveSelfie', () => {
    it('✅ should save selfie successfully', async () => {
      const prisma = {
        userDocument: {
          create: jest.fn(() => Promise.resolve({ id: 1, docType: 'PHOTO' })),
        },
      };

      PrismaClient.mockImplementation(() => prisma);

      const result = await SelfieService.saveSelfie(userId, mockFile);

      expect(supabase.storage.from).toHaveBeenCalled();
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
      const prisma = {
        userDocument: {
          findFirst: jest.fn(() =>
            Promise.resolve({ id: 1, docType: 'PHOTO', status: 'SUBMITTED' })
          ),
        },
      };

      PrismaClient.mockImplementation(() => prisma);

      const result = await SelfieService.getSelfieStatus(userId);

      expect(result).toHaveProperty('uploaded');
      expect(result.uploaded).toBe(true);
    });

    it('✅ should return not uploaded if no selfie exists', async () => {
      const prisma = {
        userDocument: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      };

      PrismaClient.mockImplementation(() => prisma);

      const result = await SelfieService.getSelfieStatus(userId);

      expect(result).toHaveProperty('uploaded');
      expect(result.uploaded).toBe(false);
    });
  });
});

