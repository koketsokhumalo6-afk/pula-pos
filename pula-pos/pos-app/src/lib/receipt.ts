import { jsPDF } from "jspdf";
import { money, dateTime } from "./format";

export interface ReceiptItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** A flattened, printer-agnostic view of a completed sale — built either
 * straight from the POS cart right after checkout, or from a fetched sale
 * record when reprinting from Sales history. Kept separate from the API's
 * raw Sale shape so the receipt view doesn't care which source it came from. */
export interface ReceiptData {
  saleNumber: string;
  createdAt: string;
  cashierName: string;
  customerName: string | null;
  paymentMethod: string;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  changeDue: number;
}

export interface ReceiptBusiness {
  name: string;
  tradingName: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  currency: string;
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load logo"));
    img.src = dataUrl;
  });
}

type Command =
  | { kind: "image"; dataUrl: string; w: number; h: number }
  | { kind: "text"; text: string; align: "left" | "center" | "right"; bold?: boolean }
  | { kind: "row"; left: string; right: string; bold?: boolean }
  | { kind: "divider" };

const LINE_HEIGHT = 4.2; // mm, tuned for an 8pt monospace font on thermal paper

/** Renders a completed sale as a narrow receipt PDF sized for 58mm or 80mm
 * thermal paper. The page height is computed from the content itself
 * (receipts don't have a fixed page size) rather than using a fixed A-size. */
export async function buildReceiptPdf(sale: ReceiptData, business: ReceiptBusiness | null, widthMm: 58 | 80): Promise<jsPDF> {
  const marginX = 3;
  const contentWidth = widthMm - marginX * 2;
  const maxChars = widthMm === 58 ? 26 : 40;
  const truncate = (s: string) => (s.length > maxChars ? `${s.slice(0, maxChars - 1)}…` : s);

  const businessName = business?.tradingName || business?.name || "";
  const currency = business?.currency;

  const commands: Command[] = [];

  if (business?.logoUrl) {
    try {
      const { width, height } = await loadImageSize(business.logoUrl);
      const maxH = 14;
      const h = Math.min(maxH, height);
      const w = Math.min(contentWidth, (width / height) * h);
      commands.push({ kind: "image", dataUrl: business.logoUrl, w, h });
    } catch {
      /* logo failed to load — skip it, the rest of the receipt still prints */
    }
  }

  if (businessName) commands.push({ kind: "text", text: businessName, align: "center", bold: true });
  if (business?.address) commands.push({ kind: "text", text: business.address, align: "center" });
  if (business?.phone) commands.push({ kind: "text", text: business.phone, align: "center" });
  commands.push({ kind: "divider" });

  commands.push({ kind: "text", text: `Sale #: ${sale.saleNumber}`, align: "left" });
  commands.push({ kind: "text", text: dateTime(sale.createdAt), align: "left" });
  commands.push({ kind: "text", text: `Cashier: ${sale.cashierName}`, align: "left" });
  commands.push({ kind: "text", text: `Customer: ${sale.customerName || "Walk-in"}`, align: "left" });
  commands.push({ kind: "divider" });

  for (const item of sale.items) {
    commands.push({ kind: "text", text: truncate(item.name), align: "left" });
    const qty = item.unit && item.unit !== "each" ? `${item.quantity} ${item.unit}` : `${item.quantity}`;
    commands.push({ kind: "row", left: `  ${qty} x ${money(item.unitPrice, currency)}`, right: money(item.total, currency) });
  }
  commands.push({ kind: "divider" });

  commands.push({ kind: "row", left: "Subtotal", right: money(sale.subtotal, currency) });
  if (sale.discountTotal > 0) commands.push({ kind: "row", left: "Discount", right: `-${money(sale.discountTotal, currency)}` });
  if (sale.taxTotal > 0) commands.push({ kind: "row", left: "Tax", right: money(sale.taxTotal, currency) });
  commands.push({ kind: "row", left: "TOTAL", right: money(sale.total, currency), bold: true });
  commands.push({ kind: "row", left: `Paid (${sale.paymentMethod.replace("_", " ")})`, right: money(sale.amountPaid, currency) });
  if (sale.changeDue > 0) commands.push({ kind: "row", left: "Change", right: money(sale.changeDue, currency) });
  commands.push({ kind: "divider" });

  commands.push({ kind: "text", text: "Thank you for your business!", align: "center" });

  const marginTop = 5;
  const marginBottom = 8;
  const contentHeight = commands.reduce((sum, c) => sum + (c.kind === "image" ? c.h + 2 : LINE_HEIGHT), 0);
  const pageHeight = marginTop + contentHeight + marginBottom;

  const doc = new jsPDF({ unit: "mm", format: [widthMm, Math.max(pageHeight, 40)] });
  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  let y = marginTop;
  const xLeft = marginX;
  const xRight = widthMm - marginX;
  const xCenter = widthMm / 2;

  for (const c of commands) {
    if (c.kind === "image") {
      doc.addImage(c.dataUrl, "JPEG", xCenter - c.w / 2, y, c.w, c.h);
      y += c.h + 2;
    } else if (c.kind === "divider") {
      doc.setLineDashPattern([0.8, 0.8], 0);
      const lineY = y - LINE_HEIGHT / 2;
      doc.line(xLeft, lineY, xRight, lineY);
      y += LINE_HEIGHT;
    } else if (c.kind === "text") {
      doc.setFont("courier", c.bold ? "bold" : "normal");
      doc.text(c.text, c.align === "center" ? xCenter : c.align === "right" ? xRight : xLeft, y, { align: c.align });
      y += LINE_HEIGHT;
    } else {
      doc.setFont("courier", c.bold ? "bold" : "normal");
      doc.text(c.left, xLeft, y);
      doc.text(c.right, xRight, y, { align: "right" });
      y += LINE_HEIGHT;
    }
  }

  return doc;
}
