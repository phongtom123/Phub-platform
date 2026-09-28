"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { Logo } from "@/src/components/admin/ui";

export function LoginView({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(onLogin, 500);
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
            <input defaultValue="admin.thinh" />
          </label>
          <label>
            Mật khẩu
            <div className="password">
              <input
                type={showPassword ? "text" : "password"}
                defaultValue="password123"
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
          <button className="submit">
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
        </form>
      </div>
      <footer>
        © 2026 PHUB Technology{" "}
        <span>Điều khoản sử dụng · Chính sách bảo mật</span>
      </footer>
    </main>
  );
}
