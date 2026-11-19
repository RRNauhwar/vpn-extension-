import React, { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Globe, Shield, Trash2 } from "lucide-react";
import { BRAND_CONFIG } from "../config/branding";
import { connectionStore } from "../store/connection-store";
import type { ExtensionSettings } from "../types";
import { DEFAULT_SETTINGS, getSettings } from "../utils/storage";
import { isValidApiUrl } from "../utils/validation";

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [savedBanner, setSavedBanner] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const update = async (partial: Partial<ExtensionSettings>) => {
    if (partial.apiBaseUrl !== undefined && !isValidApiUrl(partial.apiBaseUrl)) {
      setUrlError("API URL must use HTTPS (or http://localhost for local testing).");
      return;
    }
    setUrlError(null);
    const next = await connectionStore.updateSettings(partial);
    setSettings(next);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const handleClear = async () => {
    await connectionStore.clearAllData();
    const fresh = await getSettings();
    setSettings(fresh);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 text-slate-100">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric-500 to-violetglow-500 flex items-center justify-center shadow-glow">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{BRAND_CONFIG.productName} Settings</h1>
            <p className="text-xs text-slate-400">
              Connection behavior and browser-level privacy controls
            </p>
          </div>
        </div>
        {savedBanner && (
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs flex items-center gap-1 border border-emerald-500/30">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* Connection & Startup */}
      <section className="p-5 rounded-2xl bg-navy-800/80 border border-white/5 space-y-4">
        <h2 className="text-sm font-semibold text-electric-400">Connection & Startup</h2>
        {[
          {
            key: "autoConnectOnStartup" as const,
            title: "Auto-connect on browser startup",
            desc: "Automatically reconnect to your last selected operational region when Chrome launches.",
          },
          {
            key: "autoReconnect" as const,
            title: "Auto-reconnect on failure or expiry",
            desc: "Automatically re-establish a healthy session if the active proxy node degrades.",
          },
          {
            key: "connectionNotifications" as const,
            title: "Connection notifications",
            desc: "Show desktop notifications when connected or when a connection fails.",
          },
        ].map((item) => (
          <label
            key={item.key}
            className="flex items-start justify-between gap-4 cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={settings[item.key]}
              onChange={(e) => void update({ [item.key]: e.target.checked })}
              className="mt-1 h-4 w-4 accent-electric-500"
            />
          </label>
        ))}
      </section>

      {/* Privacy & Browser Protection */}
      <section className="p-5 rounded-2xl bg-navy-800/80 border border-white/5 space-y-4">
        <h2 className="text-sm font-semibold text-electric-400 flex items-center gap-1.5">
          <Shield className="w-4 h-4" /> Browser Privacy Controls
        </h2>
        {[
          {
            key: "webrtcProtection" as const,
            title: "WebRTC IP leak mitigation",
            desc: "Sets chrome.privacy.network.webRTCIPHandlingPolicy to disable_non_proxied_udp while connected.",
          },
          {
            key: "disableNetworkPrediction" as const,
            title: "Disable DNS prefetch & network prediction",
            desc: "Prevents speculative DNS pre-resolution while the browser proxy is active.",
          },
        ].map((item) => (
          <label
            key={item.key}
            className="flex items-start justify-between gap-4 cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={settings[item.key]}
              onChange={(e) => void update({ [item.key]: e.target.checked })}
              className="mt-1 h-4 w-4 accent-electric-500"
            />
          </label>
        ))}
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          Important: {BRAND_CONFIG.productName} provides browser-only encrypted proxy protection
          inside Chrome. Non-browser apps, OS-level IPv6/UDP traffic, and system services are not
          tunneled.
        </p>
      </section>

      {/* Collapsed Advanced Developer Override */}
      <section className="p-5 rounded-2xl bg-navy-800/50 border border-white/5 space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Advanced (Developer / Self-Hosted Override)
          </span>
          {showAdvanced ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-slate-400">
              End users never need to change this. Override only when pointing a custom build to a
              self-hosted GlobeVPN control plane.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={settings.apiBaseUrl}
                onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-navy-900 border border-white/10 text-white"
              />
              <button
                type="button"
                onClick={() => void update({ apiBaseUrl: settings.apiBaseUrl })}
                className="px-4 py-2 rounded-xl bg-electric-500 hover:bg-electric-400 text-xs font-semibold text-white"
              >
                Save URL
              </button>
            </div>
            {urlError && <p className="text-xs text-rose-400">{urlError}</p>}
          </div>
        )}
      </section>

      {/* Data Reset */}
      <section className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-rose-300">Clear Application Data</h2>
          <p className="text-xs text-slate-400">
            Disconnects proxy, restores browser settings, and clears stored preferences and tokens.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleClear()}
          className="px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-xs font-semibold text-white flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Data
        </button>
      </section>
    </div>
  );
};

export default Settings;
