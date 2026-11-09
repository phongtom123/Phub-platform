"use client";

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CancelOrderButton } from '@/components/shopping/CancelOrderButton';
import { InvoicePanel } from '@/components/shopping/InvoicePanel';
import { PaymentPanel } from '@/components/shopping/PaymentPanel';
import { useShopping } from '@/components/shopping/ShoppingProvider';
import { useCustomerResource } from '@/components/shopping/useCustomerResource';
import { validateOrder } from '@/lib/shopping/client';
import { invoiceTotals, money } from '@/lib/shopping/money';
import type { PaymentDeadline, Receipt } from '@/lib/shopping/types';
import styles from './checkout.module.css';

export function CheckoutConfirmation({ receipt }: { receipt: Receipt }) {
  const shop = useShopping();
  const order = useCustomerResource(`orders/${encodeURIComponent(receipt.id)}`, validateOrder);
  const { reload } = order;
  const [cancelled, setCancelled] = useState(false);
  const [deadline, setDeadline] = useState<PaymentDeadline | null>();
  const receiveDeadline = useCallback((value: PaymentDeadline | null) => setDeadline(value), []);
  const status = cancelled ? 'HUY' : order.data?.status ?? receipt.status;
  const isCancelled = status === 'HUY';

  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ orderId: string }>).detail?.orderId === receipt.id) reload();
    };
    window.addEventListener('phub:order-changed', changed);
    return () => window.removeEventListener('phub:order-changed', changed);
  }, [receipt.id, reload]);

  return <main className={styles.page}>
    <div className={styles.container}>
      <section className={`${styles.success} ${styles.confirmation} ${isCancelled ? styles.cancelledConfirmation : ''}`} aria-label="Kết quả đặt hàng">
        {isCancelled && <h1>Đơn hàng đã hủy</h1>}
        <p>Mã đơn hàng: <strong>{receipt.id}</strong></p>
        <p>{receipt.fulfillment_method === 'TAI_CUA_HANG' ? 'Nhận tại cửa hàng' : 'Giao hàng tận nơi'} · {receipt.recipient.name} · {receipt.recipient.phone}</p>
        <p className={styles.confirmationTotal}>Thành tiền sau thuế: <strong>{money(invoiceTotals(receipt).total, receipt.currency)}</strong></p>
        {isCancelled && <p role="status">Đã hủy đơn hàng. Không thể thanh toán mới cho đơn này.</p>}
        <div className={styles.confirmationActions}>
          <Link className={styles.confirmationPrimary} href={`/main/orders/${encodeURIComponent(receipt.id)}`}>Xem chi tiết đơn &amp; Hóa đơn →</Link>
          <Link className={styles.confirmationProfile} href="/main/profile">Vào trang cá nhân</Link>
          <Link className={styles.confirmationShop} href="/main/product">Tiếp tục mua sắm</Link>
          <CancelOrderButton orderId={receipt.id} status={status} disabled={order.loading || !!order.error}
            onCancelled={() => { setCancelled(true); setDeadline(null); }} />
        </div>
        {order.error && <p role="alert">{order.error} <button type="button" onClick={reload}>Cập nhật trạng thái đơn</button></p>}
      </section>
      <InvoicePanel key={`${receipt.id}:${isCancelled}`} orderId={receipt.id} onDeadlineChange={receiveDeadline} />
      {shop.customer?.payment_bypass_enabled && <PaymentPanel orderId={receipt.id} orderStatus={status} paymentDeadline={deadline} />}
    </div>
  </main>;
}
