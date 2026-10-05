"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import styles from "./NewsletterForm.module.css";

export function NewsletterForm() {
  const statusId = useId();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    const input = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
    input.value = input.value.trim();

    if (!input.validity.valid) {
      setError(input.validity.valueMissing ? "Bạn hãy nhập địa chỉ email." : "Địa chỉ email chưa hợp lệ.");
      input.focus();
      return;
    }

    setError("");
    // The backend only exposes /api/health. Show success only after a real
    // newsletter endpoint accepts this email when that integration is added.
    setStatus("Đăng ký bản tin hiện chưa khả dụng. Vui lòng thử lại sau.");
  }

  return (
    <form className={styles.form} aria-label="Đăng ký nhận bản tin" noValidate onSubmit={handleSubmit}>
      <div className={styles.controls}>
        <TextField
          label="Email nhận bản tin"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email của bạn"
          variant="dark"
          hideLabel
          required
          maxLength={254}
          error={error}
          aria-describedby={status ? statusId : undefined}
          onChange={() => { setError(""); setStatus(""); }}
        />
        <Button type="submit" size="large">Đăng ký</Button>
      </div>
      <p id={statusId} className={styles.status} role="status">{status}</p>
    </form>
  );
}
