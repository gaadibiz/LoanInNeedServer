const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LoanApplicationModel = {
  async createLoanApplication(data, tx = prisma) {
    return tx.loanApplication.create({ data });
  },

  async findById(id, tx = prisma) {
    return tx.loanApplication.findUnique({ where: { id: Number(id) } });
  },

  async findAllByUserId(userId, tx = prisma) {
    return tx.loanApplication.findMany({ where: { userId } });
  },

  async updateStatus(id, status, tx = prisma) {
    return tx.loanApplication.update({
      where: { id: Number(id) },
      data: { status },
    });
  },

  async updateLoanApplication(id, data, tx = prisma) {
    return tx.loanApplication.update({
      where: { id: Number(id) },
      data,
    });
  }
};

module.exports = LoanApplicationModel;
