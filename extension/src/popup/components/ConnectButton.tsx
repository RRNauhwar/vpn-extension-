import React from "react";
import { Loader2, Power, RefreshCw, ShieldAlert } from "lucide-react";
import type { ConnectionStatus } from "../../types";

interface ConnectButtonProps {
  status: ConnectionStatus;
  disabled?: boolean;
  onClick: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({
  status,
  disabled,
  onClick,
}) => {
  const styles: Record<
    ConnectionStatus,
    { outer: string; inner: string; ring: string; label: string }
  > = {
    disconnected: {
      outer: "from-slate-700/60 to-slate-800/80 border-white/10",
      inner: "from-navy-800 to-navy-900 text-slate-200 hover:from-electric-600/20 hover:to-violetglow-600/20",
      ring: "border-slate-500/20",
      label: "Tap to Connect",
    },
    connecting: {
      outer: "from-electric-500/50 to-violetglow-500/50 border-electric-400/50 shadow-glow",
      inner: "from-electric-600 to-violetglow-600 text-white",
      ring: "border-electric-400/60 animate-pulse-ring",
      label: "Verifying Proxy...",
    },
    connected: {
      outer: "from-emerald-400/50 to-teal-500/50 border-emerald-400/60 shadow-glow-emerald",
      inner: "from-emerald-500 to-teal-600 text-white",
      ring: "border-emerald-400/40",
      label: "Browser Protected",
    },
    reconnecting: {
      outer: "from-amber-400/50 to-orange-500/50 border-amber-400/60",
      inner: "from-amber-500 to-orange-600 text-white",
      ring: "border-amber-400/60 animate-pulse-ring",
      label: "Reconnecting...",
    },
    failed: {
      outer: "from-rose-500/50 to-red-600/50 border-rose-400/60",
      inner: "from-rose-600 to-red-700 text-white",
      ring: "border-rose-400/40",
      label: "Retry Connection",
    },
  };

  const current = styles[status];

  return (
    <div className="flex flex-col items-center justify-center py-3">
      <div className="relative flex items-center justify-center">
        <div
          className={`absolute w-36 h-36 rounded-full border-2 pointer-events-none ${current.ring}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          aria-label={current.label}
          className={`relative w-32 h-32 rounded-full p-1.5 bg-gradient-to-br border transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${current.outer}`}
        >
          <div
            className={`w-full h-full rounded-full bg-gradient-to-br flex flex-col items-center justify-center gap-1 transition-all duration-300 ${current.inner}`}
          >
            {status === "connecting" ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : status === "reconnecting" ? (
              <RefreshCw className="w-9 h-9 animate-spin" />
            ) : status === "failed" ? (
              <ShieldAlert className="w-9 h-9" />
            ) : (
              <Power className="w-9 h-9" />
            )}
            <span className="text-[11px] font-medium tracking-wide opacity-90">
              {status === "connected" ? "DISCONNECT" : "CONNECT"}
            </span>
          </div>
        </button>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-300">{current.label}</p>
    </div>
  );
};
