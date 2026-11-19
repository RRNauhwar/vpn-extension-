import React from "react";
import { ChevronRight, Globe2, Signal } from "lucide-react";
import type { ConnectionState, CountrySummary, ServerSummary } from "../../types";
import { ConnectButton } from "../components/ConnectButton";
import { IpCard } from "../components/IpCard";
import { StatusBanner } from "../components/StatusBanner";

interface DashboardPageProps {
  state: ConnectionState;
  servers: ServerSummary[];
  countries: CountrySummary[];
  loadingServers: boolean;
  serverError: string | null;
  onToggleConnect: () => void;
  onOpenLocations: () => void;
  onRefreshIp: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  state,
  servers,
  countries,
  loadingServers,
  serverError,
  onToggleConnect,
  onOpenLocations,
  onRefreshIp,
}) => {
  const activeServer = state.connectedServer ?? state.selectedServer ?? servers[0] ?? null;
  const availableCountries = countries.filter((c) => c.availability_status === "available");
  const noNodesAvailable = !loadingServers && servers.length === 0;

  return (
    <div className="flex-1 flex flex-col justify-between pb-3 space-y-3">
      <StatusBanner state={state} />

      <ConnectButton
        status={state.status}
        disabled={
          (noNodesAvailable && state.status !== "connected") ||
          state.status === "connecting"
        }
        onClick={onToggleConnect}
      />

      {/* Quick country & server selector */}
      <div className="mx-4">
        <button
          type="button"
          onClick={onOpenLocations}
          className="w-full p-3.5 rounded-2xl bg-navy-800/80 hover:bg-navy-700/80 border border-white/5 flex items-center justify-between transition-colors text-left"
        >
          {activeServer ? (
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl leading-none">{activeServer.flag_emoji || "🌐"}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {activeServer.country_name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {activeServer.city} · {activeServer.scheme.toUpperCase()} Proxy
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <Globe2 className="w-5 h-5 text-electric-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-100 truncate">
                  {loadingServers
                    ? "Loading available countries..."
                    : serverError
                    ? "Control plane temporarily unreachable"
                    : `${availableCountries.length} live · ${countries.length} planned regions`}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {serverError
                    ? "Tap to view status or retry"
                    : "Tap to view live & coming soon countries"}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {activeServer?.latency_ms != null && (
              <span className="flex items-center gap-1 text-xs font-mono text-emerald-400">
                <Signal className="w-3.5 h-3.5" />
                {activeServer.latency_ms}ms
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </button>
      </div>

      <IpCard state={state} onRefreshIp={onRefreshIp} />

      {state.encryptionNote && state.status === "connected" && (
        <p className="mx-4 text-[10px] text-slate-400 leading-snug text-center">
          {state.encryptionNote}
        </p>
      )}
    </div>
  );
};
