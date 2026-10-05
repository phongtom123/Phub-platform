import Image from "next/image";
import { CatalogSelectionPanel } from "@/components/catalog/CatalogSelectionPanel";
import type { CatalogProduct } from "@/components/catalog/catalogData";
import styles from "./HomePage2.module.css";

interface Props {
  compared: CatalogProduct[];
  wished: CatalogProduct[];
  onCompare: (product: CatalogProduct) => void;
  onWish: (product: CatalogProduct) => void;
}

export function HomePage2Extras({ compared, wished, onCompare, onWish }: Props) {
  return <aside className={styles.extras} aria-label="Danh sách sản phẩm đã lưu và khuyến mãi">
    <CatalogSelectionPanel locale="vi" title="So sánh sản phẩm" emptyText="Bạn chưa có sản phẩm để so sánh." products={compared} onRemove={onCompare} onSelect={() => {}} />
    <CatalogSelectionPanel locale="vi" title="Danh sách yêu thích" emptyText="Bạn chưa có sản phẩm yêu thích." products={wished} onRemove={onWish} onSelect={() => {}} />
    <Image src="/images/figma-mobile/catalog-ad.png" alt="noblechairs The Icon Series - Become iconic" width={190} height={320} className={styles.ad} />
  </aside>;
}
