const prisma = require('../utils/prismaClient');

const EmploymentModel = {
  async findByUserId(userId, tx = prisma) {
    return tx.employmentDetail.findUnique({
      where: { userId },
    });
  },

  async createEmploymentDetails(userId, data, tx = prisma) {
    return tx.employmentDetail.create({
      data: {
        employmentType: data.employmentType || "OTHER",
        employerName: data.employerName,
        companyAddress: data.companyAddress,
        monthlyIncome: data.monthlyIncome,
        stability: data.stability,
        user: {
          connect: { id: userId },
        },
      },
    });
  },

  async updateEmploymentDetails(userId, data, tx = prisma) {
    return tx.employmentDetail.update({
      where: { userId },
      data,
    });
  },

  async upsertEmploymentDetails(userId, data, tx = prisma) {
    return tx.employmentDetail.upsert({
      where: { userId },
      update: data,
      create: {
        employmentType: data.employmentType || "OTHER",
        employerName: data.employerName,
        companyAddress: data.companyAddress,
        monthlyIncome: data.monthlyIncome,
        stability: data.stability,
        user: { connect: { id: userId } },
      },
    });
  }
};

module.exports = EmploymentModel;
