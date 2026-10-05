import Image from "next/image";
import { productFeatures, productFeaturesIntro } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function ProductFeatures() {
  return <section id="product-features" className={styles.features} aria-labelledby="product-features-heading">
    <h2 id="product-features-heading">Tính năng</h2>
    <p className={styles.featuresIntro}>{productFeaturesIntro}</p>
    <div className={styles.featuresList}>
      {productFeatures.map(feature => <article key={feature.id} className={styles.feature}>
        <Image src={feature.image} alt="" width={80} height={80} />
        <p><strong>{feature.lead}</strong> {feature.body}</p>
      </article>)}
    </div>
  </section>;
}
