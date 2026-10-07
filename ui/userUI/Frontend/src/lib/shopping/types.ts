export interface CustomerProfile {
  demo_mode?: boolean;
  customer_id: string;
  name: string;
  phone: string | null;
  address_line: string | null;
  province: string | null;
  ward: string | null;
}
export interface CartLine {
  product_id: string;
  sku: string;
  quantity: number;
  name: string;
  image: string;
  unit_price: string;
  currency: string;
  unavailable?: boolean;
  selected?: boolean;
}
export interface CheckoutLine {
  sku: string;
  warehouse_id: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price: string;
  gross_total: string;
  discount: string;
  tax_rate: string;
  tax_amount: string;
  line_total: string;
}
export interface Quote {
  currency: string;
  tax_application: "invoice";
  shipping_status: "not_quoted";
  voucher_code: string | null;
  items: CheckoutLine[];
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
}
export interface Recipient {
  name: string;
  phone: string;
  address_line: string;
  province: string;
  ward: string;
}
export interface OrderRequest {
  recipient: Recipient;
  note: string | null;
  voucher_code: string | null;
  expected_discount: string;
  expected_total: string;
  items: {
    sku: string;
    warehouse_id: number;
    quantity: number;
    expected_unit_price: string;
  }[];
}
export interface Receipt extends Quote {
  id: string;
  status: "MOI";
  sales_channel: "ONLINE";
  created_at: string;
  recipient: Recipient;
  note: string | null;
}
export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
export interface OrderSummary {
  id: string;
  status: string;
  created_at: string;
  currency: string;
  total: string;
}
export interface OrderPage {
  items: OrderSummary[];
  pagination: Pagination;
}
export interface StoredLine {
  sku: string;
  warehouse_id: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price: string;
  discount: string;
  tax_amount: string;
  line_total: string;
}
export interface OrderDetail extends OrderSummary {
  recipient: { [K in keyof Recipient]: string | null };
  note: string | null;
  items: StoredLine[];
}
export interface Transaction {
  type: "collection" | "refund" | "unknown";
  method: "cash" | "bank_transfer" | "card" | "e_wallet" | "unknown";
  amount: string;
  status: "pending" | "succeeded" | "failed" | "unknown";
  occurred_at: string | null;
  message: string;
}
export interface Payments {
  order_id: string;
  currency: string;
  latest_transaction: Transaction | null;
  message: string;
}
export interface TransactionPage {
  order_id: string;
  currency: string;
  items: Transaction[];
  pagination: Pagination;
}

export type PaymentMethod = "cash" | "bank_transfer" | "card" | "e_wallet";
export interface InvoiceOverview {
  order_id: string;
  currency: string;
  invoice: { issued_at: string; discount_total: string; subtotal: string; tax_total: string; total: string } | null;
  items: StoredLine[];
}
