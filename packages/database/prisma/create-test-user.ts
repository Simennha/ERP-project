/**
 * One-off dev script: create a "Staff" role (read-only across every module,
 * no admin/create/update/delete permissions) and a normal user with it, for
 * testing what the app looks like as a non-admin. Not part of the regular
 * seed — run manually, then delete.
 *
 * Run: pnpm --filter @erp/database exec ts-node prisma/create-test-user.ts
 * (wrapped in dotenv-cli via the shell command below so it reads the root .env)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const READ_ONLY_PERMISSION_KEYS = [
  'inventory:product.read',
  'inventory:warehouse.manage',
  'sales:order.read',
  'sales:customer.read',
  'finance:invoice.read',
  'hr:employee.read',
  'procurement:purchaseOrder.read',
  'projects:project.read',
  'admin:audit.read',
];

async function main(): Promise<void> {
  const company = await prisma.company.findFirstOrThrow();

  const staffRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Staff' } },
    update: { description: 'Read-only access across modules; no create/update/delete/admin.' },
    create: {
      companyId: company.id,
      name: 'Staff',
      description: 'Read-only access across modules; no create/update/delete/admin.',
      isSystem: false,
    },
  });

  const permissions = await prisma.permission.findMany({
    where: { key: { in: READ_ONLY_PERMISSION_KEYS } },
  });
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: staffRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: staffRole.id, permissionId: permission.id },
    });
  }
  console.log(`Staff role ready with ${permissions.length} read-only permissions`);

  const email = 'staff@example.com';
  const password = 'StaffPass123!';
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email } },
    update: { name: 'Sam Staff', isActive: true, passwordHash },
    create: { companyId: company.id, email, name: 'Sam Staff', passwordHash, isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: staffRole.id } },
    update: {},
    create: { userId: user.id, roleId: staffRole.id },
  });

  console.log(`User ready: ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
