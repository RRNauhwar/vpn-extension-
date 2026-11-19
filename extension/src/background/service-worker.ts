import type { BackgroundMessage } from "../types";
import { fetchPublicIp } from "../utils/ip";
import {
  clearAllExtensionData,
  getConnectionState,
  getEphemeralProxyCreds,
  getSettings,
  saveConnectionState,
  saveSettings,
} from "../utils/storage";
import { connectToProxy, disconnectFromProxy } from "./connection-manager";
import { clearProxyConfiguration, restorePrivacyProtections } from "./proxy-manager";
import {
  HEALTH_ALARM_NAME,
  runPeriodicHealthCheck,
  scheduleHealthMonitor,
} from "./server-monitor";

// Handle proxy authentication challenges using RAM-only ephemeral credentials
chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    if (!details.isProxy) {
      callback?.({});
      return;
    }
    getEphemeralProxyCreds()
      .then((creds) => {
        if (
          creds &&
          details.challenger &&
          details.challenger.host === creds.host &&
          details.challenger.port === creds.port
        ) {
          callback?.({
            authCredentials: {
              username: creds.username,
              password: creds.password,
            },
          });
        } else {
          callback?.({});
        }
      })
      .catch(() => {
        callback?.({});
      });
  },
  { urls: ["<all_urls>"] },
  ["asyncBlocking"]
);

// Detect fatal proxy errors and trigger safe rollback or auto-reconnect
chrome.proxy.onProxyError.addListener(async (details) => {
  const state = await getConnectionState();
  if (state.status !== "connected") return;

  if (details.fatal) {
    const settings = await getSettings();
    if (settings.autoReconnect && state.connectedServer) {
      await saveConnectionState({ status: "reconnecting" });
      await connectToProxy({ countryCode: state.connectedServer.country_code });
    } else {
      await disconnectFromProxy(`proxy_error:${details.error}`);
    }
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  scheduleHealthMonitor();
  await clearProxyConfiguration();
});

chrome.runtime.onStartup.addListener(async () => {
  scheduleHealthMonitor();
  const settings = await getSettings();
  const state = await getConnectionState();

  // Ephemeral session credentials clear on browser restart; reconnect cleanly if enabled,
  // otherwise ensure no stale proxy config blocks browsing.
  if (settings.autoConnectOnStartup && state.selectedServer) {
    await connectToProxy({ serverId: state.selectedServer.id });
  } else if (state.status === "connected" || state.status === "connecting") {
    await disconnectFromProxy("browser_restarted");
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEALTH_ALARM_NAME) {
    void runPeriodicHealthCheck();
  }
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse) => {
    const handle = async () => {
      switch (message.type) {
        case "GET_STATE":
          return getConnectionState();
        case "CONNECT":
          return connectToProxy({
            serverId: message.serverId,
            countryCode: message.countryCode,
          });
        case "DISCONNECT":
          return disconnectFromProxy(message.reason ?? "user_requested");
        case "REFRESH_IP": {
          const state = await getConnectionState();
          try {
            const ipInfo = await fetchPublicIp();
            return saveConnectionState({
              currentIp: ipInfo.ip,
              originalIp: state.status === "disconnected" ? ipInfo.ip : state.originalIp,
            });
          } catch {
            return state;
          }
        }
        case "SELECT_SERVER":
          return saveConnectionState({ selectedServer: message.server });
        case "TOGGLE_FAVORITE": {
          const state = await getConnectionState();
          const exists = state.favoriteCountryCodes.includes(message.countryCode);
          const nextFavs = exists
            ? state.favoriteCountryCodes.filter((c) => c !== message.countryCode)
            : [...state.favoriteCountryCodes, message.countryCode];
          return saveConnectionState({ favoriteCountryCodes: nextFavs });
        }
        case "UPDATE_SETTINGS":
          return saveSettings(message.settings);
        case "CLEAR_ALL_DATA":
          await clearProxyConfiguration();
          await restorePrivacyProtections();
          await clearAllExtensionData();
          return getConnectionState();
        default:
          return getConnectionState();
      }
    };

    handle()
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          error: err instanceof Error ? err.message : "Unexpected extension error",
        })
      );

    return true; // keep message channel open for async response
  }
);
