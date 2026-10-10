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
import type { StaffRole } from "@/src/features/auth/login-view";
import { DashboardView } from "@/src/features/dashboard/dashboard-view";
import { ModuleView } from "@/src/features/modules/module-view";
import { EntityDrawer } from "@/src/features/forms/entity-drawer";
import BackendDataView from "@/src/components/backend-data-view";
import { resourceModule, moduleResources } from "@/src/lib/backend-resources";
import AccountsView from "@/src/features/accounts/accounts-view";
import type { AccountView } from "@/src/features/accounts/types";

type DrawerState = {
  moduleKey: ModuleKey | "settings";
  mode: "create" | "edit" | "settings";
} | null;

const warehouseUrl =
  process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002";

export default function AdminApp({ dataResource, accountsPage }: { dataResource?: string; accountsPage?: AccountView } = {}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [sessionUser, setSessionUser] = useState<{ name: string; username: string } | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/auth/me", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) { setLoggedIn(false); return; }
        const user = await response.json();
        if (user.role === "THU_KHO") { window.location.replace(warehouseUrl); return; }
        if (user.role === "KHACH_HANG") { window.location.replace(process.env.NEXT_PUBLIC_CUSTOMER_URL ?? "http://localhost:3001"); return; }
        setLoggedIn(user.role === "ADMIN");
        setSessionUser(user);
      }).catch(() => { if (!controller.signal.aborted) setLoggedIn(false); });

    const syncModuleWithUrl = () =>
      setActiveModule(accountsPage ? "accounts" : dataResource ? resourceModule(dataResource) : getModuleFromSearch(window.location.search));

    syncModuleWithUrl();
    window.addEventListener("popstate", syncModuleWithUrl);
    const refreshSession = () => setSessionVersion(value => value + 1);
    window.addEventListener("phub-account-updated", refreshSession);

    return () => { controller.abort(); window.removeEventListener("popstate", syncModuleWithUrl); window.removeEventListener("phub-account-updated", refreshSession); };
  }, [dataResource, accountsPage, sessionVersion]);

  const login = ({
    role,
  }: {
    role: StaffRole;
    username: string;
  }) => {
    if (role === "THU_KHO") {
      window.location.assign(warehouseUrl);
      return;
    }

    setLoggedIn(true);
    setSessionVersion(value => value + 1);
  };

  if (loggedIn === null) return null;

  if (!loggedIn) return <LoginView onLogin={login} />;

  const navigate = (moduleKey: ModuleKey) => {
    if (moduleKey === "accounts" || dataResource || accountsPage) { window.location.assign(getModuleHref(moduleKey)); return; }
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
  const logout = async () => {
    const response = await fetch("/api/backend/auth/logout", { method: "POST" });
    if (!response.ok) { window.alert("Không đăng xuất được. Kiểm tra backend và thử lại."); return; }
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
          dataResource={accountsPage || activeModule === "accounts" ? undefined : dataResource ?? moduleResources[activeModule]}
          activeModule={activeModule}
          title={moduleNames[activeModule]}
          onToggleSidebar={toggleSidebar}
          onNavigate={navigate}
          onGoAccounts={() => navigate("accounts")}
          onOpenSettings={openSettings}
          onLogout={logout}
          user={sessionUser}
          onGoProfile={() => window.location.assign("/account")}
        />
        <main className="content">
          {accountsPage ? <AccountsView {...accountsPage} /> : dataResource ? <BackendDataView resource={dataResource} /> : activeModule === "dashboard" ? (
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
