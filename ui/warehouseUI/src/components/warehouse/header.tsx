"use client";

import { Bell, ChevronDown, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { moduleNames } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";
import type { WarehouseUser } from "@/src/types/warehouse-auth";

export default function Header({ user }: { user: WarehouseUser }) {
  const pathname = usePathname(); const section = pathname.split("/")[1] as ModuleKey | undefined;
  const title = pathname === "/" ? "Tổng quan" : moduleNames[section ?? "dashboard"] ?? "Chi tiết";
  return <header className="topbar"><div className="breadcrumb">Kho vận <span>/</span> <strong>{title}</strong></div><div className="topbar-spacer"/><button className="top-icon" aria-label="Trợ giúp"><CircleHelp size={17}/></button><button className="top-icon notification" aria-label="Thông báo"><Bell size={17}/><i/></button><div className="top-user"><span className="avatar">{user.name.split(" ").slice(-2).map(part => part[0]).join("")}</span><span className="top-user-name">{user.name}</span><ChevronDown size={14}/></div></header>;
}
