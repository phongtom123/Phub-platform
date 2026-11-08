"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "./auth-provider";
import type { ModuleKey } from "@internal/types/admin";
import { moduleNames } from "@internal/data/admin-data";
import {
  getModuleFromSearch,
  getModuleHref,
} from "@internal/lib/admin-navigation";
import { AdminSidebar } from "./sidebar";
import { AdminHeader } from "./header";
import { LoginView } from "@internal/features/auth/login-view";
import { DashboardView } from "@internal/features/dashboard/dashboard-view";
import { ModuleView } from "@internal/features/modules/module-view";
import { EntityDrawer } from "@internal/features/forms/entity-drawer";
import BackendDataView from "@internal/components/backend-data-view";
import { resourceModule, moduleResources } from "@internal/lib/backend-resources";
import AccountsView from "@internal/features/accounts/accounts-view";
import type { AccountView } from "@internal/features/accounts/types";
import SupportView from "@internal/features/support/support-view";
import { ReportsView } from "@internal/features/reports/reports-view";
import SurveysView from "@internal/features/engagement/surveys-view";
import ReviewsView from "@internal/features/engagement/reviews-view";
import CrmReportView from "@internal/features/engagement/crm-report-view";
import { CustomerInsightsView } from "@internal/features/customer-insights/customer-insights-view";
import { canOpenModule, portalHome, portalRole } from "../../../../shared/internal-access";

type DrawerState = {
  moduleKey: ModuleKey | "settings";
  mode: "create" | "edit" | "settings";
} | null;

export default function AdminApp({ dataResource, accountsPage, supportPage = false, reportsPage = false, customerInsightsPage = false, engagementPage, children, moduleHint, selfPage = false, pageTitle, pageHref }: { dataResource?: string; accountsPage?: AccountView; supportPage?: boolean; reportsPage?: boolean; customerInsightsPage?: boolean; engagementPage?: "surveys" | "reviews" | "crmReport"; children?: React.ReactNode; moduleHint?: ModuleKey; selfPage?: boolean; pageTitle?: string; pageHref?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { portal, user: sessionUser, checking: checkingSession, error: sessionError, checkSession, acceptLogin, logout: endSession } = useAdminAuth();
  const activeModule = moduleHint ?? (customerInsightsPage ? "customer-insights" : engagementPage ?? (accountsPage ? "accounts" : supportPage ? "support" : reportsPage ? "reports" : dataResource ? resourceModule(dataResource) : portal === "staff" && !searchParams.has("module") ? "orders" : getModuleFromSearch(searchParams.toString())));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const retrySession = () => { void checkSession(); };
  // The root provider owns the only initial verification gate across all pages.
  if (sessionUser === undefined || (sessionUser && sessionUser.role !== portalRole(portal))) return null;

  if (!sessionUser) return <LoginView onLogin={acceptLogin} />;
  const allowed = selfPage || accountsPage?.mode === "self" || canOpenModule(portal, activeModule);

  const navigate = (moduleKey: ModuleKey) => {
    router.push(portal === "staff" && ["receipts", "inventory"].includes(moduleKey) ? `/${moduleKey}` : getModuleHref(moduleKey));
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
          dataResource={accountsPage || pageTitle || activeModule === "accounts" ? undefined : dataResource ?? moduleResources[activeModule]}
          activeModule={activeModule}
          title={pageTitle ?? moduleNames[activeModule]}
          pageHref={pageHref}
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
          {!allowed ? <section className="live-note" role="alert"><p>Chức năng này không thuộc quyền của tài khoản đang đăng nhập.</p><a href={portalHome(portal)}>Về trang chính</a></section> : children ?? (activeModule === "customer-insights" ? <CustomerInsightsView /> : activeModule === "surveys" ? <SurveysView /> : activeModule === "reviews" ? <ReviewsView /> : activeModule === "crmReport" ? <CrmReportView /> : activeModule === "reports" ? <ReportsView /> : activeModule === "support" ? <SupportView /> : accountsPage ? <AccountsView {...accountsPage} /> : dataResource ? <BackendDataView key={["products", "customers"].includes(dataResource) ? dataResource : `${dataResource}:${searchParams}`} resource={dataResource} /> : activeModule === "dashboard" ? (
            <DashboardView onNavigate={navigate} />
          ) : moduleResources[activeModule] ? (
            <ModuleView
              moduleKey={activeModule}
            />
          ) : null)}
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
