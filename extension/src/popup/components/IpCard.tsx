import React from "react";
import { Lock, RefreshCw } from "lucide-react";
import type { ConnectionState } from "../../types";

interface IpCardProps {
  state: ConnectionState;
  onRefreshIp: () => void;
}

export const IpCard: React.FC<IpCardProps> = ({ state, onRefreshIp }) => {
  const isConnected = state.status === "connected";
  const ipChanged =
    isConnected &&
    state.originalIp &&
    state.currentIp &&
    state.originalIp !== state.currentIp;

  return (
    <div className="mx-4 p-3.5 rounded-2xl bg-navy-800/80 border border-white/5 space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
          Public IP Verification
        </span>
        <button
          type="button"
          onClick={onRefreshIp}
          className="text-[11px] text-electric-400 hover:text-electric-300 flex items-center gap-1 shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          Check IP
        </button>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-slate-400 shrink-0">Original IP</span>
          <span
            title={state.originalIp ?? ""}
            className="font-mono text-slate-200 truncate text-right"
          >
            {state.originalIp ?? "Checking..."}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-slate-400 shrink-0">Current IP</span>
          <span
            title={state.currentIp ?? ""}
            className={`font-mono truncate text-right ${
              ipChanged ? "text-emerald-400 font-semibold" : "text-slate-200"
            }`}
          >
            {state.currentIp ?? "Checking..."}
          </span>
        </div>
      </div>

      {isConnected && (
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-electric-400" />
            WebRTC: {state.webrtcPolicyStatus}
          </span>
          <span className={ipChanged ? "text-emerald-400" : "text-amber-300"}>
            {ipChanged ? "Exit IP Verified" : "Local / Same Exit IP"}
          </span>
        </div>
      )}
    </div>
  );
};
