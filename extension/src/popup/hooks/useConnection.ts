import { useCallback, useEffect, useState } from "react";
import { fetchOperationalCountries, fetchOperationalServers } from "../../services/servers";
import { connectionStore } from "../../store/connection-store";
import type {
  AuthSession,
  ConnectionState,
  CountrySummary,
  ExtensionSettings,
  ServerSummary,
} from "../../types";
import {
  DEFAULT_CONNECTION_STATE,
  DEFAULT_SETTINGS,
  getAuthSession,
  getSettings,
} from "../../utils/storage";

export function useConnection() {
  const [state, setState] = useState<ConnectionState>(DEFAULT_CONNECTION_STATE);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [st, cfg, authSess] = await Promise.all([
        connectionStore.getState(),
        getSettings(),
        getAuthSession(),
      ]);
      setState(st);
      setSettings(cfg);
      setAuth(authSess);

      if (!st.currentIp) {
        const refreshed = await connectionStore.refreshIp();
        setState(refreshed);
      }
    } catch {
      // Ignore if running outside Chrome runtime during tests
    }
  }, []);

  const refreshServers = useCallback(async () => {
    setLoadingServers(true);
    setServerError(null);
    try {
      const [srvs, cnts] = await Promise.all([
        fetchOperationalServers(),
        fetchOperationalCountries(),
      ]);
      setServers(srvs);
      setCountries(cnts);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Unable to reach GlobeVPN backend. Check API URL in Settings."
      );
      setServers([]);
      setCountries([]);
    } finally {
      setLoadingServers(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    void refreshServers();

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return;
      if (changes.globevpn_connection_state?.newValue) {
        setState(changes.globevpn_connection_state.newValue as ConnectionState);
      }
      if (changes.globevpn_settings?.newValue) {
        setSettings(changes.globevpn_settings.newValue as ExtensionSettings);
      }
      if (changes.globevpn_auth_session) {
        setAuth((changes.globevpn_auth_session.newValue as AuthSession | undefined) ?? null);
      }
    };

    chrome.storage?.onChanged?.addListener(listener);
    return () => {
      chrome.storage?.onChanged?.removeListener(listener);
    };
  }, [loadAll, refreshServers]);

  const toggleConnect = useCallback(async () => {
    if (state.status === "connected" || state.status === "connecting" || state.status === "reconnecting") {
      const next = await connectionStore.disconnect();
      setState(next);
    } else {
      const target = state.selectedServer ?? servers[0];
      const next = await connectionStore.connect({
        serverId: target?.id,
        countryCode: target?.country_code,
      });
      setState(next);
    }
  }, [state.status, state.selectedServer, servers]);

  const selectAndConnect = useCallback(async (server: ServerSummary) => {
    await connectionStore.selectServer(server);
    const next = await connectionStore.connect({
      serverId: server.id,
      countryCode: server.country_code,
    });
    setState(next);
  }, []);

  const toggleFavorite = useCallback(async (countryCode: string) => {
    const next = await connectionStore.toggleFavorite(countryCode);
    setState(next);
  }, []);

  const completeOnboarding = useCallback(async () => {
    const next = await connectionStore.updateSettings({ onboardingCompleted: true });
    setSettings(next);
  }, []);

  return {
    state,
    settings,
    auth,
    servers,
    countries,
    loadingServers,
    serverError,
    refreshServers,
    toggleConnect,
    selectAndConnect,
    toggleFavorite,
    completeOnboarding,
    setAuth,
  };
}
