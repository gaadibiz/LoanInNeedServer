const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const AddressModel = {
  async createAddress(userId, data, tx = prisma) {
    return tx.addressDetail.create({
      data: { ...data, user: { connect: { id: userId } } },
    });
  },

  async updateAddress(userId, data, tx = prisma) {
    return tx.addressDetail.update({
      where: { userId },
      data: { ...data },
    });
  },

  async findByUserId(userId, tx = prisma) {
    return tx.addressDetail.findUnique({ where: { userId } });
  },
};
module.exports = AddressModel;
