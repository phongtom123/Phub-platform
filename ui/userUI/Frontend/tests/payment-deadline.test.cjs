const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/shopping/payment-deadline.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const scope = { exports: {} }; vm.runInNewContext(code, scope);
const { deadlineRemaining, deadlineBlocksPayment, validPaymentDeadline } = scope.exports;
const d = { expires_at: '2026-11-05T00:00:00Z', server_now: '2026-11-04T00:00:00Z', expired_at: null, status: 'awaiting_payment' };
test('countdown uses server time, clamps zero and blocks after 24 hours', () => {
  assert.equal(deadlineRemaining(d), 86400000);
  assert.equal(deadlineRemaining(d, 1000), 86399000);
  assert.equal(deadlineRemaining(d, 90000000), 0);
  assert.equal(deadlineBlocksPayment(d, 1), false);
  assert.equal(deadlineBlocksPayment(d, 0), true);
});
test('successful partial payment and closed orders are protected; processing expiry blocks payment', () => {
  for (const status of ['payment_received', 'closed']) assert.equal(deadlineBlocksPayment({ ...d, status }, 0), false);
  for (const status of ['processing_expiry', 'expired']) assert.equal(deadlineBlocksPayment({ ...d, status }, 1), true);
  assert.equal(deadlineBlocksPayment(null, 0), false);
});
test('legacy metadata is optional; invalid/naive timestamps or unknown status fail validation', () => {
  assert.equal(validPaymentDeadline(null), true);
  assert.equal(validPaymentDeadline(undefined), true);
  assert.equal(validPaymentDeadline(d), true);
  for (const change of [{expires_at:'2026-11-05T00:00:00'}, {server_now:'invalid'}, {status:'other'}, {status:'expired'}])
    assert.equal(validPaymentDeadline({...d,...change}), false);
});
