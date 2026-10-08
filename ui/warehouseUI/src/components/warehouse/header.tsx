"use client";

import { Bell, ChevronDown, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { moduleNames } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";
import type { WarehouseUser } from "@/src/types/warehouse-auth";

export default function Header({ user }: { user: WarehouseUser }) {
  const [notice, setNotice] = useState("");
  const pathname = usePathname(); const section = pathname.split("/")[1] as ModuleKey | undefined;
  const title = pathname === "/" ? "Tổng quan" : moduleNames[section ?? "dashboard"] ?? "Chi tiết";
  return <header className="topbar"><div className="breadcrumb">Kho vận <span>/</span> <strong>{title}</strong></div><div className="topbar-spacer"/><button className="top-icon" aria-label="Trợ giúp" onClick={() => setNotice("Liên hệ quản trị viên để được hỗ trợ tài khoản và phân công kho.")}><CircleHelp size={17}/></button><button className="top-icon notification" aria-label="Thông báo" onClick={() => setNotice("Chưa kết nối API thông báo.")}><Bell size={17}/></button><div className="top-user"><span className="avatar">{user.initials}</span><span className="top-user-name">{user.name}</span><ChevronDown size={14}/></div>{notice && <p role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Đóng thông báo">×</button></p>}</header>;
}
