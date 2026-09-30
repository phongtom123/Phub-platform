"use client";

import Image from "next/image";
import { useId, useRef, useState, type FormEvent } from "react";
import { IconButton } from "./icon";
import styles from "./SearchInput.module.css";

export interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  className?: string;
  iconSrc?: string;
}

export function SearchInput({ onSearch, placeholder = "Tìm kiếm sản phẩm...", label = "Tìm kiếm sản phẩm", autoFocus = false, className, iconSrc }: SearchInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      inputRef.current?.setCustomValidity("Bạn hãy nhập từ khóa tìm kiếm.");
      inputRef.current?.reportValidity();
      return;
    }
    onSearch(value);
  }

  return (
    <form role="search" aria-label={label} className={[styles.form, className].filter(Boolean).join(" ")} onSubmit={submit}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <input ref={inputRef} id={id} name="q" type="search" placeholder={placeholder} autoComplete="off" autoFocus={autoFocus} required maxLength={200} value={query}
        onChange={event => { event.currentTarget.setCustomValidity(""); setQuery(event.target.value); }} />
      <IconButton type="submit" label="Tìm kiếm" className={styles.submit}>
        <Image src={iconSrc ?? "/icons/header/search.svg"} alt="" width={iconSrc ? 14.5783 : 15.366} height={iconSrc ? 14.5726 : 15.36} />
      </IconButton>
    </form>
  );
}
