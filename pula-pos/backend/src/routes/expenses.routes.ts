import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildTenantCrudRouter } from "./genericCrud";

const createSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  date: z.coerce.date().optional(),
  createdBy: z.string().optional(),
});

export const expensesRouter = buildTenantCrudRouter(prisma.expense as any, {
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ["category", "description"],
  orderBy: { date: "desc" },
});
