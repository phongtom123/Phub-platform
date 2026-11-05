"use client";
import { X } from "lucide-react";
import type { ModuleKey } from "@/src/types/admin";
import { SettingsForm } from "../operations/settings-form";

type Props = { moduleKey: ModuleKey | "settings"; mode: "create" | "edit" | "settings"; onClose: () => void };
export function EntityDrawer({ mode, onClose }: Props) {
  return <div className="modal-bg" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal"><header><h2>{mode === "settings" ? "Cài đặt hệ thống" : "Thông tin"}</h2><button onClick={onClose} aria-label="Đóng"><X /></button></header>
      <main>{mode === "settings" ? <SettingsForm /> : <p>Mở trang dữ liệu để tạo hoặc chỉnh sửa bản ghi.</p>}</main>
      <footer><button className="btn secondary" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>;
}
