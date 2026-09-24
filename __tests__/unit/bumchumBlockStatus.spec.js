const axios = require('axios');
const { checkBumchumBlockStatus } = require('../../services/loanService');

jest.mock('axios');

describe('🛡️ Bumchum Block Status Unit Tests', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            BUMCHUM_SAVE_LEAD_BASE_URL: 'http://localhost:3000/api/v1/leads',
            BUMCHUM_AUTH_KEY: 'test-secret-key'
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should return true when Bumchum reports isBlocked: true in data.isBlocked', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                message: 'Blocked status:',
                totalRecords: undefined,
                currentRecords: undefined,
                data: {
                    isBlocked: true
                }
            }
        });

        const result = await checkBumchumBlockStatus({
            aadhaarNumber: '123456789012',
            contactNumber: '9876543210',
            email: 'test@example.com',
            panNumber: 'ABCDE1234F',
            ipAddress: '1.2.3.4'
        });

        expect(result).toBe(true);
        expect(axios.get).toHaveBeenCalledWith(
            'http://localhost:3000/api/v1/leads/check-block-status-by-key',
            expect.objectContaining({
                params: {
                    aadhaar_number: '123456789012',
                    contact_number: '9876543210',
                    email: 'test@example.com',
                    pan_number: 'ABCDE1234F',
                    ip_address: '1.2.3.4'
                },
                headers: {
                    'auth-Key': 'test-secret-key'
                }
            })
        );
    });

    it('should return false when Bumchum reports isBlocked: false', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                message: 'Blocked status:',
                totalRecords: undefined,
                currentRecords: undefined,
                data: {
                    isBlocked: false
                }
            }
        });

        const result = await checkBumchumBlockStatus({
            aadhaarNumber: '123456789012',
            contactNumber: '9876543210',
            email: 'test@example.com',
            panNumber: 'ABCDE1234F',
            ipAddress: '1.2.3.4'
        });

        expect(result).toBe(false);
    });

    it('should gracefully handle API error and return false', async () => {
        axios.get.mockRejectedValueOnce(new Error('Network error'));

        const result = await checkBumchumBlockStatus({
            aadhaarNumber: '123456789012',
            contactNumber: '9876543210'
        });

        expect(result).toBe(false);
    });

    it('should return false if BUMCHUM_SAVE_LEAD_BASE_URL is not configured', async () => {
        delete process.env.BUMCHUM_SAVE_LEAD_BASE_URL;

        const result = await checkBumchumBlockStatus({
            aadhaarNumber: '123456789012'
        });

        expect(result).toBe(false);
        expect(axios.get).not.toHaveBeenCalled();
    });
});

describe('🛡️ Finnaux Controller Blacklist Filter Unit Tests', () => {
    let mockPrisma;
    let finnauxController;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        mockPrisma = {
            user: {
                findFirst: jest.fn(),
                findMany: jest.fn()
            },
            loanApplication: {
                findFirst: jest.fn(),
                findUnique: jest.fn()
            },
            finnauxIntegrationJob: {
                findUnique: jest.fn()
            },
            userDocument: {
                findMany: jest.fn()
            }
        };
        jest.doMock('../../utils/prismaClient', () => mockPrisma);
        finnauxController = require('../../controllers/finnauxController');
    });

    it('should exclude blacklisted loan applications when querying by ID', async () => {
        mockPrisma.user.findFirst.mockResolvedValueOnce(null);

        const req = {
            params: { id: '10' },
            query: {}
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await finnauxController.getFinnauxRawPayloads(req, res);

        expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    loanApplications: {
                        some: {
                            id: 10,
                            blacklist: false
                        }
                    }
                }
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            count: 0,
            data: []
        }));
    });

    it('should exclude blacklisted loan applications when querying by date range', async () => {
        mockPrisma.user.findMany.mockResolvedValueOnce([]);

        const req = {
            params: {},
            query: { from: '2026-09-01', to: '2026-09-20' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await finnauxController.getFinnauxRawPayloads(req, res);

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    loanApplications: {
                        some: expect.objectContaining({
                            blacklist: false
                        })
                    }
                }
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
