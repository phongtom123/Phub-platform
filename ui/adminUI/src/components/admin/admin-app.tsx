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
import { AuthRequestError, getSession, logoutSession } from "../../../../shared/auth-client";

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
  const [sessionError, setSessionError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCheckingSession(true);
    setSessionError("");
    getSession(controller.signal)
      .then(user => {
        if (controller.signal.aborted) return;
        if (user.role === "THU_KHO") { window.location.replace(warehouseUrl); return; }
        if (user.role === "KHACH_HANG") { window.location.replace(process.env.NEXT_PUBLIC_CUSTOMER_URL ?? "http://localhost:3001"); return; }
        if (user.role !== "ADMIN") throw new Error("API trả thông tin phiên không hợp lệ.");
        setLoggedIn(user.role === "ADMIN");
        setSessionUser(user);
      }).catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof AuthRequestError && (error.status === 401 || error.status === 403)) {
          setLoggedIn(false); setSessionUser(null); return;
        }
        setSessionError("Chưa kiểm tra được phiên đăng nhập. API tạm thời không khả dụng; phiên chưa bị xóa.");
      }).finally(() => { if (!controller.signal.aborted) setCheckingSession(false); });

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

    // Verify /me before mounting the dashboard and its parallel data requests.
    setLoggedIn(null);
    setSessionUser(null);
    setSessionError("");
    setCheckingSession(true);
    setSessionVersion(value => value + 1);
  };

  const retrySession = () => setSessionVersion(value => value + 1);
  if (loggedIn === null) return (
    <main className="session-gate" aria-busy={checkingSession}>
      <h1>PHUB Admin</h1>
      {checkingSession ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : <>
        <p role="alert">{sessionError}</p>
        <button type="button" className="btn primary" onClick={retrySession}>Thử kết nối lại</button>
      </>}
    </main>
  );

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
    try {
      await logoutSession();
    } catch {
      window.alert("Không đăng xuất được. Kiểm tra backend và thử lại.");
      return;
    }
    window.history.replaceState({}, "", "/");
    setActiveModule("dashboard");
    setLoggedIn(false);
    setSessionUser(null);
    setSessionVersion(value => value + 1);
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
          {sessionError && <div className="session-warning" role="alert">
            <span>{sessionError}</span>
            <button type="button" className="btn" onClick={retrySession} disabled={checkingSession}>Thử kết nối lại</button>
          </div>}
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
