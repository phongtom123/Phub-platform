"use client";

import { useEffect, useState } from "react";
import type { ModuleKey } from "@/src/types/admin";
import { moduleNames, modules } from "@/src/data/admin-data";
import {
  getModuleFromSearch,
  getModuleHref,
} from "@/src/lib/admin-navigation";
import { AdminSidebar } from "./sidebar";
import { AdminHeader } from "./header";
import { LoginView } from "@/src/features/auth/login-view";
import { DashboardView } from "@/src/features/dashboard/dashboard-view";
import { ModuleView } from "@/src/features/modules/module-view";
import { EntityDrawer } from "@/src/features/forms/entity-drawer";

type DrawerState = {
  moduleKey: ModuleKey | "settings";
  mode: "create" | "edit" | "settings";
} | null;

const adminSessionKey = "phub-admin-authenticated";

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  useEffect(() => {
    setLoggedIn(window.sessionStorage.getItem(adminSessionKey) === "true");

    const syncModuleWithUrl = () =>
      setActiveModule(getModuleFromSearch(window.location.search));

    syncModuleWithUrl();
    window.addEventListener("popstate", syncModuleWithUrl);

    return () => window.removeEventListener("popstate", syncModuleWithUrl);
  }, []);

  const login = () => {
    window.sessionStorage.setItem(adminSessionKey, "true");
    setLoggedIn(true);
  };

  if (loggedIn === null) return null;

  if (!loggedIn) return <LoginView onLogin={login} />;

  const navigate = (moduleKey: ModuleKey) => {
    if (moduleKey === activeModule) return;

    window.history.pushState({ moduleKey }, "", getModuleHref(moduleKey));
    setActiveModule(moduleKey);
  };
  const toggleSidebar = () =>
    window.innerWidth <= 800
      ? setMobileSidebarOpen(true)
      : setSidebarCollapsed((value) => !value);
  const openCreate = () =>
    setDrawer({ moduleKey: activeModule, mode: "create" });
  const openSettings = () =>
    setDrawer({ moduleKey: "settings", mode: "settings" });
  const logout = () => {
    window.sessionStorage.removeItem(adminSessionKey);
    window.history.replaceState({}, "", "/");
    setActiveModule("dashboard");
    setLoggedIn(false);
  };
  const definition = modules[activeModule];

  return (
    <div className={`shell ${sidebarCollapsed ? "nav-collapsed" : ""}`}>
      <AdminSidebar
        active={activeModule}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onNavigate={navigate}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenSettings={openSettings}
        onLogout={logout}
      />
      <div className="main">
        <AdminHeader
          activeModule={activeModule}
          title={moduleNames[activeModule]}
          onToggleSidebar={toggleSidebar}
          onNavigate={navigate}
          onGoAccounts={() => navigate("accounts")}
          onOpenSettings={openSettings}
          onLogout={logout}
        />
        <main className="content">
          {activeModule === "dashboard" ? (
            <DashboardView onNavigate={navigate} />
          ) : definition ? (
            <ModuleView
              moduleKey={activeModule}
              definition={definition}
              onCreate={openCreate}
              onBack={() => window.history.back()}
            />
          ) : null}
        </main>
      </div>
      {drawer && (
        <EntityDrawer
          moduleKey={drawer.moduleKey}
          mode={drawer.mode}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
