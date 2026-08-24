import crypto from "crypto";

/** Generates a license key like PULA-2026-4F3A-9K2Q */
export function generateLicenseKey(year = new Date().getFullYear()): string {
  const block = () =>
    crypto.randomBytes(2).toString("hex").toUpperCase().slice(0, 4);
  return `PULA-${year}-${block()}-${block()}`;
}
