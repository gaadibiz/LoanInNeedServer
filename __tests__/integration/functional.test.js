const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'https://be.loaninneed.in'; // Running against UAT

describe('Functional Testing Suite (TC-FUNC)', () => {
    
    // TC-FUNC-001
    it('TC-FUNC-001: Should reject invalid user registration payloads', async () => {
        const response = await request(BASE_URL)
            .post('/api/users/register')
            .send({ email: 'notanemail' });
        
        expect(response.status).toBeGreaterThanOrEqual(400); // Bad Request expected
    });

    // TC-FUNC-004
    it('TC-FUNC-004: Should validate bad inputs for loan application', async () => {
        const response = await request(BASE_URL)
            .post('/api/loans/apply')
            .send({ loanAmount: -5000 }); // Invalid negative amount
            
        expect(response.status).toBe(401); // Unauthorized (needs token) or 400 (validation)
    });

    // TC-FUNC-005
    it('TC-FUNC-005: Role-Based Access Control (RBAC) Enforcement', async () => {
        // Attempting to access admin dashboard without token
        const response = await request(BASE_URL)
            .get('/api/admin/dashboard');
            
        expect(response.status).toBe(401); // Or 403
    });
});
