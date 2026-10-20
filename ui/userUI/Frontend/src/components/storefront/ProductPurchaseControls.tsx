import { Button } from "@/components/common/Button";
export function ProductPurchaseControls({ available }: { available: boolean }) {
  return <div className="mt-6 flex flex-col gap-4">
    <Button disabled>Thêm vào giỏ hàng</Button>
    <p role="status">{available ? "Giỏ hàng và thanh toán chưa được kết nối API." : "Sản phẩm hiện không khả dụng."}</p>
  </div>;
}
