"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Save } from "lucide-react";
import { formFields, moduleNames } from "@/src/data/admin-data";
import type { FormFieldDefinition, ModuleKey } from "@/src/types/admin";

const sectionToModule: Record<string, ModuleKey> = {
  orders: "orders",
  accounts: "accounts",
  products: "products",
  categories: "categories",
  promotions: "promotions",
  vouchers: "vouchers",
  branches: "branches",
  warehouses: "branches",
  employees: "employees",
  customers: "customers",
  suppliers: "suppliers",
  receipts: "receipts",
  transfers: "transfers",
  payments: "billing",
  invoices: "billing",
};

const fallbackFields: FormFieldDefinition[] = [
  { name: "code", label: "Mã bản ghi", placeholder: "Mã hệ thống", wide: true },
  { name: "status", label: "Trạng thái", placeholder: "Hoạt động" },
  {
    name: "note",
    label: "Ghi chú",
    placeholder: "Nhập ghi chú",
    type: "textarea",
    wide: true,
  },
];

export default function EditView({
  section,
  id,
}: {
  section: string;
  id: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const moduleKey = sectionToModule[section];
  const label = moduleKey ? moduleNames[moduleKey] : "Bản ghi";
  const fields = (moduleKey && formFields[moduleKey]) || fallbackFields;

  return (
    <div className="detail-page edit-page">
      <header className="detail-topbar">
        <Link href="/" className="detail-logo" aria-label="Về Tổng quan">
          <b>P</b>
          <strong>PHUB</strong>
          <em>admin</em>
        </Link>
        <nav aria-label="Breadcrumb">
          <Link href="/">Quản trị</Link>
          <ChevronRight />
          <span>{label}</span>
          <ChevronRight />
          <Link href={`/${section}/${encodeURIComponent(id)}`}>{id}</Link>
          <ChevronRight />
          <b>Chỉnh sửa</b>
        </nav>
      </header>
      <main className="edit-content">
        <button className="detail-back" onClick={() => router.back()}>
          <ArrowLeft /> Quay lại trang chi tiết
        </button>
        <section className="edit-card">
          <header>
            <div>
              <span>CHỈNH SỬA {label.toUpperCase()}</span>
              <h1>{id}</h1>
              <p>Cập nhật thông tin và lưu thay đổi trên trang riêng.</p>
            </div>
            <Link href={`/${section}/${encodeURIComponent(id)}`}>
              Xem chi tiết
            </Link>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <div className="form-grid edit-form-grid">
              {fields.map((field) => (
                <label className={field.wide ? "wide" : ""} key={field.name}>
                  <span>{field.label}</span>
                  {field.type === "textarea" ? (
                    <textarea
                      placeholder={field.placeholder}
                      defaultValue="Thông tin hiện tại của bản ghi"
                    />
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      placeholder={field.placeholder}
                      defaultValue={field.name === "code" ? id : ""}
                    />
                  )}
                </label>
              ))}
            </div>
            <footer>
              <button
                type="button"
                className="btn secondary"
                onClick={() => router.back()}
              >
                Hủy
              </button>
              <button type="submit" className="btn primary">
                {saved ? (
                  <>
                    <Check /> Đã lưu thay đổi
                  </>
                ) : (
                  <>
                    <Save /> Lưu thay đổi
                  </>
                )}
              </button>
            </footer>
          </form>
        </section>
      </main>
    </div>
  );
}
