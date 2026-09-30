import Image from "next/image";
import Link from "next/link";
import type { DetailProduct } from "@/data/product-details";
import { ProductDetailActions } from "./ProductDetailActions";
import { desktopProductDetailFacts, desktopProductDetailTabs, type ProductDetailTab } from "./desktopProductDetailData";
import styles from "./detail.module.css";

export function DesktopProductDetail({ product, activeTab }: { product: DetailProduct; activeTab: ProductDetailTab }) {
  const id = product.id;
  const imageSrc = product.imageSrc || "/images/home/desktop-trident.svg";

  return <article className={styles.page}>
    <div className={styles.purchaseBar}><div className={styles.purchaseInner}>
      <nav className={styles.tabs} aria-label="Product information tabs">{desktopProductDetailTabs.map(tab => <Link key={tab.id} className={activeTab === tab.id ? styles.activeTab : undefined} href={`/main/product/${id}?tab=${tab.id}`}>{tab.label}</Link>)}</nav>
      <ProductDetailActions price={3299} />
    </div></div>

    <section className={styles.productHero}>
      <div className={styles.productCopy}><div className={styles.copyInner}>
        <p className={styles.breadcrumb}>Home <span>›</span> Laptops <span>›</span> MSI WS Series</p>
        <h1>MSI MPG Trident 3</h1>
        <a className={styles.reviewLink} href="#features">Be the first to review this product</a>
        {activeTab === "about" && <><p className={styles.summary}>MSI MPG Trident 3 10SC-005AU Intel i7 10700F, 2060 SUPER, 16GB RAM, 512GB SSD, 2TB HDD, Windows 10 Home, Gaming Keyboard and Mouse 3 Years Warranty Gaming Desktop</p><div className={styles.swatches} aria-label="Available colours"><i /><i /><i /></div></>}
        {activeTab === "details" && <ul className={styles.detailList}>{desktopProductDetailFacts.map(item => <li key={item}>{item}</li>)}</ul>}
        {activeTab === "specs" && <dl className={styles.specTable}>{product.specifications.slice(0, 3).map(spec => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}
        <div className={styles.metaRow}><p><strong>Have a Question?</strong> <a href="/contact-us">Contact Us</a></p><small>SKU {product.sku || "D55I5AI"}</small></div>
        <a className={styles.moreInfo} href="#features">+ MORE INFORMATION</a>
      </div></div>
      <div className={styles.productVisual}>
        <div className={styles.sideActions} aria-hidden="true"><span>♡</span><span>◫</span><span>✉</span></div>
        <Image className={styles.mainProductImage} src={imageSrc} alt="MSI MPG Trident 3 gaming desktop" width={520} height={520} priority />
        <div className={styles.zip}><Image src="/images/home/zip.svg" alt="Zip" width={74} height={32} /><span>own it now, up to 6 months<br />interest free <u>learn more</u></span></div>
        <div className={styles.dots} aria-hidden="true"><i /><i /><i /></div>
      </div>
    </section>

    <section className={styles.competition}><div className={styles.competitionInner}>
      <div className={styles.competitionCopy}><h2>Outplay the<br />Competition</h2><p>Experience a 40% boost in computing from last generation. MSI Desktop equips the 10th Gen. Intel® Core™ i7 processor with the upmost computing power to bring you an unparalleled gaming experience.</p><p>*Performance compared to i7-9700. Specs varies by model.</p><div className={styles.lightDots}><i /><i /><i /></div></div>
      <div className={styles.processorArt}><div><span>intel</span><strong>CORE i7</strong><small>10TH GEN</small></div></div>
    </div></section>

    <section className={styles.support}><div className={styles.supportInner}>
      <div className={styles.supportLinks}><a href="/contact-us">Product Support <span>→</span></a><a href="/faq">FAQ <span>→</span></a><a href="#buyer-guide">Our Buyer Guide <span>→</span></a></div>
      <div className={styles.agentArt} aria-hidden="true"><div className={styles.agentHead}>◡</div><div className={styles.headset}>⌕</div><div className={styles.agentBody} /></div>
    </div></section>

    <section id="features" className={styles.features}><div className={styles.featuresInner}>
      <h2>Featues</h2><p>The MPG series brings out the best in gamers<br />by allowing full expression in color with<br />advanced RGB lighting control and synchronization.</p>
      <div className={styles.featureGrid}>
        <Feature icon="intel" text={<><b>Intel® Core™ i7</b> processor with the upmost computing power to bring you an unparalleled gaming experience.</>} />
        <Feature icon="RTX" text={<>The new <b>GeForce® RTX SUPER™</b> Series has more cores and higher clocks for superfast performance compared to previous-gen GPUs.</>} />
        <Feature icon="SSD" text={<>Unleash the full potential with the latest <b>SSD technology</b>, the NVM Express. 6 times faster than traditional SATA SSD.</>} />
        <Feature icon="DDR4" text={<>Featuring the latest <b>10th Gen Intel® Core™</b> processors, memory can support up to DDR4 2933MHz.</>} />
      </div>
    </div></section>
    <div className={styles.footerGap} />
  </article>;
}

function Feature({ icon, text }: { icon: string; text: React.ReactNode }) { return <article className={styles.feature}><div className={styles.featureIcon}>{icon}</div><p>{text}</p></article>; }
