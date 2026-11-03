import type { DataRow } from "../../lib/inline-table-data";

export type AdminOrderDetailData = {
  order_id: string;
  order: DataRow;
  customer: DataRow | null;
  employee: DataRow | null;
  lines: DataRow[];
  invoice: DataRow | null;
  payments: DataRow[];
  voucher_uses: DataRow[];
  financial: {
    invoice_id: string | null; invoice_status: "DA_LAP" | "CHUA_LAP";
    payment_status: "CHUA_CO_HOA_DON" | "CHUA_THU" | "THU_MOT_PHAN" | "DA_THU_DU" | "THU_THUA";
    total: string | null; collected: string; refunded: string; paid: string; remaining: string | null;
  };
};
