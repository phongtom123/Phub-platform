"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { FormFieldDefinition, ModuleKey } from "@/src/types/admin";
import { formFields, moduleNames } from "@/src/data/admin-data";
import { PrimaryButton } from "@/src/components/admin/ui";

type Props = {
  moduleKey: ModuleKey | "settings";
  mode: "create" | "edit" | "settings";
  onClose: () => void;
};

export function EntityDrawer({ moduleKey, mode, onClose }: Props) {
  const [saved, setSaved] = useState(false);
  const fields = formFields[moduleKey] ?? [];
  const title =
    mode === "settings"
      ? "Cài đặt hệ thống"
      : `${mode === "create" ? "Thêm" : "Chỉnh sửa"} ${moduleNames[moduleKey as ModuleKey]?.toLowerCase() ?? "thông tin"}`;
  return (
    <div
      className="modal-bg"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="modal">
        <header>
          <div>
            <h2>{title}</h2>
            <p>
              {mode === "settings"
                ? "Tùy chỉnh trải nghiệm quản trị của bạn."
                : "Điền đầy đủ thông tin bên dưới."}
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <main>
          {mode === "settings" ? (
            <SettingsForm />
          ) : (
            <div className="form-grid">
              {fields.map((field) => (
                <FormField field={field} key={field.name} />
              ))}
            </div>
          )}
        </main>
        <footer>
          <PrimaryButton secondary onClick={onClose}>
            Hủy
          </PrimaryButton>
          <PrimaryButton onClick={() => setSaved(true)}>
            {saved ? (
              <>
                <Check /> Đã lưu
              </>
            ) : (
              "Lưu thông tin"
            )}
          </PrimaryButton>
        </footer>
      </section>
    </div>
  );
}

function FormField({ field }: { field: FormFieldDefinition }) {
  return (
    <label className={field.wide ? "wide" : ""}>
      <span>{field.label}</span>
      {field.type === "textarea" ? (
        <textarea placeholder={field.placeholder} />
      ) : (
        <input type={field.type ?? "text"} placeholder={field.placeholder} />
      )}
    </label>
  );
}

function SettingsForm() {
  return (
    <div className="settings-form">
      <section>
        <h3>Hiển thị</h3>
        <SettingToggle
          title="Sidebar thu gọn"
          description="Ghi nhớ trạng thái thanh điều hướng."
        />
        <SettingToggle
          title="Giao diện cô đọng"
          description="Giảm khoảng cách giữa các dòng dữ liệu."
        />
      </section>
      <section>
        <h3>Thông báo</h3>
        <SettingToggle
          title="Đơn hàng mới"
          description="Thông báo khi có đơn cần xác nhận."
          checked
        />
        <SettingToggle
          title="Cảnh báo tồn kho"
          description="Thông báo khi sản phẩm sắp hết."
          checked
        />
      </section>
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked = false,
}: {
  title: string;
  description: string;
  checked?: boolean;
}) {
  return (
    <label>
      <span>
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <input type="checkbox" defaultChecked={checked} />
    </label>
  );
}
