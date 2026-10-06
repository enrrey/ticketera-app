/** Remote images load directly in the browser, never through a server-side URL fetch. */
export function isEventImageUrl(value: string) {
  if (!value) return true;
  if (/^\/images\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes("..")) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return false;
    const host = url.hostname.toLowerCase();
    return host.includes(".") && !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal") && !host.endsWith(".test") && !/^[\d.]+$/.test(host) && !host.includes(":");
  } catch { return false; }
}
