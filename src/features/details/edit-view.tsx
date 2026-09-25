"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Save } from "lucide-react";
import { formFields, moduleNames, modules } from "@/src/data/admin-data";
import type { FormFieldDefinition } from "@/src/types/admin";
import {
  getModuleForSection,
  getSectionHref,
} from "@/src/lib/admin-navigation";

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

const orderSteps = ["Mới", "Xác nhận", "Chuẩn bị", "Xuất kho", "Hoàn thành"];

function getOrderStep(id: string) {
  const status = String(
    modules.orders?.rows.find((order) => order.id === id)?.status ?? "Mới",
  ).toLowerCase();

  if (status.includes("hoàn thành")) return 4;
  if (status.includes("xuất kho")) return 3;
  if (status.includes("chuẩn bị")) return 2;
  if (status.includes("xác nhận")) return 1;
  return 0;
}

export default function EditView({
  section,
  id,
}: {
  section: string;
  id: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [orderStep, setOrderStep] = useState(() => getOrderStep(id));
  const moduleKey = getModuleForSection(section);
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
          <Link href={getSectionHref(section)}>{label}</Link>
          <ChevronRight />
          <Link href={`/${section}/${encodeURIComponent(id)}`}>{id}</Link>
          <ChevronRight />
          <Link
            className="current"
            href={`/${section}/${encodeURIComponent(id)}/edit`}
            aria-current="page"
          >
            Chỉnh sửa
          </Link>
        </nav>
      </header>
      <main className="edit-content">
        <button className="detail-back" onClick={() => router.back()}>
          <ArrowLeft /> Quay lại trang trước
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
          {section === "orders" && (
            <section className="edit-order-status">
              <header>
                <div>
                  <span>TRẠNG THÁI ĐƠN HÀNG</span>
                  <h2>Quy trình xử lý</h2>
                </div>
                <strong>{orderSteps[orderStep]}</strong>
              </header>
              <div className="edit-order-workflow">
                {orderSteps.map((step, index) => (
                  <div
                    className={
                      index === orderStep
                        ? "current"
                        : index < orderStep
                          ? "completed"
                          : ""
                    }
                    key={step}
                  >
                    <button
                      type="button"
                      aria-pressed={index === orderStep}
                      onClick={() => {
                        setOrderStep(index);
                        setSaved(false);
                      }}
                    >
                      <i>{index < orderStep ? <Check /> : index + 1}</i>
                      <span>{step}</span>
                    </button>
                  </div>
                ))}
              </div>
              <p>
                Chọn giai đoạn hiện tại của đơn hàng, sau đó nhấn Lưu thay đổi.
              </p>
            </section>
          )}
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
