import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildTenantCrudRouter } from "./genericCrud";

const createSchema = z.object({
  name: z.string().min(1),
  // Required on create so every new customer is fully identifiable — the
  // main use is laybuy customers, where staff need to know exactly who to
  // collect the balance from and who's collecting the goods.
  idNumber: z.string().min(1, "ID number is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const customersRouter = buildTenantCrudRouter(prisma.customer as any, {
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ["name", "phone", "email", "idNumber"],
});
