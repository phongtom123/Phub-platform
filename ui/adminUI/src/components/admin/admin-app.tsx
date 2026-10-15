"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "./auth-provider";
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
import BackendDataView from "@/src/components/backend-data-view";
import { resourceModule, moduleResources } from "@/src/lib/backend-resources";
import AccountsView from "@/src/features/accounts/accounts-view";
import type { AccountView } from "@/src/features/accounts/types";

type DrawerState = {
  moduleKey: ModuleKey | "settings";
  mode: "create" | "edit" | "settings";
} | null;

export default function AdminApp({ dataResource, accountsPage }: { dataResource?: string; accountsPage?: AccountView } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser, checking: checkingSession, error: sessionError, checkSession, logout: endSession } = useAdminAuth();
  const activeModule = accountsPage ? "accounts" : dataResource ? resourceModule(dataResource) : getModuleFromSearch(searchParams.toString());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  // Login still verifies the new cookie before mounting protected data views.
  const login = () => { void checkSession(true); };
  const retrySession = () => { void checkSession(); };
  if (sessionUser === undefined || (sessionUser && sessionUser.role !== "ADMIN")) return (
    <main className="session-gate" aria-busy={checkingSession}>
      <h1>PHUB Admin</h1>
      {checkingSession ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : <>
        <p role="alert">{sessionError}</p>
        <button type="button" className="btn primary" onClick={retrySession}>Thử kết nối lại</button>
      </>}
    </main>
  );

  if (!sessionUser) return <LoginView onLogin={login} />;

  const navigate = (moduleKey: ModuleKey) => {
    router.push(getModuleHref(moduleKey));
    setMobileSidebarOpen(false);
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
    try {
      await endSession();
    } catch {
      window.alert("Không đăng xuất được. Kiểm tra backend và thử lại.");
      return;
    }
    router.replace("/");
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
          onGoProfile={() => router.push("/account")}
        />
        <main className="content">
          {sessionError && <div className="session-warning" role="alert">
            <span>{sessionError}</span>
            <button type="button" className="btn" onClick={retrySession} disabled={checkingSession}>Thử kết nối lại</button>
          </div>}
          {accountsPage ? <AccountsView {...accountsPage} /> : dataResource ? <BackendDataView key={dataResource === "products" ? dataResource : `${dataResource}:${searchParams}`} resource={dataResource} /> : activeModule === "dashboard" ? (
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
