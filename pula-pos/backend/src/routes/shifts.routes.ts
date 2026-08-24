import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth } from "../middleware/auth";
import { badRequest, notFound } from "../utils/errors";

export const shiftsRouter = Router();
shiftsRouter.use(requireBusinessAuth);

shiftsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const shifts = await prisma.shift.findMany({
      where: { businessId: req.auth!.businessId },
      include: { cashier: { select: { name: true } }, cashMovements: true, _count: { select: { sales: true } } },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
    res.json(shifts);
  })
);

shiftsRouter.get(
  "/current",
  asyncHandler(async (req, res) => {
    const shift = await prisma.shift.findFirst({
      where: { businessId: req.auth!.businessId, cashierId: req.auth!.sub, status: "OPEN" },
      include: { cashMovements: true },
    });
    res.json(shift);
  })
);

const openSchema = z.object({ openingBalance: z.number().nonnegative(), terminalId: z.string().optional() });

shiftsRouter.post(
  "/open",
  asyncHandler(async (req, res) => {
    const data = openSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const existing = await prisma.shift.findFirst({ where: { businessId, cashierId: req.auth!.sub, status: "OPEN" } });
    if (existing) throw badRequest("You already have an open shift");
    const shift = await prisma.shift.create({
      data: { businessId, cashierId: req.auth!.sub, terminalId: data.terminalId, openingBalance: data.openingBalance },
    });
    res.status(201).json(shift);
  })
);

const closeSchema = z.object({ closingBalance: z.number().nonnegative() });

shiftsRouter.post(
  "/:id/close",
  asyncHandler(async (req, res) => {
    const data = closeSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const shift = await prisma.shift.findFirst({ where: { id: req.params.id, businessId }, include: { sales: true, cashMovements: true } });
    if (!shift) throw notFound();
    if (shift.status !== "OPEN") throw badRequest("Shift already closed");

    const cashSales = shift.sales
      .filter((s) => s.status === "COMPLETED" && s.paymentMethod === "CASH")
      .reduce((sum, s) => sum + Number(s.total), 0);
    const cashIn = shift.cashMovements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + Number(m.amount), 0);
    const cashOut = shift.cashMovements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + Number(m.amount), 0);
    const expectedBalance = Number(shift.openingBalance) + cashSales + cashIn - cashOut;

    const updated = await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "CLOSED", closedAt: new Date(), closingBalance: data.closingBalance, expectedBalance },
    });
    res.json({ ...updated, variance: data.closingBalance - expectedBalance });
  })
);

const cashMoveSchema = z.object({ shiftId: z.string(), type: z.enum(["CASH_IN", "CASH_OUT"]), amount: z.number().positive(), reason: z.string().min(1) });

shiftsRouter.post(
  "/cash-movement",
  asyncHandler(async (req, res) => {
    const data = cashMoveSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const shift = await prisma.shift.findFirst({ where: { id: data.shiftId, businessId, status: "OPEN" } });
    if (!shift) throw notFound("Open shift not found");
    const movement = await prisma.cashMovement.create({
      data: { businessId, shiftId: data.shiftId, type: data.type, amount: data.amount, reason: data.reason, createdById: req.auth!.sub },
    });
    res.status(201).json(movement);
  })
);
