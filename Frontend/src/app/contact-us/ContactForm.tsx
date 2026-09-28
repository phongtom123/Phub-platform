"use client";
import { useState, type FormEvent } from "react";
import styles from "./contact.module.css";

export function ContactForm() {
  const [status, setStatus] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; if (!form.checkValidity()) { form.reportValidity(); return; } setStatus("Thank you! Your message has been received in this UI preview."); form.reset(); }
  return <form className={styles.form} onSubmit={submit}>
    <div className={styles.twoColumns}><label>Your Name <em>*</em><input name="name" placeholder="Your Name" autoComplete="name" required /></label><label>Your Email <em>*</em><input name="email" type="email" placeholder="Your Email" autoComplete="email" required /></label></div>
    <label>Your Phone Number<input name="phone" type="tel" placeholder="Your Phone" autoComplete="tel" /></label>
    <label>What’s on your mind? <em>*</em><textarea name="message" placeholder="Jot us a note and we’ll get back to you as quickly as possible" required /></label>
    <button type="submit">Submit</button><p className={styles.status} role="status">{status}</p>
  </form>;
}
