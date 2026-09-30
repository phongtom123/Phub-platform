import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/CatalogPage";
import { HomePage2 } from "@/components/mobile/home-page-2/HomePage2";
import { findMenuCategory, findMenuItem } from "@/components/mobile/menu/menuData";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "MSI PS Series | Tech Store",
  description: "Khám phá các mẫu laptop MSI Prestige trong giao diện danh mục sản phẩm.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; menuCategory?: string | string[]; menuItem?: string | string[] }> }) {
  const { view, menuCategory, menuItem } = await searchParams;
  const category = typeof menuCategory === "string" ? findMenuCategory(menuCategory) : undefined;
  const item = category && typeof menuItem === "string" ? findMenuItem(category.id, menuItem) : undefined;
  return <>
    <div className={styles.desktop}><CatalogPage initialView={view === "list" ? "list" : "grid"} /></div>
    <div className={styles.mobile}><HomePage2 categoryLabel={category?.label} itemLabel={item?.label} /></div>
  </>;
}
