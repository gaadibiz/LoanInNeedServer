const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const UserModel = {
  // Create new user
  async createUser(data) {
    return prisma.user.create({ data });
  },

  // Find user by email
  async findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  // Find user by phone
  async findUserByPhone(phone) {
    return prisma.user.findUnique({ where: { phone } });
  },

  // Find user by ID
  async findUserById(id) {
    return prisma.user.findUnique({ where: { id: Number(id) } });
  },

  // Update user (transactional)
  async updateUser(id, updates, tx) {
    const client = tx || prisma; // Use transaction client if provided
    return client.user.update({
      where: { id: Number(id) },
      data: updates,
    });
  },

  // Delete user
  async deleteUser(where) {
    return prisma.user.deleteMany({ where });
  },
};

module.exports = UserModel;
