"use client";

import { useCatalog } from "@/lib/catalog/useCatalog";
import { CatalogPage } from "./CatalogPage";
import { HomePage2 } from "@/components/mobile/home-page-2/HomePage2";

export function CatalogExperience() {
  const catalog = useCatalog();
  return catalog.mobile ? <HomePage2 catalog={catalog} /> : <CatalogPage catalog={catalog} />;
}
