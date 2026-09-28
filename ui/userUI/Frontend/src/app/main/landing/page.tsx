import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ProductTile } from "@/components/storefront/ProductTile";
import { brandLogos, storeCategories, storeProducts } from "@/data/storefront-data";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "PHUB Store | PC và linh kiện chính hãng",
  description: "Mua PC nguyên bộ và linh kiện máy tính chính hãng tại PHUB Store.",
};

const benefits = [
  { icon: "01", title: "Hàng chính hãng", detail: "Nguồn gốc rõ ràng, bảo hành đầy đủ" },
  { icon: "02", title: "Giao hàng toàn quốc", detail: "Đóng gói an toàn, theo dõi đơn dễ dàng" },
  { icon: "03", title: "Hỗ trợ kỹ thuật", detail: "Tư vấn cấu hình đúng nhu cầu sử dụng" },
  { icon: "04", title: "Đổi trả minh bạch", detail: "Chính sách rõ ràng trong từng đơn hàng" },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>PHUB PERFORMANCE WEEK</span>
          <h1>Cấu hình mạnh.<br />Giá đúng ngu cầu.</h1>
          <p>PC nguyên bộ và linh kiện chính hãng được tuyển chọn cho học tập, làm việc, sáng tạo và gaming.</p>
          <div className={styles.heroActions}>
            <Link href="/main/product" className={styles.primaryButton}>Mua sắm ngay <span>→</span></Link>
            <Link href="/main/product?category=pc" className={styles.secondaryButton}>Xem PC lắp sẵn</Link>
          </div>
          <div className={styles.heroStats}>
            <div><strong>2.500+</strong><span>Sản phẩm</span></div>
            <div><strong>36 tháng</strong><span>Bảo hành tối đa</span></div>
            <div><strong>4.9/5</strong><span>Khách hàng đánh giá</span></div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroHalo} />
          <span className={styles.saleFlag}>Ưu đãi đến 15%</span>
          <Image src="/images/about/quality.webp" alt="PC gaming PHUB với hệ thống tản nhiệt RGB" fill sizes="(max-width: 900px) 88vw, 44vw" loading="eager" style={{ objectFit: "contain", padding: "60px 45px 80px" }} />
          <div className={styles.heroProductInfo}><span>PHUB CREATOR RTX</span><strong>Từ 24.380.000đ</strong></div>
        </div>
      </section>

      <section className={styles.benefitStrip} aria-label="Quyền lợi mua hàng">
        {benefits.map((benefit) => <article key={benefit.icon}><span>{benefit.icon}</span><div><strong>{benefit.title}</strong><small>{benefit.detail}</small></div></article>)}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><span>Khám phá nhanh</span><h2>Mua sắm theo danh mục</h2></div><Link href="/main/product">Xem tất cả <span>→</span></Link></div>
        <div className={styles.categoryGrid}>
          {storeCategories.map((category) => (
            <Link key={category.id} href={`/main/product?category=${category.id}`} className={styles.categoryCard} style={{ "--category-accent": category.accent } as CSSProperties}>
              <span className={styles.categoryVisual}>{category.visual}</span>
              <div><h3>{category.name}</h3><p>{category.description}</p></div>
              <span className={styles.categoryArrow}>↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><span>Được chọn nhiều nhất</span><h2>Sản phẩm nổi bật</h2></div><Link href="/main/product">Xem toàn bộ sản phẩm <span>→</span></Link></div>
        <div className={styles.productGrid}>{storeProducts.slice(0, 4).map((product) => <ProductTile key={product.id} product={product} />)}</div>
      </section>

      <section className={styles.builderBanner}>
        <div className={styles.builderCopy}><span>BUILD YOUR PC</span><h2>Chưa biết chọn cấu hình nào?</h2><p>Cho chúng tôi biết ngân sách và nhu cầu. PHUB sẽ đề xuất một bộ máy cân bằng, dễ nâng cấp và đúng mục đích.</p><Link href="/main/product?category=pc">Khám phá cấu hình đề xuất <span>→</span></Link></div>
        <div className={styles.builderSpecs}>
          <article><span>CPU</span><strong>Ryzen 5</strong><small>Hiệu năng đa nhiệm</small></article>
          <article><span>GPU</span><strong>RTX 4060</strong><small>Gaming Full HD</small></article>
          <article><span>RAM</span><strong>32GB</strong><small>Sẵn sàng nâng cấp</small></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><span>Nâng cấp góc máy</span><h2>Linh kiện và phụ kiện mới</h2></div><Link href="/main/product?category=component">Xem linh kiện <span>→</span></Link></div>
        <div className={styles.productGrid}>{storeProducts.slice(4).map((product) => <ProductTile key={product.id} product={product} />)}</div>
      </section>

      <section className={styles.brandSection}>
        <div><span>ĐỐI TÁC CHÍNH HÃNG</span><h2>Thương hiệu công nghệ hàng đầu</h2></div>
        <div className={styles.brandGrid}>{brandLogos.map((brand) => <div key={brand.name} className={styles.brandCard}><Image src={brand.src} alt={brand.name} width={130} height={55} sizes="130px" /></div>)}</div>
      </section>

      <section className={styles.finalCta}>
        <div><span>PHUB CARE</span><h2>Mua máy dễ hơn khi có người hiểu bạn.</h2></div>
        <p>Đội ngũ kỹ thuật hỗ trợ từ lúc chọn cấu hình đến cài đặt và nâng cấp sau này.</p>
        <Link href="#footer-contact">Liên hệ tư vấn <span>→</span></Link>
      </section>
    </div>
  );
}
