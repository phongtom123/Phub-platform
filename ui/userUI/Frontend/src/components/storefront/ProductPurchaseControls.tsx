"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { QuantityInput } from "@/components/common/QuantityInput";

export function ProductPurchaseControls({ available }: { available: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  return <div className="mt-6 flex flex-col gap-4">
    <label htmlFor="detail-quantity" className="text-sm text-slate-600">Số lượng</label>
    <QuantityInput id="detail-quantity" value={quantity} onValueChange={setQuantity} label="Quantity" disabled={!available} />
    <div className="flex flex-wrap gap-3">
      <Button disabled={!available} onClick={() => setNotice(`Đã chọn ${quantity} sản phẩm trong bản xem thử. Chưa tạo đơn hàng hoặc cập nhật giỏ hàng thật.`)}>Thêm vào giỏ hàng</Button>
      <Button variant="outlinePrimary" disabled={!available} onClick={() => setNotice("Đây là giao diện mẫu, chưa kết nối thanh toán.")}>Mua ngay</Button>
    </div>
    <p className="text-xs leading-6 text-slate-600" role="status">{notice || "Dữ liệu mẫu — các thao tác không tạo đơn hàng thật."}</p>
  </div>;
}
