import { getAccessToken } from "./api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

/**
 * Downloads a file from an authenticated API endpoint (a CSV export, a
 * backup). A plain `<a href>` link can't carry the Bearer token our API
 * requires, so this fetches the file as a blob and triggers the browser's
 * save dialog via a temporary object URL instead.
 */
export async function downloadFile(path: string, filename: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
