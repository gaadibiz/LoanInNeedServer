const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  }
};

module.exports = EmploymentModel;
