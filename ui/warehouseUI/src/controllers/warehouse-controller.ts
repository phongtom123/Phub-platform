/** Controller layer: translates a screen section into model operations. */
import { cancelDispatchDraft, deleteReceiptDraft, deleteTransferDraft, getDispatches, getHistory, getInventory, getInvoices, getPending, getProducts, getReceipts, getTransfers, type WarehouseSection } from "@/src/models/warehouse-model";
import type { DataRow } from "@/src/types/warehouse";

export function isDataSection(section: string): section is WarehouseSection {
  return ["inventory", "products", "receipts", "transfers", "dispatches", "invoices", "pending", "history"].includes(section);
}

export async function loadSectionRows(section: WarehouseSection): Promise<DataRow[]> {
  switch (section) {
    case "inventory": {
      const result = await getInventory();
      return result.items.map(item => ({ id: item.sku, name: item.product_name, code: `${item.sku} · ${item.unit}`, location: item.location ?? "—", quantity: item.quantity, status: item.status }));
    }
    case "products": return getProducts();
    case "receipts": return getReceipts();
    case "transfers": return getTransfers();
    case "dispatches": return getDispatches();
    case "invoices": return getInvoices();
    case "pending": return getPending();
    case "history": return getHistory();
  }
}

export function deleteDraft(section: "receipts" | "transfers" | "dispatches", recordId: number) {
  return section === "receipts" ? deleteReceiptDraft(recordId) : section === "transfers" ? deleteTransferDraft(recordId) : cancelDispatchDraft(recordId);
}
