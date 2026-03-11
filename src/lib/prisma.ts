import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL!;

  // Parse MySQL URL: mysql://user:password@host:port/database
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parseInt(parsed.port || "3306"),
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1), // remove leading /
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
