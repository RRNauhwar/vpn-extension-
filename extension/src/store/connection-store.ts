import type { BackgroundMessage, ConnectionState, ExtensionSettings, ServerSummary } from "../types";

export async function sendBgMessage<T = ConnectionState>(
  message: BackgroundMessage
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && typeof response === "object" && "error" in response && response.error) {
        reject(new Error(String(response.error)));
        return;
      }
      resolve(response as T);
    });
  });
}

export const connectionStore = {
  getState: () => sendBgMessage<ConnectionState>({ type: "GET_STATE" }),
  connect: (opts?: { serverId?: string; countryCode?: string }) =>
    sendBgMessage<ConnectionState>({
      type: "CONNECT",
      serverId: opts?.serverId,
      countryCode: opts?.countryCode,
    }),
  disconnect: (reason?: string) =>
    sendBgMessage<ConnectionState>({ type: "DISCONNECT", reason }),
  refreshIp: () => sendBgMessage<ConnectionState>({ type: "REFRESH_IP" }),
  selectServer: (server: ServerSummary) =>
    sendBgMessage<ConnectionState>({ type: "SELECT_SERVER", server }),
  toggleFavorite: (countryCode: string) =>
    sendBgMessage<ConnectionState>({ type: "TOGGLE_FAVORITE", countryCode }),
  updateSettings: (settings: Partial<ExtensionSettings>) =>
    sendBgMessage<ExtensionSettings>({ type: "UPDATE_SETTINGS", settings }),
  clearAllData: () => sendBgMessage<ConnectionState>({ type: "CLEAR_ALL_DATA" }),
};
