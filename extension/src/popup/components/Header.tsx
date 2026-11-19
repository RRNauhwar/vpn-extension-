import React from "react";
import { Globe, Settings, ShieldCheck } from "lucide-react";
import { BRAND_CONFIG } from "../../config/branding";
import type { AuthSession } from "../../types";

interface HeaderProps {
  auth: AuthSession | null;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ auth, onOpenSettings }) => {
  const tierLabel = auth?.planTier === "pro" ? "PRO" : "FREE";

  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-electric-500 to-violetglow-500 flex items-center justify-center shadow-glow">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-semibold tracking-tight text-white">
              {BRAND_CONFIG.productName}
            </h1>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-electric-500/20 text-electric-400 border border-electric-500/30">
              {tierLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-electric-400" />
            {BRAND_CONFIG.tagline}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        title="Settings"
        className="p-2 rounded-xl bg-navy-800/80 hover:bg-navy-700 text-slate-300 hover:text-white border border-white/5 transition-colors"
      >
        <Settings className="w-4 h-4" />
      </button>
    </header>
  );
};
