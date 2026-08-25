import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus, getQueuedSales, syncQueuedSales } from "../lib/offline";

/**
 * Sits alongside LicenseBanner at the top of every authenticated page.
 * Shows when the browser is offline, and separately when there are queued
 * offline sales still waiting to sync — those two states aren't the same
 * moment (a sync can still be catching up for a few seconds right after
 * connectivity returns).
 */
export function OfflineBanner() {
  const { business } = useAuth();
  const online = useOnlineStatus();
  const businessId = business?.id || "";

  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    if (!businessId) return;
    setQueueCount(getQueuedSales(businessId).length);
  }, [businessId]);

  const runSync = useCallback(async () => {
    if (!businessId || syncing) return;
    if (!getQueuedSales(businessId).length) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncQueuedSales(businessId);
      if (result.failed > 0) {
        setSyncError(
          `${result.failed} offline sale${result.failed === 1 ? "" : "s"} couldn't sync and need${
            result.failed === 1 ? "s" : ""
          } a look — see Sales.`
        );
      }
    } finally {
      setSyncing(false);
      refreshCount();
    }
  }, [businessId, syncing, refreshCount]);

  useEffect(() => {
    refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Try the moment connectivity returns, and also once on load in case the
  // app was closed mid-outage last time with sales still queued.
  useEffect(() => {
    if (online) runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // A backstop retry in case a sync attempt stalls partway through (e.g. the
  // connection drops again right after coming back).
  useEffect(() => {
    if (!online) return;
    const id = setInterval(runSync, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (online && !queueCount) return null;

  return (
    <div className={`banner ${online ? "banner-info" : "banner-warning"}`}>
      {!online && "You're offline — the POS still works. Sales are saved on this device and will sync automatically once you're back online."}
      {online && queueCount > 0 &&
        (syncing
          ? `Syncing ${queueCount} offline sale${queueCount === 1 ? "" : "s"}…`
          : `${queueCount} offline sale${queueCount === 1 ? "" : "s"} waiting to sync.`)}
      {syncError && <span style={{ marginLeft: 10 }}>{syncError}</span>}
    </div>
  );
}
