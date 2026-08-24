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
  quoteNumber: z.string().min(1),
  customerId: z.string().optional(),
  items: z.array(lineItem),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  validUntil: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED"]).optional(),
});

export const quotationsRouter = buildTenantCrudRouter(prisma.quotation as any, {
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ["quoteNumber"],
  include: { customer: true },
});
