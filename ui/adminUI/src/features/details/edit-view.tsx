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
import { ImageEditor } from "@/src/features/forms/image-editor";
import { WorkflowEditor } from "@/src/features/forms/workflow-editor";

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

type WorkflowConfig = {
  eyebrow: string;
  steps: string[];
  instruction: string;
};

const workflowConfigs: Partial<Record<string, WorkflowConfig>> = {
  orders: {
    eyebrow: "TRẠNG THÁI ĐƠN HÀNG",
    steps: ["Mới", "Xác nhận", "Chuẩn bị", "Xuất kho", "Hoàn thành"],
    instruction:
      "Chọn giai đoạn hiện tại của đơn hàng, sau đó nhấn Lưu thay đổi.",
  },
  receipts: {
    eyebrow: "TRẠNG THÁI PHIẾU NHẬP",
    steps: ["Nháp", "Xác nhận nhập", "Cộng tồn kho"],
    instruction:
      "Xác nhận phiếu nhập sẽ ghi nhận hàng hóa và cộng tồn vào kho nhận.",
  },
  transfers: {
    eyebrow: "TRẠNG THÁI CHUYỂN KHO",
    steps: ["Nháp", "Đang chuyển · Trừ kho xuất", "Đã nhận · Cộng kho đích"],
    instruction:
      "Chọn đúng giai đoạn vận chuyển; tồn kho nguồn và kho đích thay đổi theo trạng thái.",
  },
};

function getWorkflowStep(section: string, id: string) {
  const moduleKey = getModuleForSection(section);
  const status = String(
    moduleKey
      ? modules[moduleKey]?.rows.find((record) => record.id === id)?.status ?? ""
      : "",
  ).toLowerCase();

  if (section === "orders") {
    if (status.includes("hoàn thành")) return 4;
    if (status.includes("xuất kho")) return 3;
    if (status.includes("chuẩn bị")) return 2;
    if (status.includes("xác nhận")) return 1;
  }

  if (section === "receipts" && status.includes("đã nhập")) return 2;

  if (section === "transfers") {
    if (status.includes("đã nhận")) return 2;
    if (status.includes("đang chuyển")) return 1;
  }

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
  const [workflowStep, setWorkflowStep] = useState(() =>
    getWorkflowStep(section, id),
  );
  const moduleKey = getModuleForSection(section);
  const label = moduleKey ? moduleNames[moduleKey] : "Bản ghi";
  const fields = (moduleKey && formFields[moduleKey]) || fallbackFields;
  const canEditImage = section === "products" || section === "promotions";
  const currentRecord = moduleKey
    ? modules[moduleKey]?.rows.find((row) => row.id === id)
    : undefined;
  const initialImageUrl = String(
    currentRecord?.imageUrl ?? currentRecord?.image ?? "",
  );
  const workflow = workflowConfigs[section];

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
          {workflow && (
            <WorkflowEditor
              eyebrow={workflow.eyebrow}
              steps={workflow.steps}
              currentStep={workflowStep}
              instruction={workflow.instruction}
              onStepChange={(step) => {
                setWorkflowStep(step);
                setSaved(false);
              }}
            />
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            {canEditImage && (
              <ImageEditor
                inputId={`${section}-${id}-image`}
                title={section === "products" ? "Ảnh sản phẩm" : "Ảnh khuyến mãi"}
                description={
                  section === "products"
                    ? "Ảnh đại diện được sử dụng trong danh sách và trang chi tiết sản phẩm."
                    : "Ảnh đại diện được sử dụng cho banner và nội dung chương trình khuyến mãi."
                }
                initialUrl={initialImageUrl}
                onChange={() => setSaved(false)}
              />
            )}
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
