import type { Metadata } from "next";
import { ComponentPreview } from "./preview";

export const metadata: Metadata = { title: "Tech Store — Common components" };

export default function ComponentsPreviewPage() {
  return <ComponentPreview />;
}
