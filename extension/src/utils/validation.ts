import type { ProxyConfigPayload } from "../types";

const ALLOWED_SCHEMES = new Set(["https", "http", "socks5"]);

export function isValidApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function validateProxyPayload(proxy: ProxyConfigPayload): void {
  if (!ALLOWED_SCHEMES.has(proxy.scheme)) {
    throw new Error(`Unsupported proxy scheme: ${proxy.scheme}`);
  }
  if (!proxy.host || typeof proxy.host !== "string" || /\s/.test(proxy.host)) {
    throw new Error("Invalid proxy host returned by control plane.");
  }
  if (!Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) {
    throw new Error("Invalid proxy port returned by control plane.");
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
