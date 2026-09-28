export type ModuleKey =
  | "dashboard"
  | "orders"
  | "billing"
  | "customers"
  | "products"
  | "categories"
  | "inventory"
  | "receipts"
  | "transfers"
  | "suppliers"
  | "branches"
  | "employees"
  | "accounts"
  | "promotions"
  | "vouchers";

export type DataValue = string | number | boolean;
export type DataRow = Record<string, DataValue> & { id: string };

export type ColumnKind = "text" | "strong" | "status" | "link" | "stack";

export type ColumnDefinition = {
  key: string;
  label: string;
  kind?: ColumnKind;
  subKey?: string;
};

export type StatDefinition = {
  label: string;
  value: string;
};

export type ModuleDefinition = {
  title: string;
  detailSection: string;
  searchPlaceholder: string;
  addLabel?: string;
  filters?: string[];
  columns: ColumnDefinition[];
  rows: DataRow[];
  stats?: StatDefinition[];
  note?: string;
};

export type FormFieldDefinition = {
  name: string;
  label: string;
  placeholder: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea";
  wide?: boolean;
};
