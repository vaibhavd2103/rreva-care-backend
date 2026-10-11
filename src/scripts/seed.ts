import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

async function main(): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user");
  }
  const email = adminEmail.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Admin already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: { email, passwordHash, role: "ADMIN" },
  });

  // eslint-disable-next-line no-console
  console.log("Seeded admin:", email);
}

main()
  .catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
