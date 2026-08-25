import { Router } from "express";
import { execSync } from "child_process";
import { Client } from "pg";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, unauthorized } from "../utils/errors";

export const migrateRouter = Router();

/**
 * TEMPORARY one-time migration helper — copies every row from this
 * service's own database into a separate target database (set via
 * NEON_DATABASE_URL), preserving every row's original id so relationships
 * stay intact. Runs from inside this already-running service so it can
 * reach the source database over Render's private network, sidestepping
 * that database's external-access restriction entirely.
 *
 * Gated by a shared secret (MIGRATE_SECRET) known only to whoever triggers
 * it. Safe to leave in place afterward — unsetting MIGRATE_SECRET makes
 * this route permanently refuse every request, with no other effect on the
 * app. Delete this file and its mount in index.ts whenever it's no longer
 * needed.
 */

// Parents before children, so every foreign key it copies already points
// at a row that exists.
const TABLES_IN_ORDER = [
  "SuperAdmin",
  "Plan",
  "Business",
  "License",
  "LicenseEvent",
  "User",
  "Terminal",
  "Category",
  "Product",
  "Customer",
  "Supplier",
  "Shift",
  "CashMovement",
  "Purchase",
  "PurchaseItem",
  "Sale",
  "SaleItem",
  "LaybuyPayment",
  "StockMovement",
  "Expense",
  "Invoice",
  "Quotation",
];

migrateRouter.post(
  "/migrate-to-neon",
  asyncHandler(async (req, res) => {
    const secret = req.header("x-migrate-secret");
    if (!process.env.MIGRATE_SECRET || secret !== process.env.MIGRATE_SECRET) {
      throw unauthorized();
    }
    const targetUrl = process.env.NEON_DATABASE_URL;
    if (!targetUrl) throw badRequest("NEON_DATABASE_URL is not set.");

    // 1. Create the schema on the target database — the same `prisma db
    // push` seed.ts already runs against this service's own database on
    // every boot, just retargeted at NEON_DATABASE_URL for this one
    // subprocess only (the running app's own DATABASE_URL is untouched).
    try {
      execSync("npx prisma db push --accept-data-loss --skip-generate", {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: targetUrl },
        stdio: "pipe",
      });
    } catch (err: any) {
      throw badRequest(`Schema push to Neon failed: ${err?.stderr?.toString?.() || err?.message || "unknown error"}`);
    }

    // 2. Copy every row, table by table, in dependency order.
    const source = new Client({ connectionString: process.env.DATABASE_URL });
    const dest = new Client({ connectionString: targetUrl });
    await source.connect();
    await dest.connect();

    const counts: Record<string, { source: number; copied: number }> = {};
    try {
      for (const table of TABLES_IN_ORDER) {
        const { rows } = await source.query(`SELECT * FROM "${table}"`);
        let copied = 0;
        for (const row of rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          const colList = cols.map((c) => `"${c}"`).join(", ");
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
          // Postgres already parsed any json/jsonb column into a real JS
          // object/array. node-pg's own parameter serialization treats a
          // plain JS array as a SQL array literal (comma-joined, not JSON),
          // which corrupts json columns that hold arrays (e.g. Invoice.items,
          // Quotation.items) — "invalid input syntax for type json". Re-stringify
          // any object/array value ourselves so it round-trips as valid JSON text.
          const values = cols.map((c) => {
            const v = row[c];
            if (v !== null && typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v)) {
              return JSON.stringify(v);
            }
            return v;
          });
          await dest.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          copied++;
        }
        counts[table] = { source: rows.length, copied };
      }
    } finally {
      await source.end();
      await dest.end();
    }

    res.json({ ok: true, counts });
  })
);
