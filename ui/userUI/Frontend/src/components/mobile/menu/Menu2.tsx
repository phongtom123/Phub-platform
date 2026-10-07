"use client";

import Image from "next/image";
import { MenuCategory, menuItemHref } from "./menuData";
import styles from "./MobileCategoryDrawer.module.css";

export function Menu2({ category, onBack, onNavigate }: { category: MenuCategory; onBack: () => void; onNavigate: (href: string) => void }) {
  return <nav aria-label={`Danh mục ${category.label}`} className={styles.menu2}>
    <button type="button" className={styles.back} onClick={onBack}>
      <Image src="/images/figma-mobile/menu-chevron.svg" width={16} height={16} alt="" />
      <span>{category.label}</span>
    </button>
    <ul className={styles.items}>
      {category.children.map(item => <li key={item.id}>
        <button type="button" className={styles.item} onClick={() => onNavigate(menuItemHref(category.id, item.id))}>
          <span>{item.label}</span>
          <Image src="/images/figma-mobile/menu-chevron.svg" width={16} height={16} alt="" />
        </button>
      </li>)}
    </ul>
  </nav>;
}
