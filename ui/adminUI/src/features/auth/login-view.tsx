"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { Logo } from "@/src/components/admin/ui";

export type StaffRole = "ADMIN" | "THU_KHO";

type LoginResult = {
  role: StaffRole;
  username: string;
};

export function LoginView({
  onLogin,
}: {
  onLogin: (result: LoginResult) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  useEffect(() => {
    setPasswordChanged(new URLSearchParams(window.location.search).get("passwordChanged") === "1");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget as HTMLFormElement);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/backend/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Thông tin đăng nhập không hợp lệ.");
      if (result.role === "KHACH_HANG") {
        window.location.assign(process.env.NEXT_PUBLIC_CUSTOMER_URL ?? "http://localhost:3001");
        return;
      }
      onLogin({ role: result.role, username: result.username });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kết nối được backend.");
    } finally { setLoading(false); }
  };
  return (
    <main className="login">
      <header>
        <Logo />
        <span>Cổng đăng nhập nội bộ</span>
      </header>
      <div className="login-grid">
        <section className="login-copy">
          <div>
            <Sparkles /> TRUNG TÂM VẬN HÀNH
          </div>
          <h1>
            Quản lý cửa hàng
            <br />
            gọn gàng hơn.
          </h1>
          <p>
            Một không gian duy nhất để theo dõi sản phẩm, đơn hàng và tồn kho
            theo kho và vai trò được phân công.
          </p>
        </section>
        <form className="login-card" onSubmit={submit}>
          <div className="welcome">
            <b>P</b>
            <p>
              <strong>Chào mừng trở lại</strong>
              <small>Đăng nhập vào trang quản trị PHUB</small>
            </p>
          </div>
          {passwordChanged && <p role="status">Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.</p>}
          <label>
            Email hoặc tên tài khoản
            <input
              name="username"
              autoComplete="username"
              required
              onChange={() => setError("")}
            />
          </label>
          <label>
            Mật khẩu
            <div className="password">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                onChange={() => setError("")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <div className="login-options">
            <label>
              <input type="checkbox" defaultChecked /> Ghi nhớ đăng nhập
            </label>
            <button type="button">Quên mật khẩu?</button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="submit" disabled={loading}>
            {loading ? (
              "Đang đăng nhập..."
            ) : (
              <>
                Đăng nhập <ArrowRight />
              </>
            )}
          </button>
          <p className="secure">
            <LockKeyhole /> Phiên đăng nhập được mã hóa và bảo mật
          </p>
          <p className="demo-accounts">Đăng nhập bằng tài khoản đã được tạo trong Supabase. Không còn tài khoản demo cố định.</p>
        </form>
      </div>
      <footer>
        © 2026 PHUB Technology{" "}
        <span>Điều khoản sử dụng · Chính sách bảo mật</span>
      </footer>
    </main>
  );
}
