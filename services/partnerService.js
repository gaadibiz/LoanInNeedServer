const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateHmac, encrypt, decrypt } = require('../utils/cryptoUtils');
const crypto = require('crypto');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../GlobalExceptionHandler/exception');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

const PARTNER_REQUIREMENTS = {
  DSA: ['address', 'city', 'state', 'pincode'],
  BC: ['address', 'city', 'state', 'pincode'],
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
    name, email, phone, partnerType,
    gstNumber, panNumber, address, city, state, pincode, firmName
  } = data;

  // Validate Partner Type Requirements
  const requiredFields = PARTNER_REQUIREMENTS[partnerType];
  if (requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new BadRequestError(`Missing required fields for ${partnerType}: ${missing.join(', ')}`);
    }
  }

  // Custom Validation: DSA/BC must have either PAN or GST (to support Firms)
  if (['DSA', 'BC'].includes(partnerType)) {
    if (!panNumber && !gstNumber) {
      throw new BadRequestError(`Missing required tax ID: Either PAN Number or GST Number is required for ${partnerType}`);
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

  // Generate Automatic Password (Name + Random 4 digits)
  // e.g. "John Doe" -> "John8392"
  const cleanName = name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const rawPassword = `${cleanName}${randomSuffix}`;

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);

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
      gstNumber, panNumber, address, city, state, pincode, firmName
    }
  });

  return {
    id: partner.id,
    name: partner.name,
    email: partner.email,
    rawPassword: rawPassword, // Return raw password for Admin to download
    token: generateToken(partner.id),
    message: 'Partner registered successfully. Credentials generated.'
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
      firmName: true,
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

  // Link to production frontend
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://loaninneed.vercel.app';

  return {
    // Ensuring it points to the signup page with attribution params
    link: `${FRONTEND_URL}/signup?pid=${partner.id}&ts=${timestamp}&sig=${signature}`
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

  // Count total loan applications from attributed users
  const totalAttributedApplications = await prisma.loanApplication.count({
    where: {
      user: {
        attributedPartnerId: partnerId
      }
    }
  });

  // Count approved loan applications
  const approvedApplications = await prisma.loanApplication.count({
    where: {
      user: {
        attributedPartnerId: partnerId
      },
      status: 'APPROVED'
    }
  });

  // Count total clicks from attribution logs
  const totalClicks = await prisma.attributionLog.count({
    where: {
      partnerId: partnerId,
      action: 'CLICK'
    }
  });

  // Count conversions (registrations)
  const totalConversions = await prisma.attributionLog.count({
    where: {
      partnerId: partnerId,
      action: 'CONVERSION'
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
      approvedApplications: approvedApplications,
      totalClicks: totalClicks,
      totalConversions: totalConversions,
      conversionRate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0
    }
  };
};

/**
 * Get Partner Earnings
 */
const getPartnerEarnings = async (partnerId) => {
  const users = await prisma.user.findMany({
    where: { attributedPartnerId: partnerId },
    include: {
      loanApplications: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return users.map(user => {
    const latestLoan = user.loanApplications[0];
    const amount = latestLoan ? latestLoan.loanAmount : 0;

    // Formatting helper
    const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    const date = new Date(user.createdAt).toLocaleDateString('en-GB'); // DD/MM/YYYY

    // Status mapping
    let displayStatus = 'Registered';
    let rawStatus = 'REGISTERED';

    if (latestLoan) {
      rawStatus = latestLoan.status;
      if (latestLoan.status === 'APPROVED') displayStatus = 'Approved';
      else if (latestLoan.status === 'REJECTED') displayStatus = 'Rejected';
      else displayStatus = 'In process';
    }

    return {
      id: user.id.toString(),
      name: user.name || 'N/A',
      amount: formattedAmount !== '₹0' ? formattedAmount : '-',
      status: displayStatus,
      rawStatus: rawStatus,
      date: date,
      earnings: '₹1,000'
    };
  });
};

module.exports = {
  registerPartner,
  loginPartner,
  getPartnerProfile,
  generateReferralLink,
  updatePartnerProfile,
  changePartnerPassword,
  getPartnerDashboard,
  getPartnerEarnings
};

