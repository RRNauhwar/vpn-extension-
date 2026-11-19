import React from "react";
import { Globe2, Shield, UserCircle2 } from "lucide-react";

export type PopupTab = "dashboard" | "countries" | "account";

interface BottomNavProps {
  activeTab: PopupTab;
  onChange: (tab: PopupTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChange }) => {
  const items: { id: PopupTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Connect", icon: <Shield className="w-4 h-4" /> },
    { id: "countries", label: "Locations", icon: <Globe2 className="w-4 h-4" /> },
    { id: "account", label: "Account", icon: <UserCircle2 className="w-4 h-4" /> },
  ];

  return (
    <nav className="mt-auto grid grid-cols-3 border-t border-white/5 bg-navy-950/90 px-2 py-2">
      {items.map((item) => {
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
              active
                ? "bg-electric-500/15 text-electric-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
