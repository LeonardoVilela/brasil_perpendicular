const TRACKING_EXACT = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "igshid", "igsh", "si", "feature",
  "ref", "ref_src", "ref_url", "mc_cid", "mc_eid", "yclid", "twclid", "ttclid",
]);

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_EXACT.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.hash = "";
  let result = url.toString();
  if (result.endsWith("?")) result = result.slice(0, -1);
  return result;
}
