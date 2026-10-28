"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "./auth-provider";
import type { ModuleKey } from "@/src/types/admin";
import { moduleNames } from "@/src/data/admin-data";
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
import SupportView from "@/src/features/support/support-view";

type DrawerState = {
  moduleKey: ModuleKey | "settings";
  mode: "create" | "edit" | "settings";
} | null;

export default function AdminApp({ dataResource, accountsPage, supportPage = false }: { dataResource?: string; accountsPage?: AccountView; supportPage?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser, checking: checkingSession, error: sessionError, checkSession, acceptLogin, logout: endSession } = useAdminAuth();
  const activeModule = accountsPage ? "accounts" : supportPage ? "support" : dataResource ? resourceModule(dataResource) : getModuleFromSearch(searchParams.toString());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const retrySession = () => { void checkSession(); };
  // The root provider owns the only initial verification gate across all pages.
  if (sessionUser === undefined || (sessionUser && sessionUser.role !== "ADMIN")) return null;

  if (!sessionUser) return <LoginView onLogin={acceptLogin} />;

  const navigate = (moduleKey: ModuleKey) => {
    router.push(getModuleHref(moduleKey));
    setMobileSidebarOpen(false);
  };
  const toggleSidebar = () =>
    window.innerWidth <= 800
      ? setMobileSidebarOpen(true)
      : setSidebarCollapsed((value) => !value);
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
          accountsPage={accountsPage}
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
          {activeModule === "support" ? <SupportView /> : accountsPage ? <AccountsView {...accountsPage} /> : dataResource ? <BackendDataView key={["products", "customers"].includes(dataResource) ? dataResource : `${dataResource}:${searchParams}`} resource={dataResource} /> : activeModule === "dashboard" ? (
            <DashboardView onNavigate={navigate} />
          ) : moduleResources[activeModule] ? (
            <ModuleView
              moduleKey={activeModule}
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
