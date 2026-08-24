import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface LicenseStatus {
  status: string;
  daysRemaining: number | null;
  expiryDate: string | null;
}

/** Shows a warning banner when the business's yearly license is expiring or expired. */
export function LicenseBanner() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    api.get<LicenseStatus>("/license/status").then(setLicense).catch(() => setLicense(null));
  }, []);

  if (!license || license.status === "NONE") return null;

  const isExpired = license.status === "EXPIRED" || (license.daysRemaining ?? 1) < 0;
  const isSuspended = license.status === "SUSPENDED" || license.status === "CANCELLED";
  const expiringSoon = !isExpired && license.daysRemaining !== null && license.daysRemaining <= 14;

  if (isSuspended) {
    return (
      <div className="banner banner-danger">
        Your Pula POS account is suspended. Please contact your Pula POS provider to reinstate access.
      </div>
    );
  }
  if (isExpired) {
    return (
      <div className="banner banner-danger">
        Your license has expired. New sales are blocked until it is renewed — contact your Pula POS provider to renew.
      </div>
    );
  }
  if (expiringSoon) {
    return (
      <div className="banner banner-warning">
        Your license expires in {license.daysRemaining} day{license.daysRemaining === 1 ? "" : "s"} — renew soon to avoid
        interruption.
      </div>
    );
  }
  return null;
}
