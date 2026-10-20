"use client";

import BackendDataView from "@/src/components/backend-data-view";

export default function Dashboard() {
  return <><div className="page-heading"><div><h1>Tổng quan kho</h1><p>Dữ liệu được giới hạn theo kho làm việc của tài khoản.</p></div></div><div className="quick-actions"><a className="button" href="/receipts">Phiếu nhập</a><a className="button" href="/transfers">Chuyển kho</a><a className="button" href="/products">Sản phẩm</a></div><BackendDataView resource="inventory" /></>;
}
