"use client";

import { useEffect, useMemo, useState } from 'react';
import { useShopping } from '@/components/shopping/ShoppingProvider';
import { listVouchers } from '@/lib/shopping/client';
import { cents, money, moneyFromCents } from '@/lib/shopping/money';
import type { CustomerVouchers } from '@/lib/shopping/types';
import styles from './checkout.module.css';

const reasons = {
  EXPIRED: 'Đã hết hạn', NOT_STARTED: 'Chưa đến thời gian áp dụng',
  LIMIT_REACHED: 'Đã hết lượt sử dụng', CUSTOMER_LIMIT_REACHED: 'Bạn đã dùng hết lượt',
};
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value));

export function VoucherPicker({ subtotal, confirmedCode, disabled, onSelect }: {
  subtotal: string; confirmedCode: string | null; disabled: boolean; onSelect: (code: string) => void;
}) {
  const { customer, authStatus } = useShopping();
  const identity = authStatus === 'authenticated' ? customer?.customer_id : undefined;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ identity: string; revision: number; data?: CustomerVouchers; error?: string }>();
  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    listVouchers(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ identity, revision, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ identity, revision, error: error instanceof Error ? error.message : 'Không tải được mã giảm giá.' });
    });
    return () => controller.abort();
  }, [identity, revision]);
  const current = result && result.identity === identity && result.revision === revision ? result : undefined;
  const vouchers = current?.data?.items;
  const items = useMemo(() => {
    if (!vouchers) return undefined;
    const total = cents(subtotal);
    return vouchers.map(item => {
      let discount = item.discount_type === 'PHAN_TRAM'
        ? (total * cents(item.discount_value) + BigInt(5000)) / BigInt(10000)
        : cents(item.discount_value);
      if (item.discount_type === 'PHAN_TRAM' && item.maximum_discount !== null) {
        const cap = cents(item.maximum_discount);
        if (discount > cap) discount = cap;
      }
      if (discount > total) discount = total;
      const priority = item.unavailable_reason ? 2 : total < cents(item.minimum_order) ? 1 : 0;
      return { item, discount, priority };
    }).sort((a, b) => a.priority - b.priority ||
      (a.discount > b.discount ? -1 : a.discount < b.discount ? 1 : 0) ||
      a.item.code.localeCompare(b.item.code, 'vi'))
      .map(({ item }) => item);
  }, [vouchers, subtotal]);
  const currency = current?.data?.currency;
  if (!identity) return null;
  return <section className={styles.voucherPicker} aria-label="Chọn mã giảm giá">
    <h3>Mã giảm giá dành cho bạn <small>Chọn 1 mã cho đơn hàng</small></h3>
    {!current && <p role="status">Đang tải mã giảm giá…</p>}
    {current?.error && <p role="status">{current.error} <button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p>}
    {items?.length === 0 && <p>Chưa có mã giảm giá khả dụng.</p>}
    {!!items?.length && <div className={styles.voucherList}>
      {items.map(item => {
        const reason = item.unavailable_reason ? reasons[item.unavailable_reason]
          : cents(subtotal) < cents(item.minimum_order) ? `Cần mua thêm ${moneyFromDifference(item.minimum_order, subtotal, currency)}` : null;
        const selected = confirmedCode === item.code;
        return <article key={item.code} className={styles.voucherCard} data-unavailable={!!reason} aria-label={`Mã ${item.code}`}>
          <div>
            <strong>{item.code}</strong>
            <p>Giảm {item.discount_type === 'PHAN_TRAM' ? `${Number(item.discount_value)}%` : money(item.discount_value, currency)}
              {item.discount_type === 'PHAN_TRAM' && item.maximum_discount !== null && ` · tối đa ${money(item.maximum_discount, currency)}`}</p>
            <small>Đơn từ {money(item.minimum_order, currency)} · {item.unavailable_reason === 'NOT_STARTED' ? `Từ ${date(item.starts_at)}` : `HSD ${date(item.expires_at)}`}</small>
            {reason && <span className={styles.voucherReason}>{reason}</span>}
          </div>
          <button type="button" disabled={disabled || !!reason || selected} onClick={() => onSelect(item.code)} aria-label={`Chọn mã ${item.code}`}>
            {selected ? 'Đã chọn' : 'Chọn'}
          </button>
        </article>;
      })}
    </div>}
  </section>;
}

function moneyFromDifference(minimum: string, subtotal: string, currency?: string) {
  const difference = cents(minimum) - cents(subtotal);
  return moneyFromCents(difference, currency);
}
