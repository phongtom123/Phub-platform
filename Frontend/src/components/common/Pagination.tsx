"use client";

import { IconButton, Chevron } from "./icon";
import styles from "./common.module.css";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ currentPage: requestedPage, totalPages, onPageChange }: PaginationProps) {
	if (!Number.isInteger(totalPages) || totalPages < 1) return null;
	const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage) || 1));
  const pages = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [1, currentPage - 1, currentPage, currentPage + 1, totalPages];

  const visiblePages = Array.from(new Set(pages)).filter(
      (page) => page > 0 && page <= totalPages,
  ).sort((a, b) => a - b);

  const goTo = (page: number) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) onPageChange?.(page);
  };

  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      <IconButton
        className={styles.paginationButton}
        disabled={currentPage <= 1}
        label="Previous page"
        onClick={() => goTo(currentPage - 1)}
      >
        <Chevron direction="left" />
      </IconButton>
      {visiblePages.map((page, index) => (
        <span key={page} className={styles.paginationItem}>
          {index > 0 && page - visiblePages[index - 1] > 1 && (
            <span className={styles.paginationEllipsis}>...</span>
          )}
          <button
            aria-current={page === currentPage ? "page" : undefined}
            className={[styles.paginationButton, page === currentPage ? styles.currentPage : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => goTo(page)}
            type="button"
          >
            {page}
          </button>
        </span>
      ))}
      <IconButton
        className={styles.paginationButton}
        disabled={currentPage >= totalPages}
        label="Next page"
        onClick={() => goTo(currentPage + 1)}
      >
        <Chevron />
      </IconButton>
    </nav>
  );
}
