const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userCount = await prisma.user.count();
  const subjectCount = await prisma.subject.count();
  const quizCount = await prisma.quiz.count();
  const noteCount = await prisma.note.count();
  console.log(JSON.stringify({ userCount, subjectCount, quizCount, noteCount }));
  await prisma.$disconnect();
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
