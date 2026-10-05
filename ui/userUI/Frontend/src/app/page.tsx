import type { Metadata } from "next";
import { HomePage1 } from "@/components/home/HomePage1";

export const metadata: Metadata = {
  title: "Tech Store | Máy tính, laptop và thiết bị gaming",
  description: "Khám phá PC lắp ráp, laptop MSI, máy tính để bàn và màn hình gaming.",
};

export default function Home() {
  return <HomePage1 />;
}
