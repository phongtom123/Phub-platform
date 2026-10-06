import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: "Tech Store | Computers, Laptops & Gaming",
  description: "Explore our range of custom PCs, MSI laptops, desktops and gaming monitors.",
};

export default function Home() {
  return <HomePage />;
}
