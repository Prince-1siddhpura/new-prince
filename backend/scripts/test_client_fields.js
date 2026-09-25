const prisma = require('../config/db');

async function main() {
  const user = await prisma.user.findFirst({
    select: {
      id: true,
      email: true,
      role: true,
      isEmailVerified: true,
      otpAttempts: true,
      parentLinkCode: true,
    },
  });
  console.log('✅ Successfully queried Prisma Client with new fields:', user);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Query failed:', err.message);
  process.exit(1);
});
