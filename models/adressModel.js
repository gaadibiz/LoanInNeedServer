const prisma = require('../utils/prismaClient');

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

  async upsertAddress(userId, data, tx = prisma) {
    return tx.addressDetail.upsert({
      where: { userId },
      update: data,
      create: { ...data, user: { connect: { id: userId } } },
    });
  },
};
module.exports = AddressModel;
