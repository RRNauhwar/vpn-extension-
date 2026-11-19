import { BRAND_CONFIG } from "../config/branding";
import type { AuthSession, ConnectionState, ExtensionSettings } from "../types";

const BUILD_API_BASE_URL =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL
    ? String((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL).trim()
    : BRAND_CONFIG.defaultApiBaseUrl;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: BUILD_API_BASE_URL,
  autoConnectOnStartup: false,
  autoReconnect: true,
  connectionNotifications: true,
  webrtcProtection: true,
  disableNetworkPrediction: true,
  onboardingCompleted: false,
};

export const DEFAULT_CONNECTION_STATE: ConnectionState = {
  status: "disconnected",
  sessionId: null,
  selectedServer: null,
  connectedServer: null,
  originalIp: null,
  currentIp: null,
  expectedExitIp: null,
  exitIpVerified: false,
  connectedAt: null,
  expiresAt: null,
  encryptionNote: null,
  webrtcPolicyStatus: "disabled",
  errorMessage: null,
  recentServerIds: [],
  favoriteCountryCodes: [],
};

const KEYS = {
  SETTINGS: "globevpn_settings",
  CONNECTION_STATE: "globevpn_connection_state",
  AUTH_SESSION: "globevpn_auth_session",
  DEVICE_ID: "globevpn_device_id",
  PROXY_CREDS: "globevpn_ephemeral_proxy_creds",
} as const;

export interface EphemeralProxyCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[KEYS.SETTINGS] ?? {}) };
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
  return next;
}

export async function getConnectionState(): Promise<ConnectionState> {
  const result = await chrome.storage.local.get(KEYS.CONNECTION_STATE);
  return { ...DEFAULT_CONNECTION_STATE, ...(result[KEYS.CONNECTION_STATE] ?? {}) };
}

export async function saveConnectionState(
  partial: Partial<ConnectionState>
): Promise<ConnectionState> {
  const current = await getConnectionState();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [KEYS.CONNECTION_STATE]: next });
  return next;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const result = await chrome.storage.local.get(KEYS.AUTH_SESSION);
  return (result[KEYS.AUTH_SESSION] as AuthSession | undefined) ?? null;
}

export async function saveAuthSession(session: AuthSession | null): Promise<void> {
  if (!session) {
    await chrome.storage.local.remove(KEYS.AUTH_SESSION);
    return;
  }
  await chrome.storage.local.set({ [KEYS.AUTH_SESSION]: session });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.DEVICE_ID);
  if (typeof result[KEYS.DEVICE_ID] === "string" && result[KEYS.DEVICE_ID].length > 8) {
    return result[KEYS.DEVICE_ID];
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await chrome.storage.local.set({ [KEYS.DEVICE_ID]: id });
  return id;
}

export async function saveEphemeralProxyCreds(
  creds: EphemeralProxyCredentials | null
): Promise<void> {
  if (!creds) {
    await chrome.storage.session.remove(KEYS.PROXY_CREDS);
    return;
  }
  await chrome.storage.session.set({ [KEYS.PROXY_CREDS]: creds });
}

export async function getEphemeralProxyCreds(): Promise<EphemeralProxyCredentials | null> {
  const result = await chrome.storage.session.get(KEYS.PROXY_CREDS);
  return (result[KEYS.PROXY_CREDS] as EphemeralProxyCredentials | undefined) ?? null;
}

export async function clearAllExtensionData(): Promise<void> {
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
}
