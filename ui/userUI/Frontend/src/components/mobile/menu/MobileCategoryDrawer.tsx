"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/common/icon";
import type { useCategories } from "@/lib/catalog/useCategories";
import { categoryHref, childCategories, rootCategories } from "@/lib/catalog/categories";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import styles from "./MobileCategoryDrawer.module.css";

interface Props {
  catalog: ReturnType<typeof useCategories>;
  id: string;
  open: boolean;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onClose: () => void;
}

/** Menu 1 and Menu 2 are two states of the same accessible drawer. */
export function MobileCategoryDrawer({ catalog, id, open, selectedCategoryId, onSelectCategory, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const selected = catalog.data.find(category => category.id === selectedCategoryId);
  const categories = selected ? childCategories(catalog.data, selected.id) : rootCategories(catalog.data);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const previousOverflow = document.body.style.overflow;
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
      return () => {
        if (dialog.open) dialog.close();
        document.body.style.overflow = previousOverflow;
      };
    }
    if (dialog.open) dialog.close();
  }, [open]);

  function navigate(href: string) {
    onClose();
    router.push(href);
  }

  return <dialog
    ref={dialogRef}
    id={id}
    className={styles.dialog}
    aria-label="Danh mục sản phẩm"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className={styles.panel}>
      <div className={styles.heading}>
        <Image src="/images/figma-mobile/menu-logo.svg" width={34} height={40} alt="PHUB" priority />
        <IconButton label="Đóng danh mục" className={styles.close} onClick={onClose}>
          <Image src="/images/figma-mobile/menu-close.svg" width={14} height={14} alt="" />
        </IconButton>
      </div>
      <CatalogStatus loading={catalog.loading} error={catalog.error} retry={catalog.retry} />
      {!catalog.loading && !catalog.error && <nav className={styles.items} aria-label="Chọn danh mục">
        {selected && <>
          <button type="button" className={styles.back} onClick={() => onSelectCategory(selected.parentId)}>← Quay lại</button>
          <button type="button" className={styles.item} onClick={() => navigate(categoryHref(selected.id))}>Xem tất cả {selected.label}</button>
        </>}
        {categories.map(category => <button type="button" key={category.id} className={styles.item}
          onClick={() => childCategories(catalog.data, category.id).length ? onSelectCategory(category.id) : navigate(categoryHref(category.id))}
        >{category.label}{childCategories(catalog.data, category.id).length > 0 && <span aria-hidden="true">›</span>}</button>)}
        <button type="button" className={styles.item} onClick={() => navigate("/main/product")}>Tất cả sản phẩm</button>
      </nav>}
    </div>
  </dialog>;
}
