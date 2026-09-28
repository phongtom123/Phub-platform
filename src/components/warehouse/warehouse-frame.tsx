import type { ReactNode } from "react";
import Sidebar from "@/src/components/warehouse/sidebar";
import Header from "@/src/components/warehouse/header";

export default function WarehouseFrame({ children }: { children: ReactNode }) {
  return <div className="app-shell"><Sidebar/><div className="main-shell"><Header/><main className="main-content">{children}<footer className="app-footer">PHUB Warehouse · Giao diện quản lý kho nội bộ</footer></main></div></div>;
}
