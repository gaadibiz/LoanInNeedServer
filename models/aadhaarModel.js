const prisma = require('../utils/prismaClient');

const AadhaarModel = {
  /**
   * Find Aadhaar verification record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.findUnique({
      where: { userId },
    });
  },

  /**
   * Find Aadhaar verification record by Aadhaar Number
   */
  async findByAadhaarNumber(aadhaarNumber, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.findUnique({
      where: { aadhaarNumber },
    });
  },

  /**
   * Find Aadhaar verification record by ID
   */
  async findById(id, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.findUnique({
      where: { id },
    });
  },

  /**
   * Create new Aadhaar verification record
   */
  async createAadhaarRecord(userId, aadhaarNumber, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.create({
      data: {
        userId,
        aadhaarNumber,
        verified: false,
      },
    });
  },

  /**
   * Update Aadhaar verification record
   */
  async updateAadhaarRecord(userId, data, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.update({
      where: { userId },
      data,
    });
  },

  /**
   * Verify Aadhaar (set verified = true and verifiedAt = now)
   */
  async verifyAadhaar(userId, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.update({
      where: { userId },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });
  },

  /**
   * Upsert the full e-Aadhaar payload fetched from Signzy's Get e-Aadhaar API
   * and mark the record as verified.
   */
  async saveEAadhaarDetails(userId, eAadhaar, tx = prisma) {
    const client = tx;
    const data = {
      aadhaarNumber: eAadhaar.uid,
      verified: true,
      verifiedAt: new Date(),
      name: eAadhaar.name,
      dob: eAadhaar.dob,
      gender: eAadhaar.gender,
      address: eAadhaar.address,
      photoUrl: eAadhaar.photo,
      aadhaarJpegUrl: eAadhaar.aadhaarJpeg,
      splitAddress: eAadhaar.splitAddress,
      rawResponse: eAadhaar.rawResponse,
      eAadhaarFetchedAt: new Date(),
    };

    console.log(data,eAadhaar)
    return client.aadhaarVerification.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  /**
   * Delete Aadhaar verification record
   */
  async deleteAadhaarRecord(userId, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.delete({
      where: { userId },
    });
  },
};

module.exports = AadhaarModel;
