"use client";

import Link from "next/link";
import {
  CircleAlert,
  CircleDollarSign,
  MoreHorizontal,
  Package,
  ShoppingBag,
} from "lucide-react";
import type { ModuleKey } from "@/src/types/admin";
import { Badge } from "@/src/components/admin/ui";
import { modules } from "@/src/data/admin-data";

const metrics: Array<{
  label: string;
  value: string;
  note: string;
  target: ModuleKey;
  icon: React.ElementType;
}> = [
  {
    label: "Doanh thu hôm nay",
    value: "128,4 tr",
    note: "↑ 12,5% so với hôm qua",
    target: "billing",
    icon: CircleDollarSign,
  },
  {
    label: "Đơn hàng mới",
    value: "48",
    note: "↑ 8,2% so với hôm qua",
    target: "orders",
    icon: ShoppingBag,
  },
  {
    label: "Sản phẩm đã bán",
    value: "76",
    note: "↓ 3,1% so với hôm qua",
    target: "products",
    icon: Package,
  },
  {
    label: "Sắp hết hàng",
    value: "12",
    note: "Cần nhập thêm hàng",
    target: "inventory",
    icon: CircleAlert,
  },
];

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (key: ModuleKey) => void;
}) {
  const recentOrders = modules.orders?.rows.slice(0, 4) ?? [];
  return (
    <>
      <div className="metrics">
        {metrics.map(({ label, value, note, target, icon: Icon }) => (
          <article className="metric" key={label}>
            <button className="metric-link" onClick={() => onNavigate(target)}>
              <Icon />
            </button>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </div>
      <div className="dash-grid">
        <section className="panel chart-panel">
          <PanelHeader
            title="Doanh thu"
            description="Hiệu suất bán hàng 7 ngày gần nhất"
          />
          <div className="chart">
            <div className="y">
              <span>40tr</span>
              <span>30tr</span>
              <span>20tr</span>
              <span>10tr</span>
              <span>0</span>
            </div>
            <div className="plot">
              <i />
              <i />
              <i />
              <i />
              <i />
              <svg viewBox="0 0 700 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#14a800" stopOpacity=".24" />
                    <stop offset="1" stopColor="#14a800" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="area"
                  d="M0,175 C70,158 85,120 145,137 C200,155 215,92 280,105 C348,118 355,55 425,72 C480,84 510,40 565,58 C620,76 650,21 700,30 L700,220 L0,220Z"
                />
                <path
                  className="line"
                  d="M0,175 C70,158 85,120 145,137 C200,155 215,92 280,105 C348,118 355,55 425,72 C480,84 510,40 565,58 C620,76 650,21 700,30"
                />
              </svg>
              <div className="x">
                {[
                  "19/09",
                  "20/09",
                  "21/09",
                  "22/09",
                  "23/09",
                  "24/09",
                  "25/09",
                ].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-total">
            Tổng doanh thu <b>682.450.000đ</b>
            <em>+9,4%</em>
          </div>
        </section>
        <section className="panel status-panel">
          <PanelHeader
            title="Trạng thái đơn hàng"
            description="Trong tháng 09/2026"
          />
          <div className="donut-row">
            <div className="donut">
              <p>
                <b>386</b>
                <small>đơn hàng</small>
              </p>
            </div>
            <ul>
              <li>
                <i />
                Hoàn thành <b>248</b>
              </li>
              <li>
                <i />
                Đang xử lý <b>96</b>
              </li>
              <li>
                <i />
                Đã hủy <b>42</b>
              </li>
            </ul>
          </div>
          <button className="panel-link" onClick={() => onNavigate("orders")}>
            Xem tất cả đơn hàng →
          </button>
        </section>
      </div>
      <section className="panel recent">
        <PanelHeader
          title="Đơn hàng gần đây"
          description="Cập nhật theo thời gian thực"
        />
        <table>
          <thead>
            <tr>
              <th>MÃ ĐƠN</th>
              <th>KHÁCH HÀNG</th>
              <th>KÊNH BÁN</th>
              <th>TỔNG TIỀN</th>
              <th>TRẠNG THÁI</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link className="link" href={`/orders/${order.id}`}>
                    #{order.id}
                  </Link>
                </td>
                <td>{String(order.customer)}</td>
                <td>{String(order.channel)}</td>
                <td>
                  <b>{String(order.total)}</b>
                </td>
                <td>
                  <Badge>{String(order.status)}</Badge>
                </td>
                <td>
                  <MoreHorizontal />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function PanelHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="panel-head">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button>
        <MoreHorizontal />
      </button>
    </header>
  );
}
