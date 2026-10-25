"use client";
import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { accountRequest, AccountApiError, parseProfile, type CustomerProfile, type Recipient } from "@/lib/account/client";
import { AccountAccessContext } from "@/lib/account/useAccountResource";
import styles from "./profile.module.css";

export function AccountEditor({ profile, onSaved, onClose }: { profile: CustomerProfile; onSaved: () => void; onClose: () => void }) {
  const [values, setValues] = useState<Recipient>({ name: profile.name, phone: profile.phone ?? "", address_line: profile.address_line ?? "", province: profile.province ?? "", ward: profile.ward ?? "" });
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const onAccessError = useContext(AccountAccessContext);
  useEffect(() => {
    const element = dialog.current; element?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { request.current?.abort(); element?.close(); document.body.style.overflow = previous; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setSaving(true); setError("");
    try {
      await accountRequest("customer/me", parseProfile, { method: "PUT", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, name: values.name.trim(), phone: values.phone.replace(/[ ()-]/g, ""), address_line: values.address_line.trim(), province: values.province.trim(), ward: values.ward.trim() }) });
      if (avatarFile) {
        const avatarResponse = await fetch("/api/backend/customer/me/avatar", {
          method: "POST", signal: controller.signal, credentials: "same-origin",
          headers: { "Content-Type": avatarFile.type }, body: avatarFile,
        });
        if (!avatarResponse.ok) {
          let message = "Không tải được ảnh đại diện.";
          try {
            const body = await avatarResponse.json();
            if (typeof body?.detail === "string") message = body.detail;
          } catch { /* Keep the safe generic message. */ }
          throw new AccountApiError(message, avatarResponse.status);
        }
      }
      if (!controller.signal.aborted) onSaved();
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof AccountApiError && [401, 403].includes(err.status)) onAccessError(err.message);
      setError(err instanceof Error ? err.message : "Không lưu được thông tin.");
    } finally { request.current = null; if (!controller.signal.aborted) setSaving(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="edit-profile-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className={styles.dialogHeading}><h2 id="edit-profile-title">Thông tin nhận hàng</h2><button className={styles.closeButton} onClick={onClose} disabled={saving} aria-label="Đóng biểu mẫu">×</button></div>
    <p className={styles.note}>Lưu vào hồ sơ khách hàng. Không thay đổi địa chỉ trên các đơn đã đặt.</p>
    <form className={styles.form} onSubmit={save}>
      <fieldset disabled={saving} className={styles.fields}>
        <label>Ảnh đại diện (JPG, PNG hoặc WebP; tối đa 5 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp"
            onChange={event => setAvatarFile(event.target.files?.[0] ?? null)} />
        </label>
        <TextField label="Họ và tên" required maxLength={100} autoComplete="name" value={values.name} onChange={event => setValues({ ...values, name: event.target.value })} />
        <TextField label="Số điện thoại" required type="tel" autoComplete="tel" maxLength={25} hint="8–15 chữ số, có thể có mã quốc gia." value={values.phone} onChange={event => setValues({ ...values, phone: event.target.value })} />
        <TextField label="Địa chỉ chi tiết" required maxLength={255} autoComplete="street-address" value={values.address_line} onChange={event => setValues({ ...values, address_line: event.target.value })} />
        <TextField label="Tỉnh / thành phố" required maxLength={100} autoComplete="address-level1" value={values.province} onChange={event => setValues({ ...values, province: event.target.value })} />
        <TextField label="Phường / xã" required maxLength={100} autoComplete="address-level2" value={values.ward} onChange={event => setValues({ ...values, ward: event.target.value })} />
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><Button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thông tin"}</Button><Button variant="outline" disabled={saving} onClick={onClose}>Hủy</Button></div>
    </form>
  </dialog>;
}
