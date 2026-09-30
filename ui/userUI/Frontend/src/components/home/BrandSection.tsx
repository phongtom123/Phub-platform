import { BrandTile } from "@/components/common/BrandTile";
import { brands, brandMobileImages } from "./homeData";
import styles from "./Home.module.css";

export function BrandSection() {
  return <section className={styles.brands} aria-label="Thương hiệu đối tác">
    {brands.map(brand => <BrandTile key={brand.id} name={brand.name} src={`/images/brands/${brand.id}.png`} mobileSrc={`/images/figma-mobile/${brandMobileImages[brand.id]}`} width={153} height={80} loading="lazy" containerClassName={styles.brandTile} />)}
  </section>;
}
