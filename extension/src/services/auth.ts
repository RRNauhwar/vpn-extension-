import type { AuthSession, UserUsage } from "../types";
import { getAuthSession, getOrCreateDeviceId, saveAuthSession } from "../utils/storage";
import { apiRequest } from "./api";

interface TokenApiResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  email: string | null;
  is_guest: boolean;
  plan_tier: string;
}

function toAuthSession(res: TokenApiResponse): AuthSession {
  return {
    accessToken: res.access_token,
    userId: res.user_id,
    email: res.email,
    isGuest: res.is_guest,
    planTier: res.plan_tier,
    expiresAt: Date.now() + res.expires_in * 1000,
  };
}

export async function ensureAuthSession(): Promise<AuthSession> {
  const existing = await getAuthSession();
  if (existing && existing.expiresAt > Date.now() + 30_000) {
    return existing;
  }
  const deviceId = await getOrCreateDeviceId();
  const res = await apiRequest<TokenApiResponse>("/auth/guest", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId }),
  });
  const session = toAuthSession(res);
  await saveAuthSession(session);
  return session;
}

export async function registerUser(email: string, password: string): Promise<AuthSession> {
  const res = await apiRequest<TokenApiResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const session = toAuthSession(res);
  await saveAuthSession(session);
  return session;
}

export async function loginUser(email: string, password: string): Promise<AuthSession> {
  const res = await apiRequest<TokenApiResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const session = toAuthSession(res);
  await saveAuthSession(session);
  return session;
}

export async function logoutUser(): Promise<void> {
  await saveAuthSession(null);
}

export async function fetchUserUsage(): Promise<UserUsage> {
  await ensureAuthSession();
  return apiRequest<UserUsage>("/user/usage", { method: "GET" }, true);
}
