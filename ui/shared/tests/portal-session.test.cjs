const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('../../adminUI/node_modules/typescript');
const source = 'https://admin.example.test', target = 'https://warehouse.example.test';
const code = 'x'.repeat(43);

function load(fetch) {
  const scope = { exports: {}, process: { env: { PHUB_API_BASE_URL: 'https://api.example.test' } },
    URL, URLSearchParams, Request, Response, Headers, TextDecoder, Uint8Array, AbortSignal, fetch };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../portal-session.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, scope);
  return scope.exports;
}
function request(origin = source, body = new URLSearchParams({ code }).toString(), extra = {}) {
  return new Request('http://localhost:10000/auth/complete', { method: 'POST', body, headers: {
    Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded',
    'x-forwarded-host': 'warehouse.example.test', 'x-forwarded-proto': 'https', ...extra,
  } });
}
const options = { role: 'NHAN_VIEN', loginUrl: source };

test('callback exchanges a POST code and sets the destination HttpOnly cookie behind Render TLS', async () => {
  const calls = [];
  const api = load(async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ role: 'NHAN_VIEN' }, { headers: { 'Set-Cookie': 'phub_session=test-session; Path=/; HttpOnly; Secure; SameSite=Lax' } });
  });
  const response = await api.completePortalSession(request(), options);
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal(calls[0].url, 'https://api.example.test/api/auth/handoff/exchange');
  assert.deepEqual(JSON.parse(calls[0].init.body), { code, target_origin: target, role: 'NHAN_VIEN' });
  assert.equal(calls[0].init.headers.Origin, source);
  assert.equal(calls[0].init.headers.Cookie, undefined);
  assert.ok(!calls[0].url.includes(code));
});

test('callback rejects GET and untrusted POST sources before consuming any code', async () => {
  let calls = 0; const api = load(async () => { calls++; });
  for (const incoming of [new Request(target+'/auth/complete?code='+code), request('https://attacker.invalid')]) {
    const response = await api.completePortalSession(incoming, options);
    assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(calls, 0);
});

test('malformed, duplicate and oversized codes never reach the exchange API', async () => {
  let calls = 0; const api = load(async () => { calls++; });
  for (const [body, status] of [['code=bad', 400], ['code='+code+'&code='+code, 400], ['code='+'a'.repeat(5000), 413]]) {
    assert.equal((await api.completePortalSession(request(source, body), options)).status, status);
  }
  assert.equal(calls, 0);
});

test('form fields cannot override destination or role', async () => {
  const api = load(async (_, init) => {
    const value = JSON.parse(init.body);
    assert.equal(value.target_origin, target); assert.equal(value.role, 'NHAN_VIEN');
    return Response.json({ role: 'NHAN_VIEN' }, { headers: { 'Set-Cookie': 'phub_session=test; HttpOnly' } });
  });
  const body = new URLSearchParams({ code, role: 'ADMIN', target_origin: 'https://attacker.invalid' }).toString();
  assert.equal((await api.completePortalSession(request(source, body), options)).status, 303);
});

test('expired codes, wrong roles and network errors do not replace an existing cookie or loop redirects', async () => {
  for (const fetch of [
    async () => Response.json({ detail: 'Code expired' }, { status: 401 }),
    async () => Response.json({ role: 'ADMIN' }, { headers: { 'Set-Cookie': 'phub_session=wrong' } }),
    async () => { throw new Error('network'); },
  ]) {
    const response = await load(fetch).completePortalSession(request(), options);
    assert.ok(response.status >= 400); assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('location'), null);
    assert.ok((await response.text()).includes(source+'/auth/logout'));
  }
});

test('central logout clears only its host cookie and returns to the shared login page', () => {
  const response = load().clearPortalSession(new Request(source+'/auth/logout'));
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.ok(!response.headers.get('set-cookie').includes('Domain='));
});
