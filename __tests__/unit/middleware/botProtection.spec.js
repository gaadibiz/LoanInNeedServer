const { botProtection, isAllowedOriginOrReferer } = require('../../../middleware/botProtection');

describe('🛡️ botProtection Middleware Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {
        'x-enforce-bot-protection': 'true' // forces execution even when NODE_ENV === 'test'
      },
      get: jest.fn((header) => req.headers[header.toLowerCase()] || ''),
      ip: '127.0.0.1',
      originalUrl: '/api/auth/phone/request-otp'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('isAllowedOriginOrReferer', () => {
    it('✅ should allow official domains and subdomains', () => {
      expect(isAllowedOriginOrReferer('https://loaninneed.in')).toBe(true);
      expect(isAllowedOriginOrReferer('https://www.loaninneed.in')).toBe(true);
      expect(isAllowedOriginOrReferer('https://be.loaninneed.in')).toBe(true);
      expect(isAllowedOriginOrReferer('https://preview-abc.vercel.app')).toBe(true);
      expect(isAllowedOriginOrReferer('https://naveenfinance.com')).toBe(true);
      expect(isAllowedOriginOrReferer('https://app.ondigitalocean.app')).toBe(true);
      expect(isAllowedOriginOrReferer('http://localhost:3000')).toBe(true);
      expect(isAllowedOriginOrReferer('http://localhost:5173')).toBe(true);
    });

    it('❌ should reject unauthorized or invalid domains', () => {
      expect(isAllowedOriginOrReferer('https://evil-site.com')).toBe(false);
      expect(isAllowedOriginOrReferer('https://notloaninneed.in')).toBe(false);
      expect(isAllowedOriginOrReferer('https://loaninneed.in.fake.com')).toBe(false);
      expect(isAllowedOriginOrReferer('-')).toBe(false);
      expect(isAllowedOriginOrReferer('')).toBe(false);
      expect(isAllowedOriginOrReferer(null)).toBe(false);
    });
  });

  describe('User-Agent & Origin validation', () => {
    it('❌ should block curl user-agent', () => {
      req.headers['user-agent'] = 'curl/8.14.1';
      req.headers['origin'] = 'https://loaninneed.in';

      botProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('automated requests are prohibited')
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('❌ should block python-requests, postman, and other script clients', () => {
      const bots = [
        'python-requests/2.31.0',
        'PostmanRuntime/7.36.0',
        'Go-http-client/1.1',
        'Wget/1.21.3',
        'axios/1.6.0'
      ];

      for (const botAgent of bots) {
        jest.clearAllMocks();
        req.headers['user-agent'] = botAgent;
        req.headers['origin'] = 'https://loaninneed.in';

        botProtection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
    });

    it('❌ should block missing or short user-agents', () => {
      req.headers['user-agent'] = '';
      req.headers['origin'] = 'https://loaninneed.in';

      botProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('❌ should block legitimate browser user-agent if origin/referer is missing or invalid', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      req.headers['origin'] = '';
      req.headers['referer'] = '';

      botProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('unauthorized request origin')
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('✅ should pass when legitimate browser user-agent and allowed Origin are provided', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      req.headers['origin'] = 'https://loaninneed.in';

      botProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('✅ should pass when legitimate browser user-agent and allowed Referer are provided', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1';
      req.headers['referer'] = 'https://loaninneed.in/apply';

      botProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
