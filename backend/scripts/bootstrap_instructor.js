/**
 * EduNova Instructor Provisioning & Password Reset Script
 * 
 * Usage: node scripts/bootstrap_instructor.js [email] [password] [name]
 * Example: node scripts/bootstrap_instructor.js instructor@edunova.org 12345678 "Dr. Sarah Adams"
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

async function bootstrapInstructor() {
  const email = (process.argv[2] || 'instructor@edunova.org').toLowerCase().trim();
  const password = process.argv[3] || '12345678';
  const name = process.argv[4] || 'EduNova Senior Instructor';

  if (password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters.');
    process.exit(1);
  }

  console.log(`Checking instructor account for: ${email}`);

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'INSTRUCTOR',
        isEmailVerified: true,
        passwordHash,
      },
    });
    console.log(`✅ User ${updated.email} (${updated.id}) successfully updated to INSTRUCTOR role with password.`);
  } else {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'INSTRUCTOR',
        isEmailVerified: true,
      },
    });
    console.log(`✅ Instructor user created: ${created.email} (${created.id}) with INSTRUCTOR role.`);
  }

  await prisma.$disconnect();
}

bootstrapInstructor().catch((err) => {
  console.error('❌ Failed to bootstrap instructor:', err);
  prisma.$disconnect();
  process.exit(1);
});
