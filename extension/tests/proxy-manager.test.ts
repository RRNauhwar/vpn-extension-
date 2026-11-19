import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyExitNodeIp } from "../src/background/connection-manager";
import {
  applyProxyConfiguration,
  clearProxyConfiguration,
} from "../src/background/proxy-manager";
import { validateProxyPayload, isValidApiUrl } from "../src/utils/validation";

describe("Proxy Validation, Exit-IP Verification & MV3 Proxy Manager", () => {
  const setProxyMock = vi.fn((_cfg, cb) => cb?.());
  const clearProxyMock = vi.fn((_cfg, cb) => cb?.());
  const sessionSetMock = vi.fn(async () => {});
  const sessionRemoveMock = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { lastError: undefined },
      proxy: {
        settings: {
          set: setProxyMock,
          clear: clearProxyMock,
        },
      },
      storage: {
        session: {
          set: sessionSetMock,
          remove: sessionRemoveMock,
        },
      },
    };
  });

  it("rejects invalid proxy schemes or ports", () => {
    expect(() =>
      validateProxyPayload({
        scheme: "ftp" as "https",
        host: "proxy.example.com",
        port: 443,
        bypass_list: [],
        encryption_note: "",
      })
    ).toThrow(/Unsupported proxy scheme/);

    expect(() =>
      validateProxyPayload({
        scheme: "https",
        host: "proxy.example.com",
        port: 70000,
        bypass_list: [],
        encryption_note: "",
      })
    ).toThrow(/Invalid proxy port/);
  });

  it("validates API URLs (HTTPS or localhost only)", () => {
    expect(isValidApiUrl("https://api.globevpn.example/api")).toBe(true);
    expect(isValidApiUrl("http://localhost:8000/api")).toBe(true);
    expect(isValidApiUrl("http://insecure-remote.example/api")).toBe(false);
  });

  it("verifies observed exit IP matches expected regional exit node IP", () => {
    expect(verifyExitNodeIp("198.51.100.42", "198.51.100.42").valid).toBe(true);
    const mismatch = verifyExitNodeIp("203.0.113.9", "198.51.100.42");
    expect(mismatch.valid).toBe(false);
    expect(mismatch.reason).toMatch(/expected 198\.51\.100\.42, observed 203\.0\.113\.9/);
  });

  it("applies HTTPS proxy configuration and stores credentials in RAM-only session storage", async () => {
    await applyProxyConfiguration({
      scheme: "https",
      host: "de-fra-01.globevpn.example",
      port: 443,
      username: "ephemeral_user",
      password: "ephemeral_password",
      bypass_list: ["localhost", "127.0.0.1"],
      encryption_note: "TLS encrypted",
    });

    expect(sessionSetMock).toHaveBeenCalledTimes(1);
    expect(setProxyMock).toHaveBeenCalledTimes(1);
    const appliedConfig = setProxyMock.mock.calls[0][0];
    expect(appliedConfig.value.mode).toBe("fixed_servers");
    expect(appliedConfig.value.rules.singleProxy.scheme).toBe("https");
    expect(appliedConfig.value.rules.singleProxy.host).toBe("de-fra-01.globevpn.example");
    expect(appliedConfig.value.rules.singleProxy.port).toBe(443);
  });

  it("clears proxy settings and wipes session credentials on disconnect", async () => {
    await clearProxyConfiguration();
    expect(sessionRemoveMock).toHaveBeenCalledTimes(1);
    expect(clearProxyMock).toHaveBeenCalledTimes(1);
  });
});
