import React, { useState } from "react";
import { connectionStore } from "../store/connection-store";
import type { CountrySummary } from "../types";
import { BottomNav, type PopupTab } from "./components/BottomNav";
import { Header } from "./components/Header";
import { useConnection } from "./hooks/useConnection";
import { AccountPage } from "./pages/AccountPage";
import { CountriesPage } from "./pages/CountriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OnboardingPage } from "./pages/OnboardingPage";

export const App: React.FC = () => {
  const {
    state,
    settings,
    auth,
    servers,
    countries,
    loadingServers,
    serverError,
    refreshServers,
    toggleConnect,
    selectAndConnect,
    toggleFavorite,
    completeOnboarding,
    setAuth,
  } = useConnection();

  const [activeTab, setActiveTab] = useState<PopupTab>("dashboard");

  if (!settings.onboardingCompleted) {
    return <OnboardingPage onContinue={() => void completeOnboarding()} />;
  }

  const openOptions = () => {
    if (chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  const handleConnectCountry = (country: CountrySummary) => {
    if (country.availability_status !== "available") return;
    setActiveTab("dashboard");
    const matchingServer = servers.find(
      (s) => s.id === country.actual_server_id || s.country_code === country.code
    );
    if (matchingServer) {
      void selectAndConnect(matchingServer);
    } else {
      void connectionStore.connect({
        serverId: country.actual_server_id ?? undefined,
        countryCode: country.code,
      });
    }
  };

  return (
    <div className="popup-shell flex flex-col text-slate-100">
      <Header auth={auth} onOpenSettings={openOptions} />

      {activeTab === "dashboard" && (
        <DashboardPage
          state={state}
          servers={servers}
          countries={countries}
          loadingServers={loadingServers}
          serverError={serverError}
          onToggleConnect={() => void toggleConnect()}
          onOpenLocations={() => setActiveTab("countries")}
          onRefreshIp={() => void connectionStore.refreshIp()}
        />
      )}

      {activeTab === "countries" && (
        <CountriesPage
          state={state}
          servers={servers}
          countries={countries}
          loading={loadingServers}
          error={serverError}
          onRefresh={() => void refreshServers()}
          onSelectServer={(srv) => {
            setActiveTab("dashboard");
            void selectAndConnect(srv);
          }}
          onConnectCountry={handleConnectCountry}
          onToggleFavorite={(code) => void toggleFavorite(code)}
        />
      )}

      {activeTab === "account" && (
        <AccountPage auth={auth} onAuthChange={setAuth} />
      )}

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
};

export default App;
