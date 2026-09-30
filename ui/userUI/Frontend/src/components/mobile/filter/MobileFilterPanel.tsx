"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/common/icon";
import type { CatalogFilters } from "@/components/catalog/catalogData";
import { Filter1 } from "./Filter1";
import { Filter2 } from "./Filter2";
import { filter2ExpandedSections, type FilterSectionId } from "./filterData";
import styles from "./MobileFilter.module.css";

interface Props {
  open: boolean;
  draft: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onApply: () => void;
  onClose: () => void;
}

export function MobileFilterPanel({ open, draft, onChange, onApply, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<FilterSectionId>>(new Set());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function toggleSection(id: FilterSectionId) {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function close() {
    setExpanded(new Set());
    onClose();
  }

  function apply() {
    setExpanded(new Set());
    onApply();
  }

  return <dialog ref={dialogRef} id="homepage2-filters" className={styles.dialog} aria-label="Bộ lọc sản phẩm" onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.panel}>
      <div className={styles.heading}>
        <h2>Bộ lọc</h2>
        <IconButton label="Đóng bộ lọc" className={styles.close} onClick={close}>
          <Image src="/images/figma-mobile/menu-close.svg" width={14} height={14} alt="" />
        </IconButton>
      </div>
      {expanded.size
        ? <Filter2 expanded={expanded} draft={draft} onChange={onChange} onToggle={toggleSection} onBack={() => setExpanded(new Set())} />
        : <Filter1 draft={draft} onChange={onChange} onExpand={id => setExpanded(new Set([...filter2ExpandedSections, id]))} onApply={apply} />}
    </div>
  </dialog>;
}
