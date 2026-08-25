import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";

import { authRouter } from "./routes/auth.routes";
import { adminRouter } from "./routes/admin.routes";
import { productsRouter } from "./routes/products.routes";
import { categoriesRouter } from "./routes/categories.routes";
import { customersRouter } from "./routes/customers.routes";
import { suppliersRouter } from "./routes/suppliers.routes";
import { salesRouter } from "./routes/sales.routes";
import { purchasesRouter } from "./routes/purchases.routes";
import { expensesRouter } from "./routes/expenses.routes";
import { invoicesRouter } from "./routes/invoices.routes";
import { quotationsRouter } from "./routes/quotations.routes";
import { staffRouter } from "./routes/staff.routes";
import { shiftsRouter } from "./routes/shifts.routes";
import { terminalsRouter } from "./routes/terminals.routes";
import { reportsRouter } from "./routes/reports.routes";
import { licenseStatusRouter } from "./routes/license.routes";
import { businessRouter } from "./routes/business.routes";
import { dataToolsRouter } from "./routes/dataTools.routes";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.posAppOrigin, env.adminAppOrigin, "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
// 20mb (not the previous 2mb) so a business's own full data backup can be
// posted back in through POST /data-tools/restore — a mature business's
// sales/purchase history can add up.
app.use(express.json({ limit: "20mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "pula-pos-api" }));

// Public + shared auth
app.use("/api/auth", authRouter);

// Master admin portal (Pula POS operator only)
app.use("/api/admin", adminRouter);

// Business/tenant-scoped API (every route below requires a business user token)
app.use("/api/license", licenseStatusRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/customers", customersRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/quotations", quotationsRouter);
app.use("/api/staff", staffRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/terminals", terminalsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/business", businessRouter);
app.use("/api/data-tools", dataToolsRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Pula POS API listening on port ${env.port} (${env.nodeEnv})`);
});
