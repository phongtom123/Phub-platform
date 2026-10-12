// Read-only source guard. Test fixtures and Swagger examples are intentionally allowed.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../../adminUI/node_modules/typescript");
const root = path.resolve(__dirname, "../../..");
function source(file) { return fs.readFileSync(path.join(root, file), "utf8"); }

test("admin and warehouse module definitions contain no sample records", () => {
  for (const file of ["ui/adminUI/src/data/admin-data.ts", "ui/warehouseUI/src/data/warehouse-data.ts"]) {
    const tree = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true);
    let collections = 0;
    function visit(node) {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "rows") {
        assert.ok(ts.isArrayLiteralExpression(node.initializer), file);
        assert.equal(node.initializer.elements.length, 0, file);
        collections++;
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.ok(collections > 0);
  }
});

test("catalog and identity modules have no fallback business records", () => {
  const files = ["components/catalog/catalogData.ts", "components/home/homeData.ts", "data/product-details.ts", "data/storefront-data.ts", "app/main/profile/accountData.ts", "components/mobile/cart/cartData.ts"];
  for (const file of files) {
    assert.doesNotMatch(source("ui/userUI/Frontend/src/" + file), /(?:sku|name|email)\s*:\s*["'][^"']+["']|(?:price|amount|rating|reviewCount)\s*:\s*\d/);
  }
});

test("connected screens do not import fixture collections", () => {
  const files = ["ui/adminUI/src/features/modules/module-view.tsx", "ui/adminUI/src/features/dashboard/dashboard-view.tsx", "ui/userUI/Frontend/src/components/home/LiveHomeProducts.tsx", "ui/userUI/Frontend/src/lib/catalog/useCatalog.ts"];
  for (const file of files) assert.doesNotMatch(source(file), /\b(?:catalogProducts|storeProducts|demoAccount|initialCartProducts)\b/);
});
