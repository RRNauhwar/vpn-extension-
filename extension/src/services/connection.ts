import type { ConnectSessionResponse } from "../types";
import { apiRequest } from "./api";
import { ensureAuthSession } from "./auth";

export async function requestConnectSession(params: {
  serverId?: string;
  countryCode?: string;
}): Promise<ConnectSessionResponse> {
  await ensureAuthSession();
  return apiRequest<ConnectSessionResponse>(
    "/connect/session",
    {
      method: "POST",
      body: JSON.stringify({
        server_id: params.serverId ?? null,
        country_code: params.countryCode ?? null,
      }),
    },
    true
  );
}

export async function notifyDisconnectSession(
  sessionId: string,
  reason = "user_requested"
): Promise<void> {
  try {
    await apiRequest(
      "/disconnect/session",
      {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, reason }),
      },
      true
    );
  } catch {
    // Disconnection cleanup in Chrome must still succeed even if backend is unreachable.
  }
}
