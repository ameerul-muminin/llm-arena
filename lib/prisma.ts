import { PrismaPg } from "@prisma/adapter-pg";

import { getEnv } from "@/env";

import { PrismaClient } from "./generated/prisma/client";

// Optional, because on the very first load it genuinely is not there. Typing it
// as always-present made the `??` below dead code as far as the compiler was
// concerned, and would have let any other reader of it skip a null check that
// reality still requires.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // `getEnv()` throws a named error listing what is missing, rather than the
    // non-null assertion this had before, which would have handed the adapter
    // `undefined` and failed much later with something far less readable.
    adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
