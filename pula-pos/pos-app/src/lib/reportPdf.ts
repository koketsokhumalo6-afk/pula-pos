import { jsPDF } from "jspdf";

/** One section of a report PDF — a heading, optional key/value summary
 * lines, and/or an optional simple data table. Used both for a single
 * section's own "Download PDF" button and for the combined "Download Full
 * Report" that stacks every section into one document. */
export interface PdfSection {
  heading: string;
  summaryLines?: string[];
  columns?: string[];
  rows?: (string | number)[][];
  note?: string;
}

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_X = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 16;

/**
 * Builds a plain, print-friendly A4 report PDF from one or more sections —
 * hand-drawn with jsPDF's own text/line primitives rather than a table
 * plugin (jsPDF is already a dependency for receipts; this avoids adding
 * one just for reports). Handles pagination itself so a long table or many
 * sections flow onto additional pages automatically.
 */
export function buildReportPdf(opts: {
  title: string;
  businessName: string;
  periodLabel: string;
  sections: PdfSection[];
}): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 20;

  function ensureSpace(needed: number) {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      y = 20;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(opts.title, MARGIN_X, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(90);
  doc.text(opts.businessName, MARGIN_X, y);
  y += 5.5;
  doc.text(opts.periodLabel, MARGIN_X, y);
  y += 5;
  doc.setTextColor(0);
  doc.setDrawColor(190);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 9;

  for (const section of opts.sections) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text(section.heading, MARGIN_X, y);
    y += 6.5;

    if (section.summaryLines?.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      for (const line of section.summaryLines) {
        ensureSpace(5.2);
        doc.text(line, MARGIN_X, y);
        y += 5.2;
      }
      y += 1.5;
    }

    if (section.columns?.length && section.rows?.length) {
      const colCount = section.columns.length;
      const colWidth = CONTENT_WIDTH / colCount;

      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        section.columns!.forEach((c, i) => doc.text(c, MARGIN_X + i * colWidth, y, { maxWidth: colWidth - 3 }));
        y += 1.8;
        doc.setDrawColor(200);
        doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
        y += 4.3;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
      };

      ensureSpace(9);
      drawHeader();

      for (const row of section.rows) {
        if (y + 5 > BOTTOM_LIMIT) {
          doc.addPage();
          y = 20;
          drawHeader();
        }
        row.forEach((cell, i) => doc.text(String(cell), MARGIN_X + i * colWidth, y, { maxWidth: colWidth - 3 }));
        y += 5;
      }
      y += 3;
    } else if (!section.summaryLines?.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(section.note || "No data for this period.", MARGIN_X, y);
      doc.setTextColor(0);
      y += 6;
    }

    y += 5;
  }

  return doc;
}
