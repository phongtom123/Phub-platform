"use client";

import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { TextField } from "@/components/common/TextField";
import { createAddress, deleteAddress, listAddresses, ShoppingError, updateAddress } from "@/lib/shopping/client";
import type { AddressBook, AddressInput, CustomerAddress } from "@/lib/shopping/types";
import { AccountAccessContext } from "@/lib/account/useAccountResource";
import { AccountIcon } from "./AccountIcon";
import { DataState, Panel } from "./AccountPanels";
import styles from "./profile.module.css";

const MAX_ADDRESSES = 10;
type Props = {
  prefill: { name: string; phone: string | null };
  onChanged: () => void;
  onManage?: () => void;
};

export function AccountAddresses({ prefill, onChanged, onManage }: Props) {
  const [book, setBook] = useState<AddressBook | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<{ address: CustomerAddress | null } | null>(null);
  const [removing, setRemoving] = useState<CustomerAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(false);
  const denyAccess = useContext(AccountAccessContext);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    listAddresses(controller.signal).then(result => {
      if (!controller.signal.aborted) { setBook(result); setError(""); }
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof ShoppingError && [401, 403].includes(cause.status)) denyAccess(cause.message);
      setError(cause instanceof Error ? cause.message : "Không tải được sổ địa chỉ.");
    });
    return () => controller.abort();
  }, [version, denyAccess]);

  async function mutate(operation: () => Promise<AddressBook>, message: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await operation();
      if (!alive.current) return;
      setBook(result); setEditor(null); setRemoving(null); setNotice(message); onChanged();
    } catch (cause) {
      if (!alive.current) return;
      if (cause instanceof ShoppingError && [401, 403].includes(cause.status)) denyAccess(cause.message);
      setError(cause instanceof Error ? cause.message : "Không lưu được địa chỉ. Vui lòng thử lại.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function openEditor(address: CustomerAddress | null) { setError(""); setNotice(""); setEditor({ address }); }
  function closeEditor() { setEditor(null); setError(""); }
  const items = book?.items ?? [];
  const primary = items.find(address => address.is_default);
  const loading = !book && !error;
  const full = !onManage;
  const limitReached = items.length >= MAX_ADDRESSES;
  const action = onManage
    ? <button className={styles.textAction} onClick={onManage}>Quản lý địa chỉ</button>
    : <button className={styles.primaryLink} disabled={!book || busy || limitReached} onClick={() => openEditor(null)}>+ Thêm địa chỉ</button>;

  return <>
    <Panel title="Địa chỉ giao hàng" action={action}>
      {full && <p className={styles.sectionDescription}>Lưu địa chỉ nhận hàng để chọn nhanh khi đặt đơn. Tối đa {MAX_ADDRESSES} địa chỉ.</p>}
      {!editor && !removing && <DataState loading={loading} error={error} reload={() => { setError(""); setVersion(value => value + 1); }} />}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {book && !items.length && <div className={styles.emptyAddress}>
        <AccountIcon name="addresses" /><p>Bạn chưa có địa chỉ giao hàng.</p>
        {full && <p>Thêm địa chỉ đầu tiên; địa chỉ này sẽ được đặt làm mặc định.</p>}
      </div>}
      {!full && primary && <AddressContent address={primary} />}
      {full && book && <>
        <div className={styles.addressBookCount}>{items.length}/{MAX_ADDRESSES} địa chỉ đã lưu{limitReached && <span>Đã đạt giới hạn. Bạn có thể sửa hoặc xóa địa chỉ không dùng.</span>}</div>
        <div className={styles.addressList}>
          {items.map(address => <article key={address.id} className={styles.addressCard} data-default={address.is_default} aria-label={`Địa chỉ của ${address.name}`}>
            <AddressContent address={address} />
            <div className={styles.addressActions}>
              <button className={styles.textAction} disabled={busy} onClick={() => openEditor(address)} aria-label={`Sửa địa chỉ của ${address.name}`}>Chỉnh sửa</button>
              {!address.is_default && <button className={styles.textAction} disabled={busy} onClick={() => {
                const { id, ...input } = address;
                void mutate(() => updateAddress(id, { ...input, is_default: true }), "Đã đổi địa chỉ mặc định.");
              }}>Đặt làm mặc định</button>}
              <button className={styles.dangerAction} disabled={busy} onClick={() => { setError(""); setNotice(""); setRemoving(address); }} aria-label={`Xóa địa chỉ của ${address.name}`}>Xóa</button>
            </div>
          </article>)}
        </div>
        {busy && !editor && !removing && <p className={styles.note} role="status">Đang cập nhật địa chỉ…</p>}
      </>}
    </Panel>
    {editor && <AddressEditor address={editor.address} first={!items.length} prefill={prefill} busy={busy} error={error} onClose={closeEditor}
      onSave={input => void mutate(() => editor.address ? updateAddress(editor.address.id, input) : createAddress(input), editor.address ? "Đã cập nhật địa chỉ." : "Đã thêm địa chỉ mới.")} />}
    {removing && <AddressDialog title="Xóa địa chỉ giao hàng" busy={busy} onClose={() => { setRemoving(null); setError(""); }}>
      <p className={styles.note}>Xóa địa chỉ của <strong>{removing.name}</strong> tại {removing.address_line}?</p>
      <p className={styles.note}>{removing.is_default && items.length > 1 ? "Một địa chỉ còn lại sẽ được chọn làm mặc định. " : ""}Địa chỉ trên các đơn đã đặt được giữ nguyên.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className={styles.deleteButton} disabled={busy} onClick={() => void mutate(() => deleteAddress(removing.id), "Đã xóa địa chỉ.")}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</button>
        <button className={styles.secondaryButton} disabled={busy} onClick={() => { setRemoving(null); setError(""); }}>Hủy</button>
      </div>
    </AddressDialog>}
  </>;
}

function AddressContent({ address }: { address: CustomerAddress }) {
  return <div className={styles.address}>
    {address.is_default && <span className={styles.addressTag}>Địa chỉ mặc định</span>}
    <h3>{address.name}</h3><p className={styles.addressPhone}>{address.phone}</p>
    <p>{[address.address_line, address.ward, address.province].filter(Boolean).join(", ")}</p>
  </div>;
}

function AddressDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current; element?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.dialogHeading}><h2>{title}</h2><button type="button" className={styles.closeButton} aria-label="Đóng biểu mẫu" disabled={busy} onClick={onClose}>×</button></div>
    <div className={styles.addressDialogBody}>{children}</div>
  </dialog>;
}

