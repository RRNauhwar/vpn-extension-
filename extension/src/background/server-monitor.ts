import { fetchServerById } from "../services/servers";
import { getConnectionState, getSettings, saveConnectionState } from "../utils/storage";
import { connectToProxy, disconnectFromProxy } from "./connection-manager";

export const HEALTH_ALARM_NAME = "globevpn_health_check";

export function scheduleHealthMonitor(): void {
  chrome.alarms.create(HEALTH_ALARM_NAME, {
    periodInMinutes: 1,
  });
}

export async function runPeriodicHealthCheck(): Promise<void> {
  const state = await getConnectionState();
  if (state.status !== "connected" || !state.connectedServer) {
    return;
  }

  // Check session expiration
  if (state.expiresAt && Date.now() >= new Date(state.expiresAt).getTime()) {
    const settings = await getSettings();
    if (settings.autoReconnect) {
      await saveConnectionState({ status: "reconnecting" });
      await connectToProxy({ countryCode: state.connectedServer.country_code });
    } else {
      await disconnectFromProxy("session_expired");
    }
    return;
  }

  // Verify connected node is still reported operational by backend
  try {
    const fresh = await fetchServerById(state.connectedServer.id);
    if (!fresh.is_operational || fresh.status === "offline") {
      const settings = await getSettings();
      if (settings.autoReconnect) {
        await saveConnectionState({ status: "reconnecting" });
        await connectToProxy({ countryCode: state.connectedServer.country_code });
      } else {
        await disconnectFromProxy("server_offline");
      }
    } else {
      await saveConnectionState({ connectedServer: fresh });
    }
  } catch {
    // Transient network error — do not drop an active proxy prematurely
  }
}
