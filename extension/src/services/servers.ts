import type { CountrySummary, ServerSummary } from "../types";
import { apiRequest } from "./api";

export async function fetchOperationalServers(countryCode?: string): Promise<ServerSummary[]> {
  const qs = countryCode ? `?country_code=${encodeURIComponent(countryCode)}` : "";
  return apiRequest<ServerSummary[]>(`/servers${qs}`, { method: "GET" }, false);
}

export async function fetchOperationalCountries(): Promise<CountrySummary[]> {
  return apiRequest<CountrySummary[]>("/servers/countries", { method: "GET" }, false);
}

export async function fetchServerById(serverId: string): Promise<ServerSummary> {
  return apiRequest<ServerSummary>(`/servers/${encodeURIComponent(serverId)}`, { method: "GET" }, false);
}
