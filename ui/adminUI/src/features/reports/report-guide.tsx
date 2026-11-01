import { ChevronDown, Info } from "lucide-react";
import styles from "./reports.module.css";

export function ReportGuide() {
  return <section className={styles.guide} aria-label="Công thức báo cáo"><details>
    <summary><span className={styles.guideIcon}><Info size={18} /></span><span><strong>Cách đọc và tính các chỉ số</strong><small>Doanh thu, giá vốn, lợi nhuận và các lưu ý về dữ liệu</small></span><ChevronDown className={styles.guideChevron} size={18} /></summary>
    <div className={styles.guideBody}>
      <div className={styles.formulaList}>
        <article><h3>Doanh thu sau giảm giá, chưa thuế</h3><p className={styles.equation}>Σ (Số lượng × đơn giá − giảm giá − voucher)</p><p>Chỉ ghi nhận đơn đã hoàn thành trong kỳ, theo giờ Việt Nam. Thuế tách riêng. Hoàn tiền chưa phân bổ không được tự trừ vào doanh thu chưa thuế.</p></article>
        <article><h3>Giá vốn hàng đã bán</h3><p className={styles.equation}>Σ (Số lượng xuất × giá vốn bình quân lúc xuất)</p><p>Dùng lịch sử nhập, xuất và điều chỉnh theo thời điểm. Điều chỉnh sau ngày xuất không xóa giá vốn đã xác định của giao dịch trước đó.</p></article>
        <article><h3>Lợi nhuận gộp</h3><p className={styles.equation}>Doanh thu chưa thuế − giá vốn hàng đã bán</p><p>Chưa trừ lương, tiền thuê, quảng cáo và các chi phí vận hành khác; không phải lợi nhuận ròng.</p></article>
        <article><h3>Biên lợi nhuận gộp</h3><p className={styles.equation}>(Lợi nhuận gộp / doanh thu chưa thuế) × 100%</p><p>Doanh thu bằng 0 thì tỷ lệ không xác định. Đây là tỷ lệ trên doanh thu, khác với tỷ lệ cộng lãi trên giá nhập.</p></article>
      </div>
      <div className={styles.method} aria-label="Phương pháp tính giá vốn"><strong>Bình quân gia quyền liên hoàn</strong><p>Sau mỗi lần nhập: giá vốn bình quân = (giá trị tồn trước nhập + giá trị hàng nhập) / tổng số lượng tồn. Khi xuất, lấy giá vốn tại thời điểm xuất; không dùng giá của lần nhập sau. Dữ liệu chưa đủ định giá được hiển thị là “Chưa đủ dữ liệu”, không thay bằng 0.</p></div>
    </div>
  </details></section>;
}
