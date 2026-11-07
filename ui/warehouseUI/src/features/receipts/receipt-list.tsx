"use client";

import BackendDataView from "@internal/components/backend-data-view";

/** One receipt table for both portals, including filters and draft-only editing. */
export default function ReceiptList() {
  return <BackendDataView resource="receipts" />;
}
