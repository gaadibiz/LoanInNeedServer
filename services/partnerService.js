const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateHmac, encrypt, decrypt } = require('../utils/cryptoUtils');
const crypto = require('crypto');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../GlobalExceptionHandler/exception');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

const PARTNER_REQUIREMENTS = {
  DSA: ['panNumber', 'address', 'city', 'state', 'pincode'],
  BC: ['panNumber', 'address', 'city', 'state', 'pincode'],
  AFFILIATE: ['panNumber'],
  API_PARTNER: ['gstNumber', 'panNumber']
};

// Generate JWT for Partner
const generateToken = (id) => {
  return jwt.sign({ id, role: 'PARTNER' }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * Register a new partner
 */
const registerPartner = async (data) => {
  const {
    name, email, phone, password, partnerType,
    gstNumber, panNumber, address, city, state, pincode
  } = data;

  // Validate Partner Type Requirements
  const requiredFields = PARTNER_REQUIREMENTS[partnerType];
  if (requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new BadRequestError(`Missing required fields for ${partnerType}: ${missing.join(', ')}`);
    }
  }

  // Check if partner exists
  const existingPartner = await prisma.partner.findFirst({
    where: {
      OR: [
        { email: email },
        { phone: phone }
      ]
    }
  });

  if (existingPartner) {
    throw new BadRequestError('Partner already exists with this email or phone.');
  }

  // Hash password (if provided)
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = password ? await bcrypt.hash(password, salt) : null;

  // Generate Secret Key for HMAC
  const rawSecret = crypto.randomBytes(32).toString('hex');
  // Ideally encrypt this secret in DB
  const encryptedSecret = encrypt(rawSecret);

  // Create Partner
  const partner = await prisma.partner.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      partnerType: partnerType, // Ensure this matches Enum
      status: 'PENDING', // Default status
      secretKey: encryptedSecret,
      // Storing attributes
      gstNumber, panNumber, address, city, state, pincode
    }
  });

  return {
    id: partner.id,
    name: partner.name,
    email: partner.email,
    token: generateToken(partner.id),
    message: 'Partner registered successfully. Pending approval.'
  };
};


/**
 * Login Partner (Supports Phone or Email login)
 */
const loginPartner = async (identifier, password) => {
  // Check if identifier is email or phone
  const isEmail = identifier.includes('@');

  const partner = await prisma.partner.findFirst({
    where: isEmail ? { email: identifier } : { phone: identifier }
  });

  // If password exists, verify it. 
  // If partner has no password (OTP flow, future), we need a different mechanism.
  // For now, assume password is provided during login IF it was set.
  // The user requirement says "no need of email or password... everything via mobile number".
  // So we might need an OTP login for Partner too.
  // But for this specific function (login based on password), we keep password check strict if password exists.

  if (!partner) {
    throw new BadRequestError('Invalid credentials');
  }

  // If partner has a password set, verify it
  if (partner.password) {
    if (!password || !(await bcrypt.compare(password, partner.password))) {
      throw new BadRequestError('Invalid credentials');
    }
  } else {
    // Partner has no password set. 
    // If they are trying to login via this "password" route, it should fail or we strictly require OTP login.
    // Since this is `loginPartner` handling password flow:
    throw new BadRequestError('This account is configured for OTP login only.');
  }

  if (partner.status === 'REJECTED' || partner.status === 'SUSPENDED') {
    throw new UnauthorizedError('Account is suspended or rejected. Contact support.');
  }

  return {
    id: partner.id,
    name: partner.name,
    email: partner.email,
    partnerType: partner.partnerType,
    status: partner.status,
    token: generateToken(partner.id)
  };
};

/**
 * Get Partner Profile
 */
const getPartnerProfile = async (id) => {
  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      partnerType: true,
      status: true,
      gstNumber: true,
      panNumber: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      createdAt: true
    }
  });

  if (!partner) throw new NotFoundError('Partner not found');
  return partner;
};

/**
 * Generate Referral Link
 */
const generateReferralLink = async (partnerId) => {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId }
  });

  if (!partner || !partner.secretKey) {
    throw new BadRequestError('Partner invalid or missing secret key');
  }

  // Decrypt secret
  // Note: If you stored it plain in step 1, decrypt might fail depending on util.
  // Assuming encrypt/decrypt are symmetric from cryptoUtils.
  let secretKey;
  try {
    secretKey = decrypt(partner.secretKey);
  } catch (e) {
    // Fallback if stored plain (during dev/testing transitions)
    secretKey = partner.secretKey;
  }

  const timestamp = Date.now();
  const payload = `${partner.id}|${timestamp}`;

  // Generate HMAC
  const signature = generateHmac(payload, secretKey);

  return {
    link: `${API_BASE_URL}/register?pid=${partner.id}&ts=${timestamp}&sig=${signature}`
  };
};

/**
 * Update Partner Profile
 */
const updatePartnerProfile = async (id, data) => {
  const { name, email, phone, gstNumber, panNumber, address, city, state, pincode } = data;

  // Check if partner exists
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw new NotFoundError('Partner not found');

  // Perform update
  const updatedPartner = await prisma.partner.update({
    where: { id },
    data: {
      name,
      email,
      phone,
      gstNumber,
      panNumber,
      address,
      city,
      state,
      pincode
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      partnerType: true,
      gstNumber: true,
      panNumber: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      updatedAt: true
    }
  });

  return updatedPartner;
};

/**
 * Change Partner Password
 */
const changePartnerPassword = async (id, oldPassword, newPassword) => {
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw new NotFoundError('Partner not found');

  // Verify old password
  const isMatch = await bcrypt.compare(oldPassword, partner.password);
  if (!isMatch) {
    throw new BadRequestError('Invalid current password');
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update password
  await prisma.partner.update({
    where: { id },
    data: { password: hashedPassword }
  });

  return { message: 'Password updated successfully' };
};

/**
 * Get Partner Dashboard Stats
 */
const getPartnerDashboard = async (partnerId) => {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  if (!partner) throw new NotFoundError('Partner not found');

  // Get total loan applications from attributed users
  // This requires a join or a separate query depending on schema relation
  // Since User has attributedPartnerId, we can count users.
  // For loan applications, we need to find loan applications where user.attributedPartnerId == partnerId
  // OR if LoanApplication has attributedPartnerId (which we added in schema)

  const totalLoanApplications = await prisma.loanApplication.count({
    where: {
      attributedPartnerId: partnerId
    }
  });

  // Also count from users who are attributed to this partner, just in case they applied without direct link this time
  // but are "owned" by the partner.
  // For now, let's stick to the direct attribution on LoanApplication if populated, 
  // or fallback to User attribution.

  // Let's get a more comprehensive count: Loan Applications by Users attributed to this Partner
  const totalAttributedApplications = await prisma.loanApplication.count({
    where: {
      user: {
        attributedPartnerId: partnerId
      }
    }
  });

  return {
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      partnerType: partner.partnerType,
      status: partner.status,
      createdAt: partner.createdAt
    },
    stats: {
      totalUsers: partner._count.users,
      totalApplications: totalAttributedApplications,
      // We can add more stats here later (e.g. approved loans, commission earned)
    }
  };
};

module.exports = {
  registerPartner,
  loginPartner,
  getPartnerProfile,
  generateReferralLink,
  updatePartnerProfile,
  changePartnerPassword,
  getPartnerDashboard
};

