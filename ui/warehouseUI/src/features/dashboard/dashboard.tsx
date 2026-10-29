"use client";

import BackendDataView from "@/src/components/backend-data-view";
import Link from "next/link";

export default function Dashboard() {
  return <><div className="page-heading"><div><h1>Tổng quan kho</h1><p>Dữ liệu được giới hạn theo kho làm việc của tài khoản.</p></div></div><div className="quick-actions"><Link className="button primary" href="/receipts/new">+ Tạo phiếu nhập</Link><Link className="button" href="/receipts">Phiếu nhập</Link><Link className="button" href="/history">Lịch sử kho</Link><Link className="button" href="/products">Sản phẩm</Link></div><BackendDataView resource="inventory" /></>;
}
