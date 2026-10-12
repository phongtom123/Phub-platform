"use client";

import Image from "next/image";
import { Button } from "@/components/common/Button";
import { menuCategories } from "./menuData";
import styles from "./MobileCategoryDrawer.module.css";

export function Menu1({ onSelect, onDeals }: { onSelect: (id: string) => void; onDeals: () => void }) {
  return <div className={styles.menu1}>
    <nav aria-label="Danh mục sản phẩm">
      <ul className={styles.items}>
        {menuCategories.map(category => <li key={category.id}>
          <button type="button" className={styles.item} onClick={() => onSelect(category.id)}>
            <span>{category.label}</span>
            <Image src="/images/figma-mobile/menu-chevron.svg" width={16} height={16} alt="" />
          </button>
        </li>)}
      </ul>
    </nav>
    <Button variant="outlinePrimary" className={styles.deals} onClick={onDeals}>Ưu đãi</Button>
  </div>;
}
