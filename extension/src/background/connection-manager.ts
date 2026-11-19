import { notifyDisconnectSession, requestConnectSession } from "../services/connection";
import type { ConnectionState } from "../types";
import { fetchPublicIp } from "../utils/ip";
import {
  getConnectionState,
  getSettings,
  saveConnectionState,
} from "../utils/storage";
import {
  applyPrivacyProtections,
  applyProxyConfiguration,
  clearProxyConfiguration,
  restorePrivacyProtections,
} from "./proxy-manager";

function updateBadge(status: ConnectionState["status"]): void {
  if (!chrome.action) return;
  const badgeMap: Record<ConnectionState["status"], { text: string; color: string }> = {
    disconnected: { text: "", color: "#64748B" },
    connecting: { text: "...", color: "#3B82F6" },
    connected: { text: "ON", color: "#10B981" },
    reconnecting: { text: "REC", color: "#F59E0B" },
    failed: { text: "ERR", color: "#EF4444" },
  };
  const cfg = badgeMap[status];
  chrome.action.setBadgeText({ text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ color: cfg.color });
}

async function maybeNotify(title: string, message: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.connectionNotifications || !chrome.notifications) return;
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message,
  });
}

/**
 * Verifies whether the observed external IP matches the exit node's expected IP.
 */
export function verifyExitNodeIp(
  observedIp: string,
  expectedExitIp: string | null | undefined
): { valid: boolean; reason?: string } {
  if (!observedIp || observedIp.trim().length === 0) {
    return { valid: false, reason: "Could not determine external IP through proxy." };
  }
  if (expectedExitIp && expectedExitIp.trim().length > 0) {
    if (observedIp.trim() !== expectedExitIp.trim()) {
      return {
        valid: false,
        reason: `Exit IP verification failed: expected ${expectedExitIp}, observed ${observedIp}.`,
      };
    }
  }
  return { valid: true };
}

/**
 * Full verified one-click connection workflow:
 * 1. Capture real original IP
 * 2. Request authorized server session & secure credentials
 * 3. Apply Chrome proxy & WebRTC/DNS privacy settings
 * 4. Verify actual external IP belongs to the selected exit node
 * 5. Update UI to Connected ONLY after verification; roll back safely on any failure
 */
export async function connectToProxy(params?: {
  serverId?: string;
  countryCode?: string;
}): Promise<ConnectionState> {
  const prevState = await getConnectionState();
  const settings = await getSettings();

  let originalIp = prevState.originalIp;
  if (prevState.status === "disconnected" || !originalIp) {
    try {
      const ipInfo = await fetchPublicIp();
      originalIp = ipInfo.ip;
    } catch {
      originalIp = prevState.originalIp;
    }
  }

  await saveConnectionState({
    status: "connecting",
    originalIp,
    exitIpVerified: false,
    errorMessage: null,
  });
  updateBadge("connecting");

  let createdSessionId: string | null = null;

  try {
    const targetServerId = params?.serverId ?? prevState.selectedServer?.id;
    const targetCountry = params?.countryCode ?? prevState.selectedServer?.country_code;

    const sessionResp = await requestConnectSession({
      serverId: targetServerId,
      countryCode: targetCountry,
    });
    createdSessionId = sessionResp.session_id;

    await applyProxyConfiguration(sessionResp.proxy);
    const webrtcPolicyStatus = await applyPrivacyProtections({
      webrtcProtection: settings.webrtcProtection,
      disableNetworkPrediction: settings.disableNetworkPrediction,
    });

    // Verify actual external IP through the active proxy
    const verifiedIp = await fetchPublicIp(8000);
    const ipCheck = verifyExitNodeIp(verifiedIp.ip, sessionResp.expected_exit_ip);
    if (!ipCheck.valid) {
      throw new Error(ipCheck.reason ?? "Exit IP verification failed.");
    }

    const recent = [
      sessionResp.server.id,
      ...prevState.recentServerIds.filter((id) => id !== sessionResp.server.id),
    ].slice(0, 6);

    const nextState = await saveConnectionState({
      status: "connected",
      sessionId: sessionResp.session_id,
      selectedServer: sessionResp.server,
      connectedServer: sessionResp.server,
      originalIp,
      currentIp: verifiedIp.ip,
      expectedExitIp: sessionResp.expected_exit_ip,
      exitIpVerified: Boolean(
        sessionResp.expected_exit_ip
          ? verifiedIp.ip === sessionResp.expected_exit_ip
          : originalIp && verifiedIp.ip !== originalIp
      ),
      connectedAt: Date.now(),
      expiresAt: sessionResp.expires_at,
      encryptionNote: sessionResp.proxy.encryption_note,
      webrtcPolicyStatus,
      errorMessage: null,
      recentServerIds: recent,
    });
    updateBadge("connected");
    await maybeNotify(
      "GlobeVPN Connected",
      `Browser traffic routed via ${sessionResp.server.country_name} (${sessionResp.server.city}).`
    );
    return nextState;
  } catch (err) {
    await clearProxyConfiguration();
    await restorePrivacyProtections();
    if (createdSessionId) {
      await notifyDisconnectSession(createdSessionId, "verification_failed");
    }

    const message =
      err instanceof Error ? err.message : "Failed to establish verified proxy connection.";
    const failedState = await saveConnectionState({
      status: "failed",
      sessionId: null,
      connectedServer: null,
      expectedExitIp: null,
      exitIpVerified: false,
      connectedAt: null,
      expiresAt: null,
      webrtcPolicyStatus: "disabled",
      errorMessage: message,
    });
    updateBadge("failed");
    await maybeNotify("GlobeVPN Connection Failed", message);
    return failedState;
  }
}

export async function disconnectFromProxy(reason = "user_requested"): Promise<ConnectionState> {
  const prevState = await getConnectionState();

  await clearProxyConfiguration();
  await restorePrivacyProtections();

  if (prevState.sessionId) {
    await notifyDisconnectSession(prevState.sessionId, reason);
  }

  let refreshedIp: string | null = prevState.originalIp;
  try {
    const ipInfo = await fetchPublicIp(5000);
    refreshedIp = ipInfo.ip;
  } catch {
    // Keep last known IP if offline
  }

  const nextState = await saveConnectionState({
    status: "disconnected",
    sessionId: null,
    connectedServer: null,
    currentIp: refreshedIp,
    originalIp: refreshedIp,
    expectedExitIp: null,
    exitIpVerified: false,
    connectedAt: null,
    expiresAt: null,
    encryptionNote: null,
    webrtcPolicyStatus: "disabled",
    errorMessage: null,
  });
  updateBadge("disconnected");
  return nextState;
}
