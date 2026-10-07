import Image from "next/image";
import styles from "./Home.module.css";

export function FinancingStrip({ onLearnMore }: { onLearnMore: () => void }) {
  return <section className={styles.zipStrip} aria-label="Thông tin thanh toán Zip">
    <span className={styles.zipLogo} aria-label="Zip">
      <Image src="/images/figma-mobile/home-imgLogoIconColourPrimary.svg" alt="" width={14.0427} height={12.9123} />
      <Image src="/images/figma-mobile/home-imgLogoItemZipTextPrimary.svg" alt="" width={19.549} height={12.939} />
    </span>
    <p><strong>Sở hữu ngay</strong>, trả góp đến 6 tháng không lãi suất</p>
    <button onClick={onLearnMore}>Tìm hiểu thêm</button>
  </section>;
}
