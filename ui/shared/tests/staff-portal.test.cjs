const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../../adminUI/node_modules/typescript');

function client(fetch) {
  let submitted = null;
  const scope = { exports: {}, URL, Response, fetch, document: {
    createElement: () => ({ children: [], appendChild(child) { this.children.push(child); }, submit() { submitted = this; } }),
    body: { appendChild() {} },
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../staff-portal.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, scope);
  return { ...scope.exports, submitted: () => submitted };
}
test('staff portal navigation transfers only a one-use code in a POST form', async () => {
  const code = 'a'.repeat(43);
  const browser = client(async (url, init) => {
    assert.equal(url, '/api/backend/auth/handoff');
    assert.equal(init.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(init.body), { target_origin: 'https://warehouse.example.test' });
    return Response.json({ code, expires_in: 60 });
  });
  await browser.enterStaffPortal('https://warehouse.example.test');
  const form = browser.submitted();
  assert.equal(form.method, 'POST'); assert.equal(form.action, 'https://warehouse.example.test/auth/complete');
  assert.equal(form.children.length, 1); assert.equal(form.children[0].name, 'code');
  assert.equal(form.children[0].value, code); assert.ok(!form.action.includes(code));
});
test('a failed, aborted or malformed handoff never submits a portal form', async () => {
  for (const response of [Response.json({ detail: 'Not ready' }, { status: 503 }), Response.json({ code: 'bad.jwt.value' })]) {
    const browser = client(async () => response);
    await assert.rejects(browser.enterStaffPortal('https://warehouse.example.test'));
    assert.equal(browser.submitted(), null);
  }
  const browser = client(async () => Response.json({ code: 'a'.repeat(43) }));
  await browser.enterStaffPortal('https://warehouse.example.test', { aborted: true });
  assert.equal(browser.submitted(), null);
});
