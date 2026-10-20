"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useId,
  useRef,
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IconButton } from "./icon";
import {
  fetchSearchSuggestions,
  formatPriceDisplay,
  removeVietnameseTones,
  type SearchSuggestion,
} from "@/lib/catalog/searchSuggestions";
import styles from "./SearchInput.module.css";

export interface SearchInputProps {
  onSearch: (query: string) => void;
  onSelectProduct?: (product: SearchSuggestion) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  className?: string;
  iconSrc?: string;
  maxLength?: number;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  const normQuery = removeVietnameseTones(trimmed);
  const normText = removeVietnameseTones(text);

  if (!normQuery) return <>{text}</>;

  // Find all matches in normalized space
  const matches: [number, number][] = [];
  let pos = 0;
  while (pos < normText.length) {
    const idx = normText.indexOf(normQuery, pos);
    if (idx === -1) break;
    matches.push([idx, idx + normQuery.length]);
    pos = idx + normQuery.length;
  }

  if (matches.length === 0) {
    return <>{text}</>;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach(([start, end], i) => {
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <mark key={i} className={styles.highlight}>
        {text.slice(start, end)}
      </mark>
    );
    lastIndex = end;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes}</>;
}

export function SearchInput({
  onSearch,
  onSelectProduct,
  placeholder = "Tìm kiếm sản phẩm...",
  label = "Tìm kiếm sản phẩm",
  autoFocus = false,
  className,
  iconSrc,
  maxLength = 200,
}: SearchInputProps) {
  const router = useRouter();
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchSearchSuggestions(trimmed, 6, controller.signal);
        if (!controller.signal.aborted) {
          setSuggestions(result.items);
          setTotalMatches(result.total);
          setLoading(false);
          setIsOpen(true);
        }
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProduct = useCallback(
    (product: SearchSuggestion) => {
      setIsOpen(false);
      if (onSelectProduct) {
        onSelectProduct(product);
      } else {
        router.push(`/main/product/${encodeURIComponent(product.id)}`);
      }
    },
    [onSelectProduct, router]
  );

  const handleViewAll = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsOpen(false);
    onSearch(trimmed);
  }, [onSearch, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      inputRef.current?.setCustomValidity("Bạn hãy nhập từ khóa tìm kiếm.");
      inputRef.current?.reportValidity();
      return;
    }
    // If a suggestion item is currently selected by arrow keys, navigate to it
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelectProduct(suggestions[selectedIndex]);
      return;
    }
    setIsOpen(false);
    onSearch(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      // Total selectable options: suggestions.length + 1 (last one is "Xem chi tiết tìm kiếm")
      const maxIndex = suggestions.length;
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const maxIndex = suggestions.length;
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={styles.wrapper}>
      <form
        role="search"
        aria-label={label}
        className={[styles.form, className].filter(Boolean).join(" ")}
        onSubmit={submit}
      >
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={id}
          name="q"
          type="search"
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          required
          maxLength={maxLength}
          value={query}
          onFocus={() => {
            if (query.trim().length > 0) setIsOpen(true);
          }}
          onChange={(event) => {
            const val = event.target.value;
            event.currentTarget.setCustomValidity("");
            setQuery(val);
            if (!val.trim()) {
              setSuggestions([]);
              setTotalMatches(0);
              setLoading(false);
              setIsOpen(false);
              setSelectedIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
        />

        {loading && <div className={styles.spinner} aria-label="Đang tìm kiếm..." />}

        {query && !loading && (
          <button
            type="button"
            className={styles.clearBtn}
            aria-label="Xóa nội dung tìm kiếm"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}

        <IconButton type="submit" label="Tìm kiếm" className={styles.submit}>
          <Image
            src={iconSrc ?? "/icons/header/search.svg"}
            alt=""
            width={iconSrc ? 14.5783 : 15.366}
            height={iconSrc ? 14.5726 : 15.36}
          />
        </IconButton>
      </form>

      {/* Intelligent Search Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className={styles.dropdown} role="region" aria-label="Sản phẩm đề xuất">
          <div className={styles.dropdownHeader}>
            <span className={styles.headerTitle}>Sản phẩm đề xuất</span>
            {totalMatches > 0 && (
              <span className={styles.headerCount}>{totalMatches} kết quả</span>
            )}
          </div>

          {loading && suggestions.length === 0 ? (
            <div className={styles.loadingNotice}>
              <div className={styles.spinner} />
              <span>Đang tìm kiếm sản phẩm đề xuất...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <ul className={styles.suggestionsList} role="listbox">
                {suggestions.map((item, index) => {
                  const isSelected = selectedIndex === index;
                  return (
                    <li key={item.id} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        className={[
                          styles.suggestionItem,
                          isSelected && styles.suggestionItemActive,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleSelectProduct(item)}
                      >
                        <div className={styles.thumbWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageSrc || "/images/catalog/product-placeholder.svg"}
                            alt=""
                            className={styles.thumbImg}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/images/catalog/product-placeholder.svg";
                            }}
                          />
                        </div>
                        <div className={styles.itemInfo}>
                          <div className={styles.itemName}>
                            <HighlightMatch text={item.name} query={query} />
                          </div>
                          <div className={styles.itemMeta}>
                            {item.brand && (
                              <span className={styles.itemBadge}>{item.brand}</span>
                            )}
                            {item.category && <span>{item.category}</span>}
                            {item.sku && <span>SKU: {item.sku}</span>}
                          </div>
                        </div>
                        <div className={styles.itemPrice}>
                          {formatPriceDisplay(item.price, item.currency)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Footer with user requested "Xem chi tiết tìm kiếm" */}
              <div className={styles.dropdownFooter}>
                <span className={styles.footerHint}>
                  Nhấn Enter để tìm tất cả
                </span>
                <button
                  type="button"
                  className={styles.viewAllButton}
                  onClick={handleViewAll}
                >
                  Xem chi tiết tìm kiếm &rarr;
                </button>
              </div>
            </>
          ) : (
            <div className={styles.emptyNotice}>
              <p>
                Không tìm thấy sản phẩm nào khớp với <strong>&quot;{query.trim()}&quot;</strong>.
              </p>
              <button
                type="button"
                className={styles.viewAllButton}
                onClick={handleViewAll}
                style={{ marginTop: 8 }}
              >
                Xem chi tiết tìm kiếm &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
