"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerCustomer } from "../../../../../../shared/auth-client";

const fieldClass = "mt-2 h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await registerCustomer({
        name: String(form.get("name") ?? ""),
        username: String(form.get("username") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        password,
      });
      router.push("/main/landing");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo tài khoản lúc này.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto grid min-h-[72vh] w-full max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="max-w-xl">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">PHUB Store</span>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl">
          Tạo tài khoản mua sắm của bạn
        </h1>
        <p className="mt-5 text-base leading-7 text-zinc-600">
          Đăng ký để theo dõi đơn hàng, lưu thông tin giao nhận và thanh toán thuận tiện hơn.
          Tài khoản được đăng nhập ngay sau khi tạo thành công.
        </p>
        <ul className="mt-7 space-y-3 text-sm text-zinc-600">
          <li className="flex gap-3"><span className="font-bold text-green-700">✓</span> Đăng ký và đăng nhập dùng chung API xác thực của hệ thống.</li>
          <li className="flex gap-3"><span className="font-bold text-green-700">✓</span> Phiên đăng nhập nằm trong cookie HttpOnly.</li>
          <li className="flex gap-3"><span className="font-bold text-green-700">✓</span> Không chia sẻ khóa Supabase cho trình duyệt.</li>
        </ul>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-[0_18px_55px_rgba(0,0,0,0.08)] sm:p-9">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">Tài khoản khách hàng</span>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Đăng ký</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Điền thông tin thật để dùng cho hồ sơ và đơn hàng của bạn.</p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Họ và tên
            <input required name="name" autoComplete="name" minLength={2} maxLength={200} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Tên tài khoản
            <input required name="username" autoComplete="username" minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" title="Chỉ dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang." className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Số điện thoại <span className="font-normal text-zinc-400">(không bắt buộc)</span>
            <input name="phone" type="tel" autoComplete="tel" maxLength={20} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Email
            <input required name="email" type="email" autoComplete="email" maxLength={254} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Mật khẩu
            <input required name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Nhập lại mật khẩu
            <input required name="password_confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} className={fieldClass} />
          </label>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-zinc-600">
          <input required name="terms" type="checkbox" className="mt-1 size-4 shrink-0 accent-green-700" />
          <span>Tôi đồng ý với điều khoản sử dụng và xác nhận thông tin đăng ký là chính xác.</span>
        </label>
        {error && <p role="alert" aria-live="polite" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="mt-7 h-12 w-full rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60">
          {loading ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </button>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Đã có tài khoản?{" "}<Link href="/auth/login" className="font-semibold text-green-700 hover:underline">Đăng nhập</Link>
        </p>
      </form>
    </section>
  );
}
