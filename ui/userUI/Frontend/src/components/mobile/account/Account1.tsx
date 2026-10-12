import Link from "next/link";
import { account1Items } from "./account1Data";
import styles from "./Account1.module.css";

export function Account1({ onNavigate }: { onNavigate: () => void }) {
  return <nav aria-label="Tài khoản" className={styles.menu}>
    {account1Items.map(item => "href" in item
      ? <Link key={item.label} href={item.href} onClick={onNavigate}>{item.label}</Link>
      : <span key={item.label}>{item.label}</span>)}
  </nav>;
}
