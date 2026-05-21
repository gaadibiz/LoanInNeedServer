const prisma = require('./utils/prismaClient');

async function test() {
    const user = await prisma.user.findFirst({
        where: { phone: { contains: '9353834545' } },
        include: {
            loanApplications: true,
            loans: true,
            documents: true,
            panVerification: true,
            aadhaarVerification: true,
            address: true,
            employment: true
        }
    });

    if (!user) {
        console.log("User not found by phone");
        return;
    }

    console.log("User:", user.name);
    console.log("Phone:", user.phone);
    console.log("Loan Apps:", user.loanApplications.map(app => ({ id: app.id, status: app.status })));
    console.log("Loans:", user.loans.map(loan => ({ id: loan.id, status: loan.status })));
}

test().finally(() => prisma.$disconnect());
