const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true, studentUsername: true }
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

showUsers().catch(e => {
  console.error(e);
  process.exit(1);
});
