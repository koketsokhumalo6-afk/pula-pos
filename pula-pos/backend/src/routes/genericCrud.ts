import { Router } from "express";
import type { ZodSchema } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole, BusinessAuthPayload } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { notFound, unauthorized } from "../utils/errors";

type PrismaDelegate = {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
};

interface CrudOptions {
  createSchema: ZodSchema;
  updateSchema: ZodSchema;
  /** roles allowed to write (create/update/delete); read is any authenticated staff */
  writeRoles?: BusinessAuthPayload["role"][];
  orderBy?: Record<string, "asc" | "desc">;
  include?: Record<string, unknown>;
  searchFields?: string[];
}

/**
 * Builds a tenant-scoped REST router (list/get/create/update/delete) for a
 * Prisma model, automatically filtering every query by the caller's
 * businessId so one business can never see another's data.
 */
export function buildTenantCrudRouter(delegate: PrismaDelegate, opts: CrudOptions) {
  const router = Router();
  const writeRoles = opts.writeRoles ?? ["OWNER", "ADMIN", "MANAGER"];

  router.use(requireBusinessAuth);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const businessId = req.auth!.businessId;
      const q = (req.query.q as string) || undefined;
      const where: any = { businessId };
      if (q && opts.searchFields?.length) {
        where.OR = opts.searchFields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
      }
      const items = await delegate.findMany({ where, include: opts.include, orderBy: opts.orderBy ?? { createdAt: "desc" } });
      res.json(items);
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const item = await delegate.findFirst({
        where: { id: req.params.id, businessId: req.auth!.businessId },
        include: opts.include,
      });
      if (!item) throw notFound();
      res.json(item);
    })
  );

  router.post(
    "/",
    requireRole(...writeRoles),
    requireActiveLicense(),
    asyncHandler(async (req, res) => {
      const data = opts.createSchema.parse(req.body);
      const item = await delegate.create({ data: { ...data, businessId: req.auth!.businessId } });
      res.status(201).json(item);
    })
  );

  router.put(
    "/:id",
    requireRole(...writeRoles),
    asyncHandler(async (req, res) => {
      const data = opts.updateSchema.parse(req.body);
      const existing = await delegate.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
      if (!existing) throw notFound();
      const item = await delegate.update({ where: { id: req.params.id }, data });
      res.json(item);
    })
  );

  router.delete(
    "/:id",
    requireRole(...writeRoles),
    asyncHandler(async (req, res) => {
      const existing = await delegate.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
      if (!existing) throw notFound();
      await delegate.delete({ where: { id: req.params.id } });
      res.status(204).send();
    })
  );

  return router;
}

export function ensureAuthed(req: any) {
  if (!req.auth) throw unauthorized();
  return req.auth as BusinessAuthPayload;
}
