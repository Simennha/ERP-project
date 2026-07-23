/**
 * Database seed (idempotent).
 *
 * Seeds:
 *  - one Company (SEED_COMPANY_NAME, default "Demo Company")
 *  - the full Permission registry (upsert by unique key)
 *  - an "Owner" system Role with EVERY permission attached
 *  - one admin User (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) with the Owner role
 *
 * Run: `pnpm --filter @erp/database db:seed`
 * (the db:seed script wraps this in dotenv-cli so the root .env is loaded).
 *
 * NOTE: PERMISSION_DEFINITIONS is imported directly from the contracts package
 * SOURCE (not its built dist) so seeding has no build-order dependency — you
 * can seed straight after `pnpm install` + `prisma migrate`.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSION_DEFINITIONS } from '../../contracts/src/permissions';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function main(): Promise<void> {
  const companyName = process.env.SEED_COMPANY_NAME ?? 'Demo Company';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  // 1. Company — no natural unique key besides id, so find-or-create by name.
  let company = await prisma.company.findFirst({ where: { name: companyName } });
  if (!company) {
    company = await prisma.company.create({ data: { name: companyName } });
    console.log(`Created company "${company.name}" (${company.id})`);
  } else {
    console.log(`Company "${company.name}" already exists (${company.id})`);
  }

  // 2. Permission registry — upsert every definition by its unique key.
  for (const def of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { module: def.module, description: def.description },
      create: { key: def.key, module: def.module, description: def.description },
    });
  }
  const allPermissions = await prisma.permission.findMany();
  console.log(`Upserted ${allPermissions.length} permissions`);

  // 3. Owner role — system role (isSystem = true so it cannot be deleted).
  const ownerRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Owner' } },
    update: { isSystem: true, description: 'Full access to every module and setting.' },
    create: {
      companyId: company.id,
      name: 'Owner',
      description: 'Full access to every module and setting.',
      isSystem: true,
    },
  });
  console.log(`Owner role ready (${ownerRole.id})`);

  // 4. Attach ALL permissions to the Owner role.
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: ownerRole.id, permissionId: permission.id },
      },
      update: {},
      create: { roleId: ownerRole.id, permissionId: permission.id },
    });
  }
  console.log(`Attached ${allPermissions.length} permissions to Owner role`);

  // 5. Admin user. Password is (re)hashed on every seed so the documented
  //    dev credentials always work after seeding. CHANGE THIS IN PRODUCTION.
  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: adminEmail } },
    update: { name: 'Administrator', isActive: true, passwordHash },
    create: {
      companyId: company.id,
      email: adminEmail,
      name: 'Administrator',
      passwordHash,
      isActive: true,
    },
  });
  console.log(`Admin user ready: ${admin.email} (${admin.id})`);

  // 6. Assign the Owner role to the admin user.
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: admin.id, roleId: ownerRole.id },
  });

  console.log('\nSeed complete.');
  console.log(`  Login: ${adminEmail}`);
  console.log(`  Password: ${adminPassword}  (dev default — change it!)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
