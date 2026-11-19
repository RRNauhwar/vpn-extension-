import React from "react";
import { CheckCircle2, Globe, Info, Lock, ShieldCheck } from "lucide-react";
import { BRAND_CONFIG } from "../../config/branding";

interface OnboardingPageProps {
  onContinue: () => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onContinue }) => {
  return (
    <div className="popup-shell flex flex-col justify-between p-5 text-slate-100">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pt-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-electric-500 to-violetglow-500 flex items-center justify-center shadow-glow">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Welcome to {BRAND_CONFIG.productName}
            </h1>
            <p className="text-xs text-slate-400">{BRAND_CONFIG.tagline}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-navy-800/80 border border-white/5 space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-electric-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Browser Proxy vs. Full-Device VPN
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {BRAND_CONFIG.productName} routes <strong>Chrome browser traffic</strong> through
            authorized TLS-encrypted HTTPS proxy nodes. It does <strong>not</strong> tunnel
            non-browser desktop apps or OS-level traffic.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero browsing history collection:</strong> We do not log visited URLs or sell
              browsing data.
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <Lock className="w-4 h-4 text-electric-400 shrink-0 mt-0.5" />
            <span>
              <strong>Least-privilege permissions:</strong> Uses Chrome Proxy, Privacy (WebRTC
              hardening), and ephemeral proxy auth only while connected.
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-violetglow-400 shrink-0 mt-0.5" />
            <span>
              <strong>Free tier without payment:</strong> Start immediately as a guest, or create an
              optional free account later.
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-electric-500 to-violetglow-500 hover:from-electric-400 hover:to-violetglow-400 text-white text-sm font-semibold shadow-glow transition-all active:scale-[0.99]"
      >
        Start Using {BRAND_CONFIG.productName} Free
      </button>
    </div>
  );
};
