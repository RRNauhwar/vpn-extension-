import { getAuthSession, getSettings, saveAuthSession } from "../utils/storage";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = false
): Promise<T> {
  const settings = await getSettings();
  const baseUrl = settings.apiBaseUrl.replace(/\/+$/, "");
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (requireAuth) {
    const session = await getAuthSession();
    if (session?.accessToken) {
      headers.set("Authorization", `Bearer ${session.accessToken}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    if (baseUrl.includes("://localhost")) {
      const ipv4Url = baseUrl.replace("://localhost", "://127.0.0.1");
      try {
        response = await fetch(`${ipv4Url}${path}`, {
          ...options,
          headers,
        });
      } catch {
        throw new ApiError(
          "GlobeVPN control plane is currently unreachable. Please check your internet connection or try again shortly.",
          0
        );
      }
    } else {
      throw new ApiError(
        "GlobeVPN control plane is currently unreachable. Please check your internet connection or try again shortly.",
        0
      );
    }
  }

  if (response.status === 401 && requireAuth) {
    await saveAuthSession(null);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // ignore non-JSON error body
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}
