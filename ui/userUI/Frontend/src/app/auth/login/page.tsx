"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, loginSession } from "../../../../../../shared/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) {
          router.replace("/");
          router.refresh();
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });
    return () => controller.abort();
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setLoading(true); setError("");
    try {
      const account = await loginSession(username, password);
      if (account.role === "ADMIN") { window.location.assign(process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000"); return; }
      if (account.role === "THU_KHO") { window.location.assign(process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002"); return; }
      router.replace("/");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Không kết nối được backend."); }
    finally { setLoading(false); }
  };

  if (checkingSession) {
    return (
      <section className="grid min-h-[68vh] place-items-center px-6" aria-live="polite" aria-busy="true">
        <p className="text-sm text-zinc-500" role="status">Đang kiểm tra phiên đăng nhập…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto grid min-h-[68vh] w-full max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_460px]">
      <div className="max-w-xl">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">
          PHUB Store
        </span>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl">
          Đăng nhập để tiếp tục mua sắm
        </h1>
        <p className="mt-5 text-base leading-7 text-zinc-600">
          Theo dõi đơn hàng, lưu sản phẩm yêu thích và quản lý thông tin giao
          nhận trong một tài khoản duy nhất.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-[0_18px_55px_rgba(0,0,0,0.08)] sm:p-9"
      >
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
            Tài khoản khách hàng
          </span>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Đăng nhập</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Đăng nhập bằng tài khoản khách hàng trong hệ thống PHUB.
          </p>
        </div>

        <label className="mt-7 block text-sm font-medium text-zinc-800">
          Email hoặc tên tài khoản
          <input
            required
            name="username"
            autoComplete="username"
            className="mt-2 h-12 w-full rounded-lg border border-zinc-300 px-4 text-sm text-zinc-950 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100"
          />
        </label>

        <label className="mt-5 block text-sm font-medium text-zinc-800">
          Mật khẩu
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-2 h-12 w-full rounded-lg border border-zinc-300 px-4 text-sm text-zinc-950 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100"
          />
        </label>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Phiên đăng nhập được bảo vệ bằng cookie HttpOnly và tự hết hạn sau 8 giờ.
        </p>

        {error && <p role="alert" className="mt-5 text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-7 h-12 w-full rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Chưa có tài khoản?{" "}
          <Link href="/auth/register" className="font-semibold text-green-700 hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </form>
    </section>
  );
}
