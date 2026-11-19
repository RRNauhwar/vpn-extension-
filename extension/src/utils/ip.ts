import { getSettings } from "./storage";

export interface IpLookupResult {
  ip: string;
  source: string;
}

/**
 * Fetches the real observed public IP address.
 * Tries the authorized backend /user/current-ip first (which routes through
 * Chrome's active proxy when connected to a remote proxy), with a fallback
 * to api.ipify.org over HTTPS. Never fabricates an IP.
 */
export async function fetchPublicIp(timeoutMs = 7000): Promise<IpLookupResult> {
  const settings = await getSettings();
  const base = settings.apiBaseUrl.replace(/\/+$/, "");

  const tryEndpoint = async (
    url: string,
    parser: (data: Record<string, unknown>) => string | null,
    sourceLabel: string
  ): Promise<IpLookupResult | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as Record<string, unknown>;
      const ip = parser(json);
      if (ip && ip.trim().length > 0) {
        return { ip: ip.trim(), source: sourceLabel };
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Prefer public HTTPS ipify check so proxy exit IP is accurately observed even when
  // backend runs on localhost (which is in the bypass list).
  const external = await tryEndpoint(
    "https://api64.ipify.org?format=json",
    (d) => (typeof d.ip === "string" ? d.ip : null),
    "ipify_https"
  );
  if (external) return external;

  const backend = await tryEndpoint(
    `${base}/user/current-ip`,
    (d) => (typeof d.ip === "string" ? d.ip : null),
    "backend_current_ip"
  );
  if (backend) return backend;

  throw new Error("Unable to verify public IP address. Check network or proxy connectivity.");
}
