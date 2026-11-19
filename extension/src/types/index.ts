export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type CountryAvailabilityStatus = "available" | "unavailable" | "coming_soon";

export interface ServerSummary {
  id: string;
  name: string;
  country_code: string;
  country_name: string;
  flag_emoji: string;
  city: string;
  hostname?: string;
  port?: number;
  scheme: "https" | "http" | "socks5" | string;
  protocol_type: string;
  public_exit_ip?: string | null;
  tier: "free" | "pro" | string;
  status: "healthy" | "degraded" | "offline" | "unknown" | string;
  is_operational: boolean;
  latency_ms: number | null;
  load_percent: number;
  last_health_check_at: string | null;
}

export interface CountrySummary {
  code: string;
  name: string;
  flag_emoji: string;
  region: string;
  availability_status: CountryAvailabilityStatus;
  health_status: "healthy" | "degraded" | "offline" | "unprovisioned" | string;
  operational_server_count: number;
  actual_server_id: string | null;
  server_endpoint: string | null;
  supported_protocol: string | null;
  public_exit_ip: string | null;
  best_latency_ms: number | null;
  recommended_server_id: string | null;
}

export interface ProxyConfigPayload {
  scheme: "https" | "http" | "socks5";
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  bypass_list: string[];
  encryption_note: string;
}

export interface ConnectSessionResponse {
  session_id: string;
  server: ServerSummary;
  proxy: ProxyConfigPayload;
  expected_exit_ip: string | null;
  expires_at: string;
  max_session_minutes: number;
  protection_scope: string;
}

export interface AuthSession {
  accessToken: string;
  userId: string;
  email: string | null;
  isGuest: boolean;
  planTier: string;
  expiresAt: number;
}

export interface UserUsage {
  plan_tier: string;
  daily_sessions_used: number;
  daily_sessions_limit: number;
  max_session_minutes: number;
  rate_limit_per_minute: number;
  active_session_id: string | null;
  fair_use_policy: string;
}

export interface ExtensionSettings {
  apiBaseUrl: string;
  autoConnectOnStartup: boolean;
  autoReconnect: boolean;
  connectionNotifications: boolean;
  webrtcProtection: boolean;
  disableNetworkPrediction: boolean;
  onboardingCompleted: boolean;
}

export interface ConnectionState {
  status: ConnectionStatus;
  sessionId: string | null;
  selectedServer: ServerSummary | null;
  connectedServer: ServerSummary | null;
  originalIp: string | null;
  currentIp: string | null;
  expectedExitIp: string | null;
  exitIpVerified: boolean;
  connectedAt: number | null;
  expiresAt: string | null;
  encryptionNote: string | null;
  webrtcPolicyStatus: "protected" | "overridden" | "disabled";
  errorMessage: string | null;
  recentServerIds: string[];
  favoriteCountryCodes: string[];
}

export type BackgroundMessage =
  | { type: "GET_STATE" }
  | { type: "CONNECT"; serverId?: string; countryCode?: string }
  | { type: "DISCONNECT"; reason?: string }
  | { type: "REFRESH_IP" }
  | { type: "SELECT_SERVER"; server: ServerSummary }
  | { type: "TOGGLE_FAVORITE"; countryCode: string }
  | { type: "UPDATE_SETTINGS"; settings: Partial<ExtensionSettings> }
  | { type: "CLEAR_ALL_DATA" };
