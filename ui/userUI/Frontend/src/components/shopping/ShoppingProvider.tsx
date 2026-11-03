"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getProfile, ShoppingError } from "@/lib/shopping/client";
import {
  mergeStoredCarts,
  restoreCart,
  type StoredCartLine,
} from "@/lib/shopping/cart-storage";
import { readJson, validateProduct } from "@/lib/catalog/client";
import { safeImageUrl } from "@/lib/catalog/types";
import type { CartLine, CustomerProfile } from "@/lib/shopping/types";
import styles from "./shopping.module.css";
import { getAvailability, MAX_QUANTITY } from "@/lib/shopping/availability";
import { automaticRefresh } from "@/lib/automaticRefresh";

type AuthStatus = "loading" | "authenticated" | "guest" | "unavailable";
interface ShoppingState {
  customer: CustomerProfile | null;
  authStatus: AuthStatus;
  authMessage: string;
  lines: CartLine[];
  selectedLines: CartLine[];
  cartLoading: boolean;
  notice: string;
  count: number;
  availability: Record<string, number>;
  stockError: string;
  taxRate: string | null;
  refreshStock: () => void;
  refreshSession: () => Promise<void>;
  add: (
    product: { id: string; sku?: string },
    quantity?: number,
  ) => Promise<boolean>;
  update: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  select: (sku: string, selected: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  completeOrder: (
    items: { sku: string; quantity: number }[],
    customerId: string,
  ) => void;
  refreshCart: () => Promise<void>;
  setNotice: (value: string) => void;
}
const ShoppingContext = createContext<ShoppingState | null>(null);
const GUEST_CART_OWNER = "__guest__";
const GUEST_CART_KEY = "phub-cart-guest-v1";
const keyFor = (id: string) =>
  id === GUEST_CART_OWNER ? GUEST_CART_KEY : `phub-cart-v1:${id}`;

function readStoredCart(id: string): StoredCartLine[] {
  try {
    return restoreCart(JSON.parse(localStorage.getItem(keyFor(id)) || "[]"));
  } catch {
    return [];
  }
}

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authMessage, setAuthMessage] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const selectedLines = useMemo(() => lines.filter(line => line.selected !== false), [lines]);
  const [cartLoading, setCartLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [taxRate, setTaxRate] = useState<string | null>(null);
  const [stockError, setStockError] = useState("");
  const [stockVersion, setStockVersion] = useState(0);
  const stockSignature = JSON.stringify(lines.map(line => line.sku).sort());
  useEffect(() => {
    const skus: string[] = JSON.parse(stockSignature);
    const controller = new AbortController();
    setAvailability({}); setTaxRate(null); setStockError("");
    if (!skus.length) return;
    const stop = automaticRefresh(async () => {
      try {
        const stock = await getAvailability(skus, controller.signal);
        if (!controller.signal.aborted) { setAvailability(stock.quantities); setTaxRate(stock.taxRate); setStockError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) { setStockError(cause instanceof Error ? cause.message : "Chưa tải được tồn kho."); setAvailability({}); setTaxRate(null); }
      }
      return true;
    }, 60_000);
    return () => { controller.abort(); stop(); };
  }, [stockSignature, stockVersion]);
  const owner = useRef<string | null>(null);
  const linesRef = useRef<CartLine[]>([]);
  const sessionGeneration = useRef(0);
  const cartGeneration = useRef(0);
  const persist = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
    if (owner.current) {
      try {
        localStorage.setItem(
          keyFor(owner.current),
          JSON.stringify(
            next.map(({ product_id, sku, quantity, selected }) => ({
              product_id,
              sku,
              quantity,
              selected: selected !== false,
            })),
          ),
        );
      } catch {
        setNotice(
          "Không thể lưu giỏ trên trình duyệt; hãy giữ trang mở khi đặt hàng.",
        );
      }
    }
  }, []);
  const loadLines = useCallback(
    async (
      entries: { product_id: string; sku: string; quantity: number; selected?: boolean }[],
      id: string,
    ) => {
      const generation = ++cartGeneration.current;
      setCartLoading(true);
      const next: CartLine[] = [];
      try {
        for (const entry of entries) {
          try {
            const product = validateProduct(
              await readJson(
                await fetch(
                  `/api/catalog/products/${encodeURIComponent(entry.product_id)}`,
                  { cache: "no-store" },
                ),
              ),
            );
            if (product.sku !== entry.sku) throw new Error("SKU changed");
            next.push({
              ...entry,
              name: product.name,
              image: safeImageUrl(product.images[0]?.url),
              unit_price: product.price,
              currency: product.currency,
            });
          } catch {
            next.push({
              ...entry,
              name: entry.sku,
              image: "/images/catalog/product-placeholder.svg",
              unit_price: "0.00",
              currency: "VND",
              unavailable: true,
            });
          }
        }
        if (generation === cartGeneration.current && owner.current === id) {
          linesRef.current = next;
          setLines(next);
        }
      } catch {
        if (generation === cartGeneration.current && owner.current === id)
          setNotice(
            "Có sản phẩm không thể tải lại. Vui lòng kiểm tra hoặc xóa sản phẩm đó trước khi đặt hàng.",
          );
      } finally {
        if (generation === cartGeneration.current) setCartLoading(false);
      }
    },
    [],
  );
  const refreshSession = useCallback(async () => {
    const generation = ++sessionGeneration.current;
    try {
      const profile = await getProfile();
      if (generation !== sessionGeneration.current) return;
      setCustomer(profile);
      setAuthStatus("authenticated");
      setAuthMessage("");
      const guestEntries = readStoredCart(GUEST_CART_OWNER);
      if (owner.current !== profile.customer_id || guestEntries.length > 0) {
        const accountEntries = readStoredCart(profile.customer_id);
        const entries = mergeStoredCarts(accountEntries, guestEntries);
        let guestTransferred = false;
        if (guestEntries.length > 0) {
          try {
            localStorage.setItem(
              keyFor(profile.customer_id),
              JSON.stringify(entries),
            );
            localStorage.removeItem(GUEST_CART_KEY);
            guestTransferred = true;
          } catch {
            setNotice(
              "Không thể chuyển giỏ hàng khách vào tài khoản trên trình duyệt này.",
            );
          }
        }
        owner.current = profile.customer_id;
        linesRef.current = [];
        setLines([]);
        await loadLines(entries, profile.customer_id);
        if (guestTransferred) {
          setNotice(
            `Đã chuyển ${guestEntries.length} sản phẩm từ giỏ hàng khách vào tài khoản.`,
          );
        } else if (guestEntries.length === 0) {
          setNotice("");
        }
      }
    } catch (error) {
      if (generation !== sessionGeneration.current) return;
      setCustomer(null);
      const guest = error instanceof ShoppingError && error.status === 401;
      setAuthStatus(guest ? "guest" : "unavailable");
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "Không thể xác minh tài khoản. Vui lòng thử lại.",
      );
      if (guest) {
        if (owner.current !== GUEST_CART_OWNER) {
          owner.current = GUEST_CART_OWNER;
          linesRef.current = [];
          setLines([]);
          setNotice("");
          await loadLines(readStoredCart(GUEST_CART_OWNER), GUEST_CART_OWNER);
        }
      } else {
        owner.current = null;
        ++cartGeneration.current;
        linesRef.current = [];
        setLines([]);
        setCartLoading(false);
      }
    }
  }, [loadLines]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, refreshSession]);
  useEffect(() => {
    const refresh = () => {
      void refreshSession();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("phub:session-changed", refresh);
    window.addEventListener("phub-auth-session", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("phub:session-changed", refresh);
      window.removeEventListener("phub-auth-session", refresh);
    };
  }, [refreshSession]);
  const add = async (product: { id: string; sku?: string }, quantity = 1) => {
    const id = owner.current;
    if (!id || !["authenticated", "guest"].includes(authStatus)) {
      setNotice(
        authMessage || "Đang xác minh tài khoản. Vui lòng thử lại.",
      );
      return false;
    }
    if (
      cartLoading ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    )
      return false;
    setCartLoading(true);
    try {
      const actual = validateProduct(
        await readJson(
          await fetch(
            `/api/catalog/products/${encodeURIComponent(product.id)}`,
            { cache: "no-store" },
          ),
        ),
      );
      if (owner.current !== id) return false;
      if (product.sku !== undefined && actual.sku !== product.sku)
        throw new Error("Sản phẩm đã thay đổi. Vui lòng chọn lại.");
      const stock = await getAvailability([actual.sku]);
      if (owner.current !== id) return false;
      const current = linesRef.current;
      const existing = current.find((item) => item.sku === actual.sku);
      if ((existing?.quantity || 0) + quantity > stock.quantities[actual.sku])
        throw new Error(`Chỉ còn ${stock.quantities[actual.sku]} sản phẩm khả dụng trong kho.`);
      if (
        (existing?.quantity || 0) + quantity > MAX_QUANTITY ||
        (!existing && current.length >= 100)
      )
        throw new Error("Giỏ hàng vượt số lượng cho phép.");
      persist(
        existing
          ? current.map((item) =>
              item.sku === actual.sku
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    name: actual.name,
                    image: safeImageUrl(actual.images[0]?.url),
                    unit_price: actual.price,
                    currency: actual.currency,
                    unavailable: false,
                    selected: true,
                  }
                : item,
            )
          : [
              ...current,
              {
                product_id: actual.id,
                sku: actual.sku,
                quantity,
                selected: true,
                name: actual.name,
                image: safeImageUrl(actual.images[0]?.url),
                unit_price: actual.price,
                currency: actual.currency,
              },
            ],
      );
      setNotice("Đã thêm sản phẩm vào giỏ hàng.");
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể thêm sản phẩm.",
      );
      return false;
    } finally {
      setCartLoading(false);
    }
  };
  const refreshCart = async () => {
    if (owner.current) await loadLines(linesRef.current, owner.current);
    setStockVersion(version => version + 1);
  };
  const update = (sku: string, quantity: number) => {
    const limit = availability[sku];
    if (!Number.isInteger(quantity) || quantity < 1 || limit === undefined || limit === 0) return;
    quantity = Math.min(quantity, limit);
    persist(
      linesRef.current.map((item) =>
        item.sku === sku ? { ...item, quantity } : item,
      ),
    );
  };
  const remove = (sku: string) => {
    persist(linesRef.current.filter((item) => item.sku !== sku));
  };
  const clear = () => persist([]);
  const select = (sku: string, selected: boolean) => persist(
    linesRef.current.map(line => line.sku === sku ? { ...line, selected } : line),
  );
  const selectAll = () => persist(linesRef.current.map(line => ({ ...line, selected: true })));
  const deselectAll = () => persist(linesRef.current.map(line => ({ ...line, selected: false })));
  const completeOrder = (
    items: { sku: string; quantity: number }[],
    customerId: string,
  ) => {
    if (owner.current !== customerId) return;
    const quantities = new Map<string, number>();
    for (const item of items) quantities.set(item.sku, (quantities.get(item.sku) || 0) + item.quantity);
    persist(
      linesRef.current.flatMap((line) => {
        const remaining = line.quantity - (quantities.get(line.sku) || 0);
        return remaining > 0 ? [{ ...line, quantity: remaining }] : [];
      }),
    );
  };
  return (
    <ShoppingContext.Provider
      value={{
        customer,
        authStatus,
        authMessage,
        lines,
        selectedLines,
        cartLoading,
        availability,
        stockError,
        taxRate,
        refreshStock: () => setStockVersion(version => version + 1),
        notice,
        count: lines.reduce((sum, item) => sum + item.quantity, 0),
        refreshSession,
        add,
        update,
        remove,
        clear,
        select,
        selectAll,
        deselectAll,
        completeOrder,
        refreshCart,
        setNotice,
      }}
    >
      {children}
      {notice && (
        <div role="status" className={styles.notice}>
          <span>{notice}</span>
          {authStatus === "guest" && (
            <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`}>
              Đăng nhập
            </Link>
          )}
          <button
            type="button"
            aria-label="Đóng thông báo giỏ hàng"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </ShoppingContext.Provider>
  );
}
export function useShopping() {
  const context = useContext(ShoppingContext);
  if (!context) throw new Error("ShoppingProvider missing");
  return context;
}
export function CustomerGate({ children }: { children: ReactNode }) {
  const shop = useShopping();
  if (shop.authStatus === "authenticated") return children;
  return (
    <div className={styles.gate} role="status">
      <p>
        {shop.authStatus === "loading"
          ? "Đang xác minh tài khoản…"
          : shop.authStatus === "guest"
            ? "Vui lòng đăng nhập để tiếp tục."
            : shop.authMessage}
      </p>
      {shop.authStatus === "guest" ? (
        <Link href="/auth/login">Đăng nhập</Link>
      ) : (
        <button
          type="button"
          onClick={() => void shop.refreshSession()}
          disabled={shop.authStatus === "loading"}
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
