"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Pencil, XCircle } from "lucide-react";
import { cancelDispatchDraft, confirmDispatch, getDispatchDraft, getDispatches } from "@/src/lib/warehouse-api";

export default function DispatchDetailView({ id }: { id: string }) {
  const dispatchId = Number(id);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDispatchDraft>> | null>(null);
  const [legacy, setLegacy] = useState<Awaited<ReturnType<typeof getDispatches>>[number] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setError("");
      if (Number.isInteger(dispatchId)) setData(await getDispatchDraft(dispatchId));
      else setLegacy((await getDispatches()).find(item => item.id === id || item.order === id) ?? null);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể tải phiếu xuất."); }
  }
  useEffect(() => { void load(); }, [dispatchId]);

  async function run(action: "confirm" | "cancel") {
    if (action === "cancel" && !window.confirm("Hủy phiếu xuất nháp này?")) return;
    try { setBusy(true); setError(""); if (action === "confirm") await confirmDispatch(dispatchId); else await cancelDispatchDraft(dispatchId); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể cập nhật phiếu xuất."); }
    finally { setBusy(false); }
  }

  if (error && !data) return <Empty message={error} />;
  if (!data && !legacy) return <div className="auth-loading">Đang tải chi tiết phiếu xuất…</div>;
  if (!data && legacy) return <LegacyDispatchDetail row={legacy} />;
  const detail = data;
  if (!detail) return null;
  const draft = detail.dispatch;
  const isDraft = draft.trang_thai === "NHAP" || draft.trang_thai === "Nháp";
  const status = draft.trang_thai === "NHAP" ? "Nháp" : draft.trang_thai === "HUY" ? "Đã hủy" : draft.trang_thai === "DA_XUAT" ? "Đã xuất" : draft.trang_thai;

  return <>
    <div className="page-heading"><div><Link className="back-link" href="/dispatches"><ArrowLeft size={14}/> Phiếu xuất</Link><h1>Chi tiết {draft.ma_phieu_xuat}</h1></div><div className="detail-actions"><Link className="button" href="/dispatches">Quay lại</Link>{isDraft && <Link className="button" href={`/dispatches/${dispatchId}/edit`}><Pencil size={14}/> Sửa</Link>}{isDraft && <button className="button primary" disabled={busy} onClick={() => void run("confirm")}><CheckCircle2 size={14}/> Xác nhận xuất</button>}</div></div>
    <section className="form-panel"><div className="form-panel-head"><h2>Thông tin phiếu xuất</h2><p>Phiếu <strong>{draft.ma_phieu_xuat}</strong> · Đơn hàng <strong>{draft.ma_donhang}</strong></p></div>
      <div className="detail-grid"><div className="detail-field"><span>Trạng thái</span><strong>{status}</strong></div><div className="detail-field"><span>Kho xuất</span><strong>Kho #{draft.ma_kho_xuat}</strong></div><div className="detail-field wide"><span>Ghi chú</span><strong>{draft.ghi_chu || "—"}</strong></div></div>
      <div className="table-wrap"><table><thead><tr><th>MÃ SẢN PHẨM</th><th>SKU</th><th>SẢN PHẨM</th><th>ĐƠN VỊ</th><th>ĐƠN GIÁ</th><th>SỐ LƯỢNG</th><th>THÀNH TIỀN</th></tr></thead><tbody>{detail.lines.map((line, index) => { const price = Number(line.don_gia ?? 0); return <tr key={`${line.sku}-${index}`}><td>{line.ma_sp ?? "—"}</td><td>{line.sku}</td><td>{line.ten_sp ?? "—"}</td><td>{line.don_vi ?? "—"}</td><td>{price.toLocaleString("vi-VN")} ₫</td><td>{line.so_luong}</td><td>{(price * line.so_luong).toLocaleString("vi-VN")} ₫</td></tr>; })}</tbody></table></div>
      {error && <div className="module-note form-error">{error}</div>}
      {isDraft && <div className="form-actions"><button className="button danger" disabled={busy} onClick={() => void run("cancel")}><XCircle size={14}/> Hủy phiếu nháp</button></div>}
    </section>
  </>;
}

function LegacyDispatchDetail({ row }: { row: Awaited<ReturnType<typeof getDispatches>>[number] }) {
  return <><div className="page-heading"><div><Link className="back-link" href="/dispatches"><ArrowLeft size={14}/> Phiếu xuất</Link><h1>Chi tiết {row.id}</h1></div></div><section className="form-panel"><div className="form-panel-head"><h2>Thông tin phiếu xuất</h2><p>Đơn hàng <strong>{row.order}</strong></p></div><div className="detail-grid"><div className="detail-field"><span>Trạng thái</span><strong>{row.status}</strong></div><div className="detail-field"><span>Người nhận</span><strong>{row.receiver}</strong></div><div className="detail-field"><span>Kho</span><strong>{row.warehouse}</strong></div><div className="detail-field"><span>Ngày tạo</span><strong>{row.created}</strong></div></div><div className="module-note">Phiếu xuất chi tiết chưa được tạo trong cơ sở dữ liệu. Hãy áp dụng migration workflow phiếu xuất để có thể sửa và xác nhận phiếu.</div></section></>;
}

function Empty({ message }: { message: string }) { return <div className="not-found"><h1>Không thể tải phiếu xuất</h1><p>{message}</p><Link href="/dispatches" className="button">Quay lại danh sách</Link></div>; }
