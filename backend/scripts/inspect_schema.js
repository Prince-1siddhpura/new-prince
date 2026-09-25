const prisma = require('../config/db');

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentLinkCode" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentLinkCodeExpiresAt" TIMESTAMP(3);
  `);
  console.log('✅ Added parentLinkCode and parentLinkCodeExpiresAt columns non-destructively.');

  const cols = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;"
  );
  console.table(cols);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
