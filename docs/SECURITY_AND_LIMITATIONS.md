# Security Architecture & Browser-Proxy Limitations

## 1. Security Controls Implemented

- **No Hardcoded Secrets or Credentials:** Proxy credentials are never embedded in extension source code. They are resolved server-side (preferring environment variable references) and delivered only over authenticated API sessions.
- **RAM-Only Credential Storage:** Active proxy credentials are stored exclusively in `chrome.storage.session` (in-memory only, automatically wiped on browser exit or disconnect) and never persisted to `localStorage` or disk.
- **Least-Privilege Manifest V3 Permissions:**
  - `proxy` — Configure and clear Chrome browser proxy settings.
  - `privacy` — Apply `webRTCIPHandlingPolicy` (`disable_non_proxied_udp`) and disable `networkPredictionEnabled`.
  - `webRequest` + `webRequestAuthProvider` + `<all_urls>` — Required by Chrome MV3 to answer proxy 407 authentication challenges automatically without prompting the user on every origin.
  - `storage`, `alarms`, `notifications` — Persist non-sensitive preferences, run periodic server health checks, and display optional connection alerts.
- **Zero Browsing History Collection:** The backend never logs visited URLs, DNS queries, or user browsing traffic. Request middleware logs only method, control-plane path, status code, and latency, and redacts sensitive keys.
- **Fail-Safe Rollback & Cleanup:** If connection setup or IP verification fails, or if Chrome restarts without auto-connect enabled, `chrome.proxy.settings.clear()` and `restorePrivacyProtections()` execute immediately so the browser is never left in a broken or hijacked state.

## 2. Explicit Browser-Proxy Limitations

GlobeVPN is a **Chrome browser proxy extension**, NOT a full-device OS VPN:

1. **Non-Browser Traffic:** Terminal commands, desktop apps, background OS updates, and other browsers bypass Chrome's proxy completely.
2. **Protocol Encryption Distinction:**
   - **HTTPS Proxy (`scheme: "https"`):** Encrypts the browser-to-proxy leg using TLS (recommended for all production exit nodes).
   - **SOCKS5 / HTTP Proxy:** Does **not** provide VPN-level tunnel encryption between Chrome and the proxy node. End-to-end confidentiality relies on visiting `https://` websites.
3. **WebRTC Leaks:** Mitigated via `chrome.privacy.network.webRTCIPHandlingPolicy = "disable_non_proxied_udp"`, but only when GlobeVPN holds `controllable_by_this_extension` / `controlled_by_this_extension`. If another extension or enterprise policy overrides this setting, GlobeVPN flags `WebRTC: overridden` in the UI.
4. **DNS, IPv6, and QUIC/HTTP3 Behavior:**
   - Chrome delegates hostname resolution to HTTPS/SOCKS5 proxies for proxied web requests, and GlobeVPN disables speculative DNS prefetching (`networkPredictionEnabled: false`).
   - However, Chrome Extensions **cannot** disable OS-level IPv6 interfaces, block non-HTTP UDP sockets outside WebRTC, or intercept Chrome's internal system requests that bypass proxy rules.
   - Always verify DNS, WebRTC, IPv6, and exit IP behavior independently (e.g., via `ipleak.net` / `browserleaks.com`) against your deployed production TLS exit nodes before claiming leak immunity.
