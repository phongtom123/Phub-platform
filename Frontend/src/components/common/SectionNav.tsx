"use client";

import { useEffect, useState } from "react";
import styles from "./SectionNav.module.css";

export interface SectionNavProps {
  items: readonly { id: string; title: string }[];
  label?: string;
}

/** Native anchors still work without JavaScript; hash changes update the current item. */
export function SectionNav({ items, label = "On this page" }: SectionNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.slice(1);
      setActiveId(items.some(item => item.id === hash) ? hash : items[0]?.id ?? "");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [items]);

  return <nav aria-label={label} className={styles.nav}>
    <ul>{items.map(item => <li key={item.id}>
      <a href={"#" + item.id} aria-current={activeId === item.id ? "location" : undefined}>{item.title}</a>
    </li>)}</ul>
  </nav>;
}
