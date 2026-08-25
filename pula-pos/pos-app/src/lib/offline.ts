import { useEffect, useState } from "react";
import { api, ApiRequestError } from "./api";

/* ------------------------------ ids & status ------------------------------- */

/**
 * A locally-generated id used both as a temporary key for a queued offline
 * sale and as the idempotency key (`clientRef`) sent with every checkout —
 * so a sale that's retried after a partial failure (the response never made
 * it back, but the sale was actually created) is never double-recorded.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Tracks the browser's online/offline state, updating on the standard
 * `online`/`offline` window events. Not a perfect signal (a device can
 * report "online" while genuinely unable to reach the server), which is why
 * checkout() also treats a network-type fetch failure as offline regardless
 * of what this reports. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/* ------------------------------- local cache -------------------------------- */
// Products/customers are cached per business, not globally — a shared
// device that logs into a different business later never shows stale data
// left over from the previous one.

function cacheKey(businessId: string, kind: string) {
  return `pula_cache_${businessId}_${kind}`;
}

function readCache<T>(businessId: string, kind: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(businessId, kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(businessId: string, kind: string, data: T) {
  try {
    localStorage.setItem(cacheKey(businessId, kind), JSON.stringify({ savedAt: new Date().toISOString(), data }));
  } catch {
    /* storage full/unavailable — caching is a nice-to-have, never fatal */
  }
}

export function loadProductsCache<T>(businessId: string): T[] | null {
  return readCache<T[]>(businessId, "products");
}
export function saveProductsCache<T>(businessId: string, products: T[]) {
  writeCache(businessId, "products", products);
}

export function loadCustomersCache<T>(businessId: string): T[] | null {
  return readCache<T[]>(businessId, "customers");
}
export function saveCustomersCache<T>(businessId: string, customers: T[]) {
  writeCache(businessId, "customers", customers);
}

/** Keeps a cached/in-memory product list's stock counts honest immediately
 * after an offline sale is queued — there's no server round-trip to refresh
 * from until that sale actually syncs, so without this the POS screen would
 * keep showing pre-sale stock for the rest of the outage. */
export function applyLocalStockDecrement<T extends { id: string; quantity: string }>(
  products: T[],
  items: { productId: string; quantity: number }[]
): T[] {
  const byId = new Map(items.map((i) => [i.productId, i.quantity]));
  return products.map((p) => {
    const qty = byId.get(p.id);
    return qty === undefined ? p : { ...p, quantity: String(Math.max(0, Number(p.quantity) - qty)) };
  });
}

/** Same adjustment, applied straight to the persisted cache (not just
 * in-memory state) so it survives a refresh while still offline. */
export function decrementCachedStock(businessId: string, items: { productId: string; quantity: number }[]) {
  const cached = loadProductsCache<{ id: string; quantity: string }>(businessId);
  if (!cached) return;
  saveProductsCache(businessId, applyLocalStockDecrement(cached, items));
}

/* --------------------------------- outbox ------------------------------------ */

export interface QueuedSale {
  clientRef: string;
  queuedAt: string;
  payload: Record<string, unknown>;
  lastError?: string;
}

function queueKey(businessId: string) {
  return `pula_offline_queue_${businessId}`;
}

export function getQueuedSales(businessId: string): QueuedSale[] {
  try {
    const raw = localStorage.getItem(queueKey(businessId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(businessId: string, queue: QueuedSale[]) {
  try {
    localStorage.setItem(queueKey(businessId), JSON.stringify(queue));
  } catch {
    /* if storage is full there's nothing more we can do locally */
  }
}

/** Saves a checkout payload (already carrying its `clientRef`) into the
 * local outbox so it can be replayed once the connection comes back. */
export function enqueueSale(businessId: string, payload: Record<string, unknown> & { clientRef: string }) {
  const queue = getQueuedSales(businessId);
  queue.push({ clientRef: payload.clientRef, queuedAt: new Date().toISOString(), payload });
  writeQueue(businessId, queue);
}

export function removeQueuedSale(businessId: string, clientRef: string) {
  writeQueue(businessId, getQueuedSales(businessId).filter((q) => q.clientRef !== clientRef));
}

function updateQueuedSale(businessId: string, clientRef: string, patch: Partial<QueuedSale>) {
  writeQueue(businessId, getQueuedSales(businessId).map((q) => (q.clientRef === clientRef ? { ...q, ...patch } : q)));
}

/**
 * Replays every queued sale for this business, oldest first. A sale the
 * server actually rejects (stock ran out before it synced, license lapsed,
 * etc.) is left in the queue with its error recorded rather than silently
 * dropped, so nothing is ever lost — it just needs someone to look at it. A
 * plain network failure mid-run stops the loop immediately instead of
 * burning through the rest of the queue while still offline.
 */
export async function syncQueuedSales(businessId: string): Promise<{ synced: number; failed: number }> {
  const queue = getQueuedSales(businessId);
  let synced = 0;
  let failed = 0;
  for (const item of queue) {
    try {
      await api.post("/sales", item.payload);
      removeQueuedSale(businessId, item.clientRef);
      synced++;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        updateQueuedSale(businessId, item.clientRef, { lastError: err.message });
        failed++;
      } else {
        break; // network failure — likely offline again, stop and retry later
      }
    }
  }
  return { synced, failed };
}
