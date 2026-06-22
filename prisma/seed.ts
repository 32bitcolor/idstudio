import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";

// Idempotent seed: creates the first admin user + a workspace if absent.
// Safe to run on every deploy — it no-ops once the admin exists.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@idstudio.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
const WORKSPACE_NAME = process.env.SEED_WORKSPACE_NAME ?? "Demo Workspace";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`[seed] admin ${ADMIN_EMAIL} already exists — skipping.`);
    return;
  }

  const passwordHash = await hash(ADMIN_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: "Admin",
      passwordHash,
      memberships: {
        create: {
          role: "ADMIN",
          workspace: { create: { name: WORKSPACE_NAME, slug: slugify(WORKSPACE_NAME) } },
        },
      },
    },
  });

  console.log(`[seed] created admin "${ADMIN_EMAIL}" + workspace "${WORKSPACE_NAME}".`);
  console.log(`[seed] sign in with ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (change this!).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[seed] failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
