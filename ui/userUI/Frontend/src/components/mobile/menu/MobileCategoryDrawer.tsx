"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/common/icon";
import { useCatalogMetadata } from "@/lib/catalog/useCatalog";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import styles from "./MobileCategoryDrawer.module.css";

interface Props {
  id: string;
  open: boolean;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onClose: () => void;
}

/** Menu 1 and Menu 2 are two states of the same accessible drawer. */
export function MobileCategoryDrawer({ id, open, selectedCategoryId, onSelectCategory, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const metadata = useCatalogMetadata();

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
      <CatalogStatus loading={metadata.loading} error={metadata.error} retry={metadata.retry} />
      {!metadata.loading && !metadata.error && <nav className={styles.items}>
        {metadata.data.categories.map(category => <button type="button" key={category.id} className={styles.item} onClick={() => navigate(`/main/product?category_id=${encodeURIComponent(category.id)}`)}>{category.label}</button>)}
        <button type="button" className={styles.item} onClick={() => navigate("/main/product")}>Tất cả sản phẩm</button>
      </nav>}
    </div>
  </dialog>;
}
