const { hashPassword, comparePassword } = require('../../utils/hash');

describe('🔒 Hash Utility', () => {
  const plainText = 'Password@123';
  let hashed;

  it('✅ should hash a password successfully', async () => {
    hashed = await hashPassword(plainText);
    expect(hashed).not.toBeNull();
    expect(typeof hashed).toBe('string');
    expect(hashed).not.toBe(plainText); // hashed value should differ
  });

  it('✅ should compare correct password successfully', async () => {
    const isValid = await comparePassword(plainText, hashed);
    expect(isValid).toBe(true);
  });

  it('❌ should fail comparison with incorrect password', async () => {
    const isValid = await comparePassword('WrongPassword', hashed);
    expect(isValid).toBe(false);
  });

  it('❌ should throw error if password is missing', async () => {
    await expect(hashPassword()).rejects.toThrow();
    await expect(comparePassword()).rejects.toThrow();
  });
});
