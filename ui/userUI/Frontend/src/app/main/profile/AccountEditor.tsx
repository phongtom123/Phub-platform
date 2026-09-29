"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/common/Button";
import { Checkbox } from "@/components/common/Checkbox";
import { TextField } from "@/components/common/TextField";
import type { DemoAccount, EditorKind } from "./accountData";
import styles from "./profile.module.css";

interface AccountEditorProps {
  kind: EditorKind;
  account: DemoAccount;
  onSave: (patch: Partial<DemoAccount>) => void;
  onClose: () => void;
}

const titles = { contact: "Edit Contact Information", newsletter: "Newsletter Subscriptions", billing: "Edit Billing Address", shipping: "Edit Shipping Address" };

export function AccountEditor({ kind, account, onSave, onClose }: AccountEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [subscribed, setSubscribed] = useState(account.subscribed);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    // Native required also accepts spaces, so reject whitespace-only values.
    for (const input of Array.from(form.querySelectorAll<HTMLInputElement>("input[required]"))) {
      if (!input.value.trim()) { input.setCustomValidity("Please enter a value."); input.reportValidity(); return; }
    }
    if (kind === "contact") onSave({ name: String(data.get("name")).trim(), email: String(data.get("email")).trim() });
    else if (kind === "newsletter") onSave({ subscribed });
    else onSave({ [kind]: String(data.get("address")).trim() });
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={id + "-title"} aria-describedby={id + "-hint"}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.dialogHeading}>
      <h2 id={id + "-title"}>{titles[kind]}</h2>
      <button type="button" className={styles.closeButton} aria-label="Close editor" onClick={onClose}>×</button>
    </div>
    <p id={id + "-hint"} className={styles.demoHint}>UI preview only. Changes reset when you reload. Please use sample information.</p>
    <form onSubmit={submit} className={styles.form}>
      {kind === "contact" ? <>
        <TextField label="Full Name" name="name" defaultValue={account.name} required maxLength={100} autoComplete="off" onChange={event => event.currentTarget.setCustomValidity("")} />
        <TextField label="Email Address" name="email" type="email" defaultValue={account.email} required maxLength={254} autoComplete="off" onChange={event => event.currentTarget.setCustomValidity("")} />
      </> : kind === "newsletter" ? <Checkbox label="Subscribe to our newsletter" checked={subscribed} onChange={event => setSubscribed(event.target.checked)} />
        : <TextField label={kind === "billing" ? "Billing Address" : "Shipping Address"} name="address" defaultValue={account[kind]} required maxLength={250} autoComplete="off" placeholder="123 Example Street, Example City" onChange={event => event.currentTarget.setCustomValidity("")} />}
      <div className={styles.formActions}>
        <Button type="submit">Save preview</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  </dialog>;
}
