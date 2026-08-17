import { PrismaPg } from "@prisma/adapter-pg";

import { getEnv } from "@/env";

import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // `getEnv()` throws a named error listing what is missing, rather than the
    // non-null assertion this had before, which would have handed the adapter
    // `undefined` and failed much later with something far less readable.
    adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;