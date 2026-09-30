import { BrandTile } from "@/components/common/BrandTile";
import { brands } from "./homeData";
import styles from "./Home.module.css";

export function BrandSection() {
  return <section className={styles.brands} aria-label="Thương hiệu đối tác">
    {brands.map(brand => <BrandTile key={brand.id} name={brand.name} src={`/images/brands/${brand.id}.png`} width={153} height={80} loading="lazy" containerClassName={styles.brandTile} />)}
  </section>;
}
