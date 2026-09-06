import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma2: InstanceType<typeof PrismaClient> };

function createPrismaClient() {
  const dbPath = path.join(process.cwd(), "dev2.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma2 = globalForPrisma.prisma2 || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma2 = prisma2;
