import React, { useMemo, useState } from "react";
import { ArrowUpDown, Clock, RefreshCw, Search, Signal, Star, Zap } from "lucide-react";
import type { ConnectionState, CountrySummary, ServerSummary } from "../../types";

interface CountriesPageProps {
  state: ConnectionState;
  servers: ServerSummary[];
  countries: CountrySummary[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectServer: (server: ServerSummary) => void;
  onConnectCountry: (country: CountrySummary) => void;
  onToggleFavorite: (countryCode: string) => void;
}

export const CountriesPage: React.FC<CountriesPageProps> = ({
  state,
  servers,
  countries,
  loading,
  error,
  onRefresh,
  onSelectServer,
  onConnectCountry,
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState("");
  const [sortByLatency, setSortByLatency] = useState(true);

  const availableCountries = useMemo(
    () => countries.filter((c) => c.availability_status === "available"),
    [countries]
  );

  const recommended = useMemo(() => {
    if (availableCountries.length === 0) return null;
    return [...availableCountries].sort(
      (a, b) => (a.best_latency_ms ?? 99999) - (b.best_latency_ms ?? 99999)
    )[0];
  }, [availableCountries]);

  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = countries.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
      );
    });
    const rank = { available: 0, unavailable: 1, coming_soon: 2 } as const;
    return [...list].sort((a, b) => {
      const aFav = state.favoriteCountryCodes.includes(a.code) ? 0 : 1;
      const bFav = state.favoriteCountryCodes.includes(b.code) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      if (rank[a.availability_status] !== rank[b.availability_status]) {
        return rank[a.availability_status] - rank[b.availability_status];
      }
      if (sortByLatency && a.availability_status === "available") {
        return (a.best_latency_ms ?? 99999) - (b.best_latency_ms ?? 99999);
      }
      return a.name.localeCompare(b.name);
    });
  }, [countries, query, sortByLatency, state.favoriteCountryCodes]);

  const recentServers = useMemo(
    () =>
      state.recentServerIds
        .map((id) => servers.find((s) => s.id === id))
        .filter((s): s is ServerSummary => Boolean(s)),
    [state.recentServerIds, servers]
  );

  return (
    <div className="flex-1 flex flex-col px-4 py-3 space-y-3 overflow-y-auto max-h-[450px]">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-navy-800/90 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-electric-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setSortByLatency((v) => !v)}
          title={sortByLatency ? "Sorted by latency" : "Sorted alphabetically"}
          className="p-2 rounded-xl bg-navy-800 border border-white/10 text-slate-300 hover:text-white"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh countries"
          className="p-2 rounded-xl bg-navy-800 border border-white/10 text-slate-300 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 leading-relaxed">
          {error}
        </div>
      )}

      {recommended && !query && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-electric-400 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Fastest Available Location
          </span>
          <button
            type="button"
            onClick={() => onConnectCountry(recommended)}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-electric-500/15 to-violetglow-500/15 border border-electric-500/30 flex items-center justify-between text-left hover:border-electric-400/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">{recommended.flag_emoji || "🌐"}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{recommended.name}</p>
                <p className="text-[11px] text-slate-300 truncate">
                  {recommended.supported_protocol?.replace("_", " ").toUpperCase() ?? "HTTPS PROXY"}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 shrink-0">
              <Signal className="w-3 h-3" />
              {recommended.best_latency_ms ?? "—"}ms
            </span>
          </button>
        </div>
      )}

      {recentServers.length > 0 && !query && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Recently Connected
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentServers.map((srv) => (
              <button
                key={srv.id}
                type="button"
                onClick={() => onSelectServer(srv)}
                className="px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 border border-white/5 text-[11px] text-slate-200 flex items-center gap-1.5"
              >
                <span>{srv.flag_emoji || "🌐"}</span>
                <span>{srv.country_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Country Registry ({availableCountries.length} Live / {filteredCountries.length} Total)
          </span>
        </div>

        {filteredCountries.map((country) => {
          const isAvailable = country.availability_status === "available";
          const isUnavailable = country.availability_status === "unavailable";
          const isFav = state.favoriteCountryCodes.includes(country.code);
          const isConnected =
            state.status === "connected" &&
            state.connectedServer?.country_code === country.code;

          return (
            <div
              key={country.code}
              className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                isConnected
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : isAvailable
                  ? "bg-navy-800/80 border-white/5 hover:bg-navy-700/80"
                  : "bg-navy-900/60 border-white/5 opacity-70"
              }`}
            >
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => isAvailable && onConnectCountry(country)}
                className="flex items-center gap-2.5 flex-1 text-left min-w-0 disabled:cursor-not-allowed"
              >
                <span className="text-xl shrink-0">{country.flag_emoji || "🌐"}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{country.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {isAvailable
                      ? `${country.operational_server_count} node · ${
                          country.supported_protocol?.replace("_", " ").toUpperCase() ?? "PROXY"
                        }`
                      : isUnavailable
                      ? "Node temporarily offline"
                      : `${country.region} · Infrastructure planned`}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {isAvailable ? (
                  <span className="text-xs font-mono text-emerald-400">
                    {country.best_latency_ms != null ? `${country.best_latency_ms}ms` : "Live"}
                  </span>
                ) : isUnavailable ? (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[10px] font-medium border border-rose-500/25">
                    Unavailable
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 text-[10px] font-medium flex items-center gap-1 border border-white/10">
                    <Clock className="w-2.5 h-2.5" />
                    Coming soon
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onToggleFavorite(country.code)}
                  aria-label="Toggle favorite"
                  className="p-1 text-slate-400 hover:text-amber-400"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
