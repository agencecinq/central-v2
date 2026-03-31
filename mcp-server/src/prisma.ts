import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../src/generated/prisma/client.js");

type PrismaClientType = InstanceType<typeof PrismaClient>;

let prisma: PrismaClientType | undefined;

export function getPrisma(): PrismaClientType {
  if (!prisma) {
    const url = process.env.DATABASE_URL!;
    const adapter = new PrismaPg({ connectionString: url });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
