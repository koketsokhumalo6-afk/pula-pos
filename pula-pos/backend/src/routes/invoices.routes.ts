import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildTenantCrudRouter } from "./genericCrud";

const lineItem = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const createSchema = z.object({
  invoiceNumber: z.string().min(1),
  customerId: z.string(),
  items: z.array(lineItem),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  amountPaid: z.number().nonnegative().default(0),
  dueDate: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
});

export const invoicesRouter = buildTenantCrudRouter(prisma.invoice as any, {
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ["invoiceNumber"],
  include: { customer: true },
});
