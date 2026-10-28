import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, KeyRound, MapPin, UserRound } from "lucide-react";
import type { CustomerDetail } from "../../lib/customer-profile";
import styles from "./customer-detail.module.css";

type Props = {
  data: CustomerDetail; age: number | null;
  formatDate: (value: string | null, dateOnly?: boolean) => string;
};
const statuses: Record<number, string> = { 0: "Đã ẩn", 1: "Hoạt động", 2: "Tạm khóa" };

export function CustomerProfileView({ data: { profile, account }, age, formatDate }: Props) {
  return <div className={styles.profile}>
    <header className={styles.header}>
      <span className={styles.avatar}><UserRound size={30} aria-hidden="true" /></span>
      <div className={styles.identity}>
        <p>Hồ sơ khách hàng</p>
        <h1>{profile.ten_kh}</h1>
        <div className={`live-field ${styles.identifier}`}><span>Mã khách hàng</span><span>{profile.ma_kh}</span></div>
      </div>
    </header>

    <div className={styles.grid}>
      <div className={styles.column}>
        <section className={styles.card} aria-labelledby="customer-personal-title">
          <h2 id="customer-personal-title"><UserRound size={20} aria-hidden="true" />Thông tin khách hàng</h2>
          <dl className={`${styles.fields} ${styles.personalFields}`}>
            <div className={`live-field ${styles.field}`}><dt>Số điện thoại</dt><dd>{profile.sdt || <span className={styles.missing}>Chưa có thông tin</span>}</dd></div>
            <div className={`live-field ${styles.field}`}><dt>Ngày sinh</dt><dd>{profile.ngay_sinh ? formatDate(profile.ngay_sinh, true) : <span className={styles.missing}>Chưa có thông tin</span>}</dd></div>
            <div className={`live-field ${styles.field}`}><dt>Tuổi</dt><dd>{age === null ? <span className={styles.missing}>Chưa có thông tin</span> : `${age} tuổi`}</dd></div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="customer-address-title">
          <h2 id="customer-address-title"><MapPin size={20} aria-hidden="true" />Địa chỉ mặc định</h2>
          <dl className={styles.fields}>
            <div className={`live-field ${styles.field} ${styles.address}`}><dt>Địa chỉ chi tiết</dt><dd>{profile.dia_chi_chi_tiet_md || <span className={styles.missing}>Chưa có địa chỉ mặc định</span>}</dd></div>
            <div className={`live-field ${styles.field}`}><dt>Tỉnh / thành phố</dt><dd>{profile.tinh_thanh_md || "—"}</dd></div>
            <div className={`live-field ${styles.field}`}><dt>Xã / phường</dt><dd>{profile.xa_phuong_md || "—"}</dd></div>
          </dl>
        </section>
      </div>

      <div className={styles.column}>
        <section className={styles.card} aria-labelledby="customer-account-title">
          <div className={styles.cardHeading}>
            <h2 id="customer-account-title"><KeyRound size={20} aria-hidden="true" />Tài khoản liên kết</h2>
            {account && <span className={`${styles.badge} ${account.trang_thai === 1 ? styles.active : account.trang_thai === 2 ? styles.locked : styles.inactive}`}>
              <span aria-hidden="true" />{statuses[account.trang_thai] ?? "Không xác định"}
            </span>}
          </div>
          {account ? <>
            <dl className={styles.fields}>
              <div className={`live-field ${styles.field}`}><dt>Tên đăng nhập</dt><dd>{account.ten_tai_khoan}</dd></div>
              <div className={`live-field ${styles.field} ${styles.wide}`}><dt>Email</dt><dd>{account.email || <span className={styles.missing}>Chưa có thông tin</span>}</dd></div>
            </dl>
            <Link className={styles.accountLink} href={`/accounts/${encodeURIComponent(account.ma_tk)}`}>
              <div><span>Mã tài khoản</span><strong>{account.ma_tk}</strong></div>
              <span className={styles.accountAction}>Xem tài khoản <ArrowUpRight size={17} aria-hidden="true" /></span>
            </Link>
          </> : <div className={styles.emptyAccount}><KeyRound size={26} aria-hidden="true" /><p>Khách hàng chưa có tài khoản liên kết.</p></div>}
        </section>

        <section className={styles.card} aria-labelledby="customer-record-title">
          <h2 id="customer-record-title"><CalendarDays size={20} aria-hidden="true" />Thông tin hồ sơ</h2>
          <dl className={styles.metadata}>
            <div className={`live-field ${styles.metaField}`}><dt><CalendarDays size={15} aria-hidden="true" />Ngày tạo hồ sơ</dt><dd>{formatDate(profile.ngay_tao)}</dd></div>
            <div className={`live-field ${styles.metaField}`}><dt><Clock3 size={15} aria-hidden="true" />Cập nhật lần cuối</dt><dd>{formatDate(profile.cap_nhat_luc)}</dd></div>
            <div className={`live-field ${styles.metaField}`}><dt>Trạng thái hồ sơ</dt><dd>{profile.luu_tru_luc ? "Đã lưu trữ" : "Chưa lưu trữ"}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  </div>;
}
