"use client";

import { useState, type FormEvent } from "react";
import { contactPage1Data } from "./contactPage1Data";
import styles from "./ContactPage1.module.css";

export function ContactPage1Form() {
  const [status, setStatus] = useState("");
  const { form } = contactPage1Data;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    if (!target.checkValidity()) {
      target.reportValidity();
      return;
    }

    setStatus(form.successMessage);
    target.reset();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate={false}>
      <label className={styles.field}>
        <span>
          {form.nameLabel} <em className={styles.required}>*</em>
        </span>
        <input
          name="name"
          type="text"
          className={styles.input}
          placeholder={form.namePlaceholder}
          autoComplete="name"
          required
        />
      </label>

      <label className={styles.field}>
        <span>
          {form.emailLabel} <em className={styles.required}>*</em>
        </span>
        <input
          name="email"
          type="email"
          className={styles.input}
          placeholder={form.emailPlaceholder}
          autoComplete="email"
          required
        />
      </label>

      <label className={styles.field}>
        <span>{form.phoneLabel}</span>
        <input
          name="phone"
          type="tel"
          className={styles.input}
          placeholder={form.phonePlaceholder}
          autoComplete="tel"
        />
      </label>

      <label className={styles.field}>
        <span>
          {form.messageLabel} <em className={styles.required}>*</em>
        </span>
        <textarea
          name="message"
          className={styles.textarea}
          placeholder={form.messagePlaceholder}
          required
        />
      </label>

      <div className={styles.buttonContainer}>
        <button type="submit" className={styles.submitBtn}>
          {form.submitButton}
        </button>
      </div>

      {status && (
        <p className={styles.status} role="status">
          {status}
        </p>
      )}
    </form>
  );
}
