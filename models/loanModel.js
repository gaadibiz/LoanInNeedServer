const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');

const LoanModel = {
  /**
   * Create a new loan for a user
   * @param {number} userId 
   * @param {object} data - { loanAmount, purposeOfLoan, interestRate, termMonths, startDate, status }
   * @param {object} tx - Optional Prisma transaction client
   */
  async createLoan(userId, data, tx = prisma) {
    const client = tx;

    // Validate user existence
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError(`User with id=${userId} not found`);

    // Validate required fields
    if (!data.loanAmount || isNaN(Number(data.loanAmount)) || Number(data.loanAmount) <= 0) {
      throw new BadRequestError("Invalid or missing loan amount");
    }

    const payload = {
      loanAmount: Number(data.loanAmount),
      purposeOfLoan: data.purposeOfLoan || null,
      interestRate: data.interestRate ? Number(data.interestRate) : 0,
      termMonths: data.termMonths ? Number(data.termMonths) : null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      status: data.status || 'PENDING',
      user: { connect: { id: userId } },
    };

    try {
      const loan = await client.loan.create({ data: payload });
      logger.info('✅ Loan created for userId=%s loanId=%s', userId, loan.id);
      return loan;
    } catch (err) {
      logger.error('❌ Error creating loan for userId=%s: %s', userId, err.message);
      throw err;
    }
  },

  /**
   * Fetch all loans for a user (with optional pagination)
   */
  async findAllByUserId(userId, page = 1, limit = 10, tx = prisma) {
    const client = tx;
    return client.loan.findMany({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Fetch single loan by ID
   */
  async findById(loanId, tx = prisma) {
    const client = tx;
    const loan = await client.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundError(`Loan with id=${loanId} not found`);
    return loan;
  },

  /**
   * Update a loan's status safely
   */
  async updateLoanStatus(loanId, status, tx = prisma) {
    const client = tx;
    const validStatus = ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED'];
    if (!validStatus.includes(status)) throw new BadRequestError('Invalid loan status');

    const loan = await client.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundError(`Loan with id=${loanId} not found`);

    const updatedLoan = await client.loan.update({
      where: { id: loanId },
      data: { status },
    });
    logger.info('✅ Loan status updated loanId=%s status=%s', loanId, status);
    return updatedLoan;
  },

  /**
   * Update other loan fields
   */
  async updateLoanDetails(loanId, data, tx = prisma) {
    const client = tx;
    const loan = await client.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundError(`Loan with id=${loanId} not found`);

    const allowedFields = ['loanAmount', 'purposeOfLoan', 'interestRate', 'termMonths', 'startDate'];
    const payload = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) payload[key] = data[key];
    }

    const updatedLoan = await client.loan.update({
      where: { id: loanId },
      data: payload,
    });
    logger.info('✅ Loan updated loanId=%s', loanId);
    return updatedLoan;
  },

  /**
   * Delete a loan by ID
   */
  async deleteLoan(loanId, tx = prisma) {
    const client = tx;
    const loan = await client.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundError(`Loan with id=${loanId} not found`);

    const deleted = await client.loan.delete({ where: { id: loanId } });
    logger.info('✅ Loan deleted loanId=%s', loanId);
    return deleted;
  },
};

module.exports = LoanModel;
