"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthRequestError, getSession, logoutSession, type SessionUser } from "../../../../shared/auth-client";
import { ADMIN_SESSION_EXPIRED, advanceSessionEpoch, getSessionEpoch } from "@/src/lib/admin-fetch";

const REVALIDATE_AFTER_MS = 60_000;
type AuthState = {
  user: SessionUser | null | undefined;
  checking: boolean;
  error: string;
  checkSession: (reset?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined: not yet verified; null: signed out. Never persist a trusted role in localStorage.
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const userRef = useRef<SessionUser | null | undefined>(undefined);
  const lastAttempt = useRef(0);
  const flight = useRef<Promise<void> | null>(null);
  const controller = useRef<AbortController | null>(null);

  const invalidate = useCallback(() => {
    advanceSessionEpoch();
    controller.current?.abort(); controller.current = null; flight.current = null;
    userRef.current = null; setUser(null); setError(""); setChecking(false);
  }, []);

  const checkSession = useCallback((reset = false): Promise<void> => {
    if (!reset && flight.current) return flight.current;
    if (reset) {
      advanceSessionEpoch();
      controller.current?.abort();
      userRef.current = undefined; setUser(undefined);
    }
    const epoch = getSessionEpoch();
    const request = new AbortController();
    controller.current = request;
    lastAttempt.current = Date.now();
    setChecking(true); setError("");
    const pending = getSession(request.signal).then(nextUser => {
      if (request.signal.aborted || epoch !== getSessionEpoch()) return;
      const previous = userRef.current;
      if (previous && (previous.account_id !== nextUser.account_id || previous.role !== nextUser.role || previous.warehouse_id !== nextUser.warehouse_id)) {
        advanceSessionEpoch();
      }
      userRef.current = nextUser; setUser(nextUser);
      if (nextUser.role !== "ADMIN") {
        window.location.replace(nextUser.role === "THU_KHO"
          ? process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002"
          : process.env.NEXT_PUBLIC_CUSTOMER_URL ?? "http://localhost:3001");
      }
    }).catch(reason => {
      if (request.signal.aborted || epoch !== getSessionEpoch()) return;
      if (reason instanceof AuthRequestError && (reason.status === 401 || reason.status === 403)) {
        invalidate(); return;
      }
      setError("Chưa kiểm tra được phiên đăng nhập. API tạm thời không khả dụng; phiên chưa bị xóa.");
    }).finally(() => {
      if (controller.current !== request) return;
      controller.current = null; flight.current = null; setChecking(false);
    });
    flight.current = pending;
    return pending;
  }, [invalidate]);

  const logout = useCallback(async () => {
    await logoutSession();
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    void checkSession();
    const revalidateIfStale = () => {
      if (document.visibilityState === "visible" && userRef.current !== null && Date.now() - lastAttempt.current >= REVALIDATE_AFTER_MS) {
        void checkSession();
      }
    };
    const profileUpdated = () => { void checkSession(); };
    const expired = (event: Event) => {
      if ((event as CustomEvent<number>).detail === getSessionEpoch()) invalidate();
    };
    window.addEventListener("focus", revalidateIfStale);
    document.addEventListener("visibilitychange", revalidateIfStale);
    window.addEventListener("phub-account-updated", profileUpdated);
    window.addEventListener(ADMIN_SESSION_EXPIRED, expired);
    return () => {
      controller.current?.abort(); controller.current = null; flight.current = null;
      window.removeEventListener("focus", revalidateIfStale);
      document.removeEventListener("visibilitychange", revalidateIfStale);
      window.removeEventListener("phub-account-updated", profileUpdated);
      window.removeEventListener(ADMIN_SESSION_EXPIRED, expired);
    };
  }, [checkSession, invalidate]);

  // Gate outside the page Suspense boundary. A fast /me must not make a still-
  // dehydrated page render a shell against server HTML containing a session gate.
  const needsVerification = user === undefined || (user !== null && user.role !== "ADMIN");
  return <AuthContext.Provider value={{ user, checking, error, checkSession, logout }}>
    {needsVerification ? <main className="session-gate" aria-busy={checking}>
      <h1>PHUB Admin</h1>
      {checking ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : <>
        <p role="alert">{error}</p>
        <button type="button" className="btn primary" onClick={() => { void checkSession(); }}>Thử kết nối lại</button>
      </>}
    </main> : children}
  </AuthContext.Provider>;
}

export function useAdminAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Admin cần AuthProvider.");
  return auth;
}
