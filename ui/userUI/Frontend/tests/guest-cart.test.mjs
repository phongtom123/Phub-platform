import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeStoredCarts,
  restoreCart,
} from "../src/lib/shopping/cart-storage.ts";
import {
  authPageHref,
  safeAuthRedirect,
} from "../src/lib/auth/redirect.ts";

test("guest cart accepts only bounded, unique product lines", () => {
  assert.deepEqual(
    restoreCart([
      { product_id: "P-1", sku: "SKU-1", quantity: 2, selected: true },
      { product_id: "P-1-copy", sku: "SKU-1", quantity: 3 },
      { product_id: "P-2", sku: "SKU-2", quantity: 0 },
    ]),
    [{ product_id: "P-1", sku: "SKU-1", quantity: 2, selected: true }],
  );
});

test("login merges guest quantities and selections into the customer cart", () => {
  assert.deepEqual(
    mergeStoredCarts(
      [{ product_id: "P-1", sku: "SKU-1", quantity: 3, selected: false }],
      [
        { product_id: "P-1", sku: "SKU-1", quantity: 2, selected: true },
        { product_id: "P-2", sku: "SKU-2", quantity: 1, selected: false },
      ],
    ),
    [
      { product_id: "P-1", sku: "SKU-1", quantity: 5, selected: true },
      { product_id: "P-2", sku: "SKU-2", quantity: 1, selected: false },
    ],
  );
});

test("checkout handoff keeps an internal redirect and rejects open redirects", () => {
  assert.equal(safeAuthRedirect("/checkout", "/"), "/checkout");
  assert.equal(safeAuthRedirect("//outside.invalid", "/"), "/");
  assert.equal(safeAuthRedirect("https://outside.invalid", "/"), "/");
  assert.equal(
    authPageHref("/auth/register", "/checkout", "/"),
    "/auth/register?redirect=%2Fcheckout",
  );
});
