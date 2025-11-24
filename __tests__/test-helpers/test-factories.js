const faker = require('faker');

/**
 * Test Data Factories
 * Generate consistent test data for testing
 */
class TestFactories {
  /**
   * Generate a test phone number
   */
  static phone() {
    return `+91${faker.phone.phoneNumber('##########')}`;
  }

  /**
   * Generate user data
   */
  static user(overrides = {}) {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();
    
    return {
      phone: this.phone(),
      name: `${firstName} ${lastName}`,
      email: faker.internet.email(firstName, lastName).toLowerCase(),
      password: 'Test@1234',
      dob: faker.date.past(30, new Date('2002-01-01')),
      gender: faker.random.arrayElement(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']),
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Generate KYC data
   */
  static kyc(overrides = {}) {
    return {
      companyName: faker.company.companyName(),
      companyAddress: faker.address.streetAddress(),
      monthlyIncome: faker.random.number({ min: 20000, max: 500000 }),
      stability: faker.random.arrayElement([
        'VERY_UNSTABLE',
        'SOMEWHAT_UNSTABLE',
        'NEUTRAL',
        'STABLE',
        'VERY_STABLE',
      ]),
      currentAddress: faker.address.streetAddress(),
      currentAddressType: faker.random.arrayElement(['OWNER_SELF_OR_FAMILY', 'RENTED']),
      permanentAddress: faker.address.streetAddress(),
      currentPostalCode: faker.address.zipCode(),
      loanAmount: faker.random.number({ min: 10000, max: 1000000 }),
      purpose: faker.random.arrayElement([
        'Medical Emergency',
        'Education',
        'Home Renovation',
        'Debt Consolidation',
        'Business',
      ]),
      ...overrides,
    };
  }

  /**
   * Generate Aadhaar data
   */
  static aadhaar(overrides = {}) {
    return {
      aadhaarNumber: faker.random.number({ min: 100000000000, max: 999999999999 }).toString(),
      ...overrides,
    };
  }

  /**
   * Generate PAN data
   */
  static pan(overrides = {}) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const panNumber = 
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)] +
      numbers[Math.floor(Math.random() * numbers.length)] +
      numbers[Math.floor(Math.random() * numbers.length)] +
      numbers[Math.floor(Math.random() * numbers.length)] +
      numbers[Math.floor(Math.random() * numbers.length)] +
      letters[Math.floor(Math.random() * letters.length)];
    
    return {
      panNumber,
      ...overrides,
    };
  }

  /**
   * Generate location data
   */
  static location(overrides = {}) {
    return {
      latitude: parseFloat(faker.address.latitude()),
      longitude: parseFloat(faker.address.longitude()),
      accuracy: faker.random.number({ min: 1, max: 100 }),
      city: faker.address.city(),
      state: faker.address.state(),
      country: 'India',
      postalCode: faker.address.zipCode(),
      placeName: faker.address.streetAddress(),
      ...overrides,
    };
  }

  /**
   * Generate loan application data
   */
  static loanApplication(overrides = {}) {
    return {
      loanType: faker.random.arrayElement([
        'MEDICAL_EMERGENCY',
        'EDUCATION',
        'HOME_RENOVATION',
        'DEBT_CONSOLIDATION',
        'WEDDING',
        'BUSINESS',
        'TRAVEL',
        'OTHER',
      ]),
      loanAmount: faker.random.number({ min: 10000, max: 1000000 }),
      status: 'PENDING',
      ...overrides,
    };
  }

  /**
   * Generate JWT token payload
   */
  static jwtPayload(overrides = {}) {
    return {
      id: faker.random.number({ min: 1, max: 10000 }),
      phone: this.phone(),
      ...overrides,
    };
  }

  /**
   * Generate file upload data
   */
  static fileUpload(overrides = {}) {
    return {
      fieldname: 'document',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: faker.random.number({ min: 1000, max: 5000000 }),
      buffer: Buffer.from('test file content'),
      ...overrides,
    };
  }
}

module.exports = TestFactories;

