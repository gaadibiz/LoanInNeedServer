const { isOfficialEmail, PUBLIC_EMAIL_DOMAINS } = require('../../../utils/validator');

describe('📧 Validator Unit Tests - isOfficialEmail', () => {
  it('❌ should reject invalid email inputs', () => {
    expect(isOfficialEmail(null)).toBe(false);
    expect(isOfficialEmail(undefined)).toBe(false);
    expect(isOfficialEmail('')).toBe(false);
    expect(isOfficialEmail('notanemail')).toBe(false);
    expect(isOfficialEmail('user@')).toBe(false);
    expect(isOfficialEmail('@domain.com')).toBe(false);
    expect(isOfficialEmail('user@domain')).toBe(false);
  });

  it('❌ should reject public free email providers', () => {
    expect(isOfficialEmail('user@gmail.com')).toBe(false);
    expect(isOfficialEmail('user@googlemail.com')).toBe(false);
    expect(isOfficialEmail('user@yahoo.com')).toBe(false);
    expect(isOfficialEmail('user@yahoo.co.in')).toBe(false);
    expect(isOfficialEmail('user@outlook.com')).toBe(false);
    expect(isOfficialEmail('user@hotmail.com')).toBe(false);
    expect(isOfficialEmail('user@rediffmail.com')).toBe(false);
    expect(isOfficialEmail('user@icloud.com')).toBe(false);
    expect(isOfficialEmail('user@zoho.com')).toBe(false);
    expect(isOfficialEmail('user@proton.me')).toBe(false);
    expect(isOfficialEmail('user@protonmail.com')).toBe(false);
    expect(isOfficialEmail('user@mailinator.com')).toBe(false);
    expect(isOfficialEmail('user@tempmail.com')).toBe(false);
  });

  it('❌ should reject subdomains of public email providers', () => {
    expect(isOfficialEmail('user@mail.gmail.com')).toBe(false);
    expect(isOfficialEmail('user@corp.yahoo.co.in')).toBe(false);
  });

  it('✅ should accept official/corporate email addresses', () => {
    expect(isOfficialEmail('john.doe@tcs.com')).toBe(true);
    expect(isOfficialEmail('employee@infosys.com')).toBe(true);
    expect(isOfficialEmail('alex@loaninneed.com')).toBe(true);
    expect(isOfficialEmail('support@fintech-company.org')).toBe(true);
    expect(isOfficialEmail('dev@startup.io')).toBe(true);
  });
});
