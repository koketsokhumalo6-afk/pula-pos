import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. Handles connection pooling to the hosted
// PostgreSQL instance — nothing for the customer to install or configure.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
