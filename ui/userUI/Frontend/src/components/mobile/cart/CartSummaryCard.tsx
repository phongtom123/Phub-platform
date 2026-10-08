export function CartSummaryCard({ subtotal, itemCount }: { subtotal: number; itemCount: number }) {
  void subtotal; void itemCount;
  return <section><h2>Tóm tắt đơn hàng</h2><p>Chưa có báo giá từ backend. Không hiển thị tổng tiền hoặc áp dụng voucher thử.</p></section>;
}
