import type { Metadata } from "next";
import { HomePage1 } from "@/components/home/HomePage1";

export const metadata: Metadata = {
  title: "PHUB Store | PC nguyên bộ và linh kiện",
  description: "Tra cứu PC nguyên bộ và linh kiện máy tính từ catalog của cửa hàng.",
};

export default function Home() {
  return <HomePage1 />;
}
