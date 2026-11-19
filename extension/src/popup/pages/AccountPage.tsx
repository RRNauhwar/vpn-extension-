import React, { useEffect, useState } from "react";
import { LogOut, ShieldCheck, UserCheck } from "lucide-react";
import { fetchUserUsage, loginUser, logoutUser, registerUser } from "../../services/auth";
import type { AuthSession, UserUsage } from "../../types";
import { isValidEmail } from "../../utils/validation";

interface AccountPageProps {
  auth: AuthSession | null;
  onAuthChange: (auth: AuthSession | null) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ auth, onAuthChange }) => {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UserUsage | null>(null);

  useEffect(() => {
    fetchUserUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const session =
        mode === "register"
          ? await registerUser(email, password)
          : await loginUser(email, password);
      onAuthChange(session);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    onAuthChange(null);
  };

  return (
    <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto max-h-[450px]">
      <div className="p-3.5 rounded-2xl bg-navy-800/80 border border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-electric-400" />
            Plan: {(usage?.plan_tier ?? auth?.planTier ?? "free").toUpperCase()}
          </span>
          {auth && !auth.isGuest && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          )}
        </div>

        <p className="text-xs text-slate-300">
          {auth && !auth.isGuest
            ? `Signed in as ${auth.email}`
            : "Using instant Free Guest session (no payment or signup required)."}
        </p>

        {usage && (
          <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Daily sessions used</span>
              <span className="font-mono text-slate-200">
                {usage.daily_sessions_used} / {usage.daily_sessions_limit}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max session duration</span>
              <span className="font-mono text-slate-200">{usage.max_session_minutes} min</span>
            </div>
            <p className="pt-1 text-[10px] leading-relaxed text-slate-400">
              {usage.fair_use_policy}
            </p>
          </div>
        )}
      </div>

      {(!auth || auth.isGuest) && (
        <form
          onSubmit={handleSubmit}
          className="p-3.5 rounded-2xl bg-navy-800/70 border border-white/5 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-violetglow-400" />
              Optional Free Account
            </h2>
            <button
              type="button"
              onClick={() => setMode(mode === "register" ? "login" : "register")}
              className="text-[11px] text-electric-400 hover:underline"
            >
              {mode === "register" ? "Have an account? Sign in" : "Need an account? Register"}
            </button>
          </div>

          {error && (
            <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg p-2">
              {error}
            </p>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full px-3 py-2 text-xs rounded-xl bg-navy-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-electric-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            required
            className="w-full px-3 py-2 text-xs rounded-xl bg-navy-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-electric-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-electric-500 to-violetglow-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Please wait..." : mode === "register" ? "Create Free Account" : "Sign In"}
          </button>
        </form>
      )}
    </div>
  );
};
