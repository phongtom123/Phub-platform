"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/backend/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: String(form.get("account") ?? "").trim(), password: String(form.get("password") ?? "") }) });
      const account = await response.json();
      if (!response.ok) throw new Error(typeof account.detail === "string" ? account.detail : "Thông tin đăng nhập không hợp lệ.");
      if (account.role === "ADMIN") { window.location.assign(process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000"); return; }
      if (account.role === "THU_KHO") { window.location.assign(process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002"); return; }
      router.push("/main/landing"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Không kết nối được backend."); }
    finally { setLoading(false); }
  };

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
            name="account"
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

        <div className="mt-5 flex items-center justify-between gap-4 text-sm">
          <label className="flex items-center gap-2 text-zinc-600">
            <input type="checkbox" defaultChecked className="size-4 accent-green-700" />
            Ghi nhớ đăng nhập
          </label>
          <button type="button" className="font-medium text-green-700 hover:underline">
            Quên mật khẩu?
          </button>
        </div>

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