function AddressEditor({ address, first, prefill, busy, error, onClose, onSave }: {
  address: CustomerAddress | null; first: boolean; prefill: Props["prefill"]; busy: boolean; error: string;
  onClose: () => void; onSave: (input: AddressInput) => void;
}) {
  const [values, setValues] = useState<AddressInput>(() => ({ name: address?.name ?? prefill.name, phone: address?.phone ?? prefill.phone ?? "", address_line: address?.address_line ?? "", province: address?.province ?? "", ward: address?.ward ?? "", is_default: first || !!address?.is_default }));
  const [validation, setValidation] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { ...values, name: values.name.trim(), phone: values.phone.replace(/[ ()-]/g, ""), address_line: values.address_line.trim(), province: values.province.trim(), ward: values.ward.trim() };
    if (!input.name || !input.address_line || !input.province || !input.ward) { setValidation("Vui lòng điền đầy đủ thông tin nhận hàng."); return; }
    if (!/^\+?[0-9]{8,15}$/.test(input.phone)) { setValidation("Số điện thoại phải gồm 8–15 chữ số."); return; }
    setValidation(""); onSave(input);
  }
  return <AddressDialog title={address ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ giao hàng"} busy={busy} onClose={onClose}>
    <p className={styles.note}>Tên và điện thoại người nhận có thể khác thông tin tài khoản. Không thay đổi địa chỉ trên các đơn đã đặt.</p>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fields} disabled={busy}>
        <TextField label="Tên người nhận" required maxLength={100} autoComplete="shipping name" value={values.name} onChange={event => setValues({ ...values, name: event.target.value })} />
        <TextField label="Số điện thoại" required type="tel" maxLength={25} autoComplete="shipping tel" value={values.phone} onChange={event => setValues({ ...values, phone: event.target.value })} />
        <TextField label="Địa chỉ chi tiết" required maxLength={255} autoComplete="shipping street-address" value={values.address_line} onChange={event => setValues({ ...values, address_line: event.target.value })} />
        <TextField label="Tỉnh / thành phố" required maxLength={100} autoComplete="shipping address-level1" value={values.province} onChange={event => setValues({ ...values, province: event.target.value })} />
        <TextField label="Phường / xã" required maxLength={100} autoComplete="shipping address-level2" value={values.ward} onChange={event => setValues({ ...values, ward: event.target.value })} />
        <label className={styles.defaultCheckbox}><input type="checkbox" checked={!!values.is_default} disabled={first || !!address?.is_default} onChange={event => setValues({ ...values, is_default: event.target.checked })} />Đặt làm địa chỉ mặc định</label>
        {(first || address?.is_default) && <p className={styles.note}>Để đổi địa chỉ mặc định, chọn một địa chỉ khác trong sổ địa chỉ.</p>}
      </fieldset>
      {(validation || error) && <p className={styles.error} role="alert">{validation || error}</p>}
      <div className={styles.actions}><button type="submit" className={styles.primaryLink} disabled={busy}>{busy ? "Đang lưu…" : "Lưu địa chỉ"}</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>Hủy</button></div>
    </form>
  </AddressDialog>;
}
