import type { ProxyConfigPayload } from "../types";
import { saveEphemeralProxyCreds } from "../utils/storage";
import { validateProxyPayload } from "../utils/validation";

/**
 * Manages Chrome's browser proxy settings and privacy hardening via MV3 APIs.
 * Always cleans up proxy rules and ephemeral credentials on disconnect or error.
 */
export async function applyProxyConfiguration(proxy: ProxyConfigPayload): Promise<void> {
  validateProxyPayload(proxy);

  if (proxy.username && proxy.password) {
    await saveEphemeralProxyCreds({
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
    });
  } else {
    await saveEphemeralProxyCreds(null);
  }

  const config: chrome.proxy.ProxyConfig = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: proxy.scheme,
        host: proxy.host,
        port: proxy.port,
      },
      bypassList: proxy.bypass_list,
    },
  };

  await new Promise<void>((resolve, reject) => {
    chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export async function clearProxyConfiguration(): Promise<void> {
  await saveEphemeralProxyCreds(null);
  await new Promise<void>((resolve) => {
    chrome.proxy.settings.clear({ scope: "regular" }, () => {
      resolve();
    });
  });
}

export async function applyPrivacyProtections(options: {
  webrtcProtection: boolean;
  disableNetworkPrediction: boolean;
}): Promise<"protected" | "overridden" | "disabled"> {
  if (!chrome.privacy?.network) {
    return "disabled";
  }

  let webrtcStatus: "protected" | "overridden" | "disabled" = "disabled";

  if (options.webrtcProtection) {
    const details = await new Promise<chrome.types.ChromeSettingGetResultDetails>((resolve) => {
      chrome.privacy.network.webRTCIPHandlingPolicy.get({}, resolve);
    });
    if (
      details.levelOfControl === "controllable_by_this_extension" ||
      details.levelOfControl === "controlled_by_this_extension"
    ) {
      await new Promise<void>((resolve) => {
        chrome.privacy.network.webRTCIPHandlingPolicy.set(
          { value: "disable_non_proxied_udp" },
          () => resolve()
        );
      });
      webrtcStatus = "protected";
    } else {
      webrtcStatus = "overridden";
    }
  } else {
    await new Promise<void>((resolve) => {
      chrome.privacy.network.webRTCIPHandlingPolicy.clear({}, () => resolve());
    });
  }

  if (options.disableNetworkPrediction) {
    const netDetails = await new Promise<chrome.types.ChromeSettingGetResultDetails>((resolve) => {
      chrome.privacy.network.networkPredictionEnabled.get({}, resolve);
    });
    if (
      netDetails.levelOfControl === "controllable_by_this_extension" ||
      netDetails.levelOfControl === "controlled_by_this_extension"
    ) {
      await new Promise<void>((resolve) => {
        chrome.privacy.network.networkPredictionEnabled.set({ value: false }, () => resolve());
      });
    }
  } else {
    await new Promise<void>((resolve) => {
      chrome.privacy.network.networkPredictionEnabled.clear({}, () => resolve());
    });
  }

  return webrtcStatus;
}

export async function restorePrivacyProtections(): Promise<void> {
  if (!chrome.privacy?.network) return;
  await new Promise<void>((resolve) => {
    chrome.privacy.network.webRTCIPHandlingPolicy.clear({}, () => resolve());
  });
  await new Promise<void>((resolve) => {
    chrome.privacy.network.networkPredictionEnabled.clear({}, () => resolve());
  });
}
