"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { Logo } from "@/src/components/admin/ui";

export type StaffRole = "ADMIN" | "THU_KHO";

type LoginResult = {
  role: StaffRole;
  username: string;
};

type DemoAccount = {
  username: string;
  password: string;
  role: StaffRole;
};

const adminAccount: DemoAccount = {
  username: "admin.thinh",
  password: "password123",
  role: "ADMIN",
};
const warehouseAccount: DemoAccount = {
  username: "phong.kho",
  password: "password123",
  role: "THU_KHO",
};

const demoAccounts: Record<string, DemoAccount> = {
  "admin.thinh": adminAccount,
  "thinh@phub.vn": adminAccount,
  "phong.kho": warehouseAccount,
  "phong@phub.vn": warehouseAccount,
};

export function LoginView({
  onLogin,
}: {
  onLogin: (result: LoginResult) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget as HTMLFormElement);
    const username = String(form.get("username") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const account = demoAccounts[username];

    if (!account || account.password !== password) {
      setError("Tài khoản hoặc mật khẩu không đúng.");
      return;
    }

    setError("");
    setLoading(true);
    window.setTimeout(
      () => onLogin({ role: account.role, username: account.username }),
      500,
    );
  };
  return (
    <main className="login">
      <header>
        <Logo />
        <span>
          <i /> Hệ thống đang hoạt động
        </span>
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
            trên mọi chi nhánh.
          </p>
          <aside>
            <b>
              03<small>Chi nhánh</small>
            </b>
            <i />
            <b>
              248<small>Sản phẩm</small>
            </b>
            <i />
            <b>
              99.9%<small>Đồng bộ</small>
            </b>
          </aside>
        </section>
        <form className="login-card" onSubmit={submit}>
          <div className="welcome">
            <b>P</b>
            <p>
              <strong>Chào mừng trở lại</strong>
              <small>Đăng nhập vào trang quản trị PHUB</small>
            </p>
          </div>
          <label>
            Email hoặc tên tài khoản
            <input
              name="username"
              defaultValue="admin.thinh"
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
                defaultValue="password123"
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
          <div className="demo-accounts">
            <strong>Tài khoản dùng thử</strong>
            <span>Quản trị viên: admin.thinh / password123</span>
            <span>Nhân viên kho: phong.kho / password123</span>
          </div>
        </form>
      </div>
      <footer>
        © 2026 PHUB Technology{" "}
        <span>Điều khoản sử dụng · Chính sách bảo mật</span>
      </footer>
    </main>
  );
}
