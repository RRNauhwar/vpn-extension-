import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Radio, ShieldOff } from "lucide-react";
import type { ConnectionState } from "../../types";

interface StatusBannerProps {
  state: ConnectionState;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ state }) => {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (state.status !== "connected" || !state.connectedAt) {
      setElapsed("00:00:00");
      return;
    }
    const tick = () => setElapsed(formatDuration(Date.now() - state.connectedAt!));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.status, state.connectedAt]);

  if (state.status === "failed" && state.errorMessage) {
    return (
      <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="text-xs text-rose-200 leading-relaxed">
          <p className="font-semibold text-rose-300">Connection Failed (Safe Rollback Applied)</p>
          <p className="mt-0.5 opacity-90">{state.errorMessage}</p>
        </div>
      </div>
    );
  }

  if (state.status === "connected") {
    return (
      <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">
            Browser Proxy Active
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-200">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          {elapsed}
        </div>
      </div>
    );
  }

  if (state.status === "connecting" || state.status === "reconnecting") {
    return (
      <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-electric-500/10 border border-electric-500/25 flex items-center gap-2">
        <Radio className="w-4 h-4 text-electric-400 animate-pulse" />
        <span className="text-xs font-medium text-electric-200">
          {state.status === "connecting"
            ? "Applying proxy & verifying public IP..."
            : "Server health changed — reconnecting..."}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-navy-800/70 border border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ShieldOff className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-300">Browser traffic is direct (unproxied)</span>
      </div>
    </div>
  );
};
