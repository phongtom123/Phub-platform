import Link from "next/link";
import styles from "./store.module.css";

export interface TabNavProps {
  items: { label: string; href: string }[];
  activeHref: string;
  label?: string;
  className?: string;
}

/** Navigation links, not ARIA tabs: callers provide real routes or section anchors. */
export function TabNav({ items, activeHref, label = "Product information", className }: TabNavProps) {
  return (
    <nav aria-label={label} className={[styles.tabNav, className].filter(Boolean).join(" ")}>
      {items.map(item => <Link key={item.href} href={item.href} aria-current={activeHref === item.href ? "page" : undefined}>{item.label}</Link>)}
    </nav>
  );
}
