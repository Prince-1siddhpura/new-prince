/**
 * EduNova Production Administrator Provisioning Script
 * 
 * Safely provisions an authentic administrator without dummy seed data.
 * Usage: node scripts/bootstrap_admin.js [email] [password] [name]
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function bootstrapAdmin() {
  const email = (process.argv[2] || process.env.ADMIN_INITIAL_EMAIL || 'admin@edunova.in').toLowerCase().trim();
  const password = process.argv[3] || process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecure2026!';
  const name = process.argv[4] || 'EduNova Chief Administrator';

  console.log(`Checking administrator account for: ${email}`);

  const existing = await prisma.user.findUnique({ where: { email } });

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'ADMIN',
        isEmailVerified: true,
        passwordHash,
      },
    });
    console.log(`✅ User ${updated.email} (${updated.id}) successfully updated to ADMIN role.`);
  } else {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'ADMIN',
        learnerType: 'COLLEGE',
        isEmailVerified: true,
      },
    });
    console.log(`✅ Administrator account created successfully: ${created.email} (${created.id})`);
  }

  await prisma.$disconnect();
}

bootstrapAdmin().catch((err) => {
  console.error('❌ Failed to bootstrap administrator:', err);
  process.exit(1);
});
