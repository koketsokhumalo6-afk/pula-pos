import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildTenantCrudRouter } from "./genericCrud";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export const customersRouter = buildTenantCrudRouter(prisma.customer as any, {
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ["name", "phone", "email"],
});
