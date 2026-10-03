"use client";

import Link from "next/link";
import { Button } from "@/components/common/Button";

export default function ProductError({ reset }: { reset: () => void }) {
  return <section role="alert" style={{ padding: "48px 24px", textAlign: "center" }}>
    <h1>Không thể tải thông tin sản phẩm</h1><p>Vui lòng thử lại sau.</p>
    <Button onClick={reset}>Thử lại</Button><p><Link href="/main/product">Về danh sách sản phẩm</Link></p>
  </section>;
}
