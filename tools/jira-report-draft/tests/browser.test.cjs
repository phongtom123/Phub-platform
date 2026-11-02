// Real Chromium DOM/editor operations against mocked Jira responses only.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const origin = 'https://qa-fixture.atlassian.net';
const requests = [];
let browser;
let passed = 0;

const issue = (key) => ({ key, fields: {
  summary: 'DST session validation', status: { name: 'Done' },
  description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Check the session. <img src=x onerror="window.injected=true">' },
  ] }] },
} });

async function fixture(body, options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(origin + '/**', async (route) => {
    const request = route.request();
    requests.push({ method: request.method(), url: request.url() });
    assert.equal(request.method(), 'GET', 'The tool must never send mutation requests');
    if (new URL(request.url()).pathname.startsWith('/rest/api/3/issue/')) {
      const key = decodeURIComponent(new URL(request.url()).pathname.split('/').pop());
      return route.fulfill({ status: options.apiStatus || 200, contentType: 'application/json',
        body: JSON.stringify(issue(options.responseKey || key)) });
    }
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><title>Mock Jira</title>
      <style>body{font:16px Arial;padding:30px}textarea,[contenteditable]{display:block;width:600px;min-height:100px;border:1px solid #888}button{padding:10px}</style></head>
      <body><h1>KAN-42: DST session validation</h1>
      <form id="comment-form">${body}<button id="save" type="submit">Save</button></form>
      <script>window.saveClicks=0;window.submits=0;window.inputEvents=0;
      document.getElementById('save').addEventListener('click',()=>window.saveClicks++);
      document.getElementById('comment-form').addEventListener('submit',e=>{e.preventDefault();window.submits++;});
      document.addEventListener('input',e=>{if(!e.composedPath().some(n=>n.id==='phub-jira-report-draft'))window.inputEvents++;});</script>
      </body></html>` });
  });
  await page.goto(origin + '/browse/KAN-42');
  await page.addScriptTag({ path: path.join(root, 'report-core.js') });
  await page.addScriptTag({ path: path.join(root, 'content.js') });
  const host = page.locator('#phub-jira-report-draft');
  await host.locator('.launcher').click();
  return { page, context, host, errors };
}

async function prepare(f, language = 'en') {
  await f.host.locator('#qa-language').selectOption(language);
  await f.host.locator('[data-qa-draft-action="prepare"]').click();
  await f.page.waitForFunction(() => {
    const ui = document.getElementById('phub-jira-report-draft').shadowRoot;
    return !ui.querySelector('[data-qa-draft-action="prepare"]').disabled;
  });
}

async function insert(f) {
  await f.host.locator('[data-qa-draft-action="insert"]').click();
  await f.page.waitForFunction(() => {
    const ui = document.getElementById('phub-jira-report-draft').shadowRoot;
    return !ui.querySelector('[data-qa-draft-action="insert"]').disabled;
  });
}

async function check(name, body, fn, options) {
  const f = await fixture(body, options);
  try {
    await fn(f);
    assert.deepEqual(await f.page.evaluate(() => [window.saveClicks, window.submits]), [0, 0], 'Never click Save or submit');
    assert.deepEqual(f.errors, [], 'No browser errors');
    console.log('PASS ' + name);
    passed++;
  } finally { await f.context.close(); }
}

(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROME_PATH
    ? { executablePath: process.env.QA_CHROME_PATH } : { channel: 'chrome' }) });
  try {
    await check('textarea: prepare is read-only; insert creates an editable draft without Save',
      '<textarea id="comment" aria-label="Comment"></textarea>', async (f) => {
        await prepare(f);
        assert.equal(await f.page.locator('#comment').inputValue(), '');
        const preview = await f.host.locator('textarea').inputValue();
        assert.match(preview, /Test result: NOT TESTED/);
        assert.match(preview, /Jira status: Done/);
        assert.match(preview, /<img src=x onerror=/);
        await f.host.locator('textarea').fill(preview + '\nTester: Alice');
        await insert(f);
        assert.equal(await f.page.locator('#comment').inputValue(), preview + '\nTester: Alice');
        assert.ok(await f.page.evaluate(() => window.inputEvents > 0));
        assert.equal(await f.page.evaluate(() => window.injected), undefined);
      });

    await check('rich text: native insertion emits input and leaves draft unsaved',
      '<div id="rich-comment" contenteditable="true" role="textbox" aria-label="Comment"></div>', async (f) => {
        await prepare(f, 'vi'); await insert(f);
        assert.match(await f.page.locator('#rich-comment').innerText(), /BÁO CÁO KIỂM TRA — KAN-42/);
        assert.match(await f.page.locator('#rich-comment').innerText(), /CHƯA KIỂM TRA/);
        assert.ok(await f.page.evaluate(() => window.inputEvents > 0));
        assert.equal(await f.page.locator('#rich-comment img').count(), 0);
      });

    await check('preserves an existing user draft',
      '<textarea id="comment" aria-label="Comment">My existing notes</textarea>', async (f) => {
        await prepare(f); await insert(f);
        assert.equal(await f.page.locator('#comment').inputValue(), 'My existing notes');
        assert.match(await f.host.locator('[role="status"]').innerText(), /đã có nội dung/);
      });

    await check('preserves notes restored by Jira when the editor receives focus',
      '<textarea id="comment" aria-label="Comment" onfocus="this.value=\'Restored notes\'"></textarea>', async (f) => {
        await prepare(f); await insert(f);
        assert.equal(await f.page.locator('#comment').inputValue(), 'Restored notes');
        assert.match(await f.host.locator('[role="status"]').innerText(), /khôi phục bản nháp/);
      });

    await check('does not report success when focus replaces the editor',
      '<textarea id="comment" aria-label="Comment" onfocus="const fresh=document.createElement(\'textarea\');fresh.id=\'replacement\';fresh.setAttribute(\'aria-label\',\'Comment\');this.replaceWith(fresh)"></textarea>', async (f) => {
        await prepare(f); await insert(f);
        assert.equal(await f.page.locator('#replacement').inputValue(), '');
        assert.match(await f.host.locator('[role="status"]').innerText(), /vừa thay trình soạn thảo/);
      });

    await check('ignores hidden and read-only comment editors',
      '<textarea id="hidden-comment" hidden aria-label="Comment"></textarea><textarea id="readonly-comment" readonly aria-label="Comment">Read-only</textarea><textarea id="comment" aria-label="Comment"></textarea>', async (f) => {
        await prepare(f); await insert(f);
        assert.equal(await f.page.locator('#hidden-comment').inputValue(), '');
        assert.equal(await f.page.locator('#readonly-comment').inputValue(), 'Read-only');
        assert.match(await f.page.locator('#comment').inputValue(), /QA TEST REPORT/);
      });

    await check('refuses to edit the Description field',
      '<div id="description" contenteditable="true" aria-label="Description"></div>', async (f) => {
        await prepare(f); await insert(f);
        assert.equal(await f.page.locator('#description').innerText(), '');
        assert.match(await f.host.locator('[role="status"]').innerText(), /Chưa nhận diện/);
      });

    await check('refuses ambiguous editors, then respects the editor the user focuses',
      '<textarea id="first" aria-label="Comment one"></textarea><textarea id="second" aria-label="Comment two"></textarea>', async (f) => {
        await prepare(f); await insert(f);
        assert.match(await f.host.locator('[role="status"]').innerText(), /nhiều ô Comment/);
        assert.equal(await f.page.locator('#first').inputValue(), '');
        assert.equal(await f.page.locator('#second').inputValue(), '');
        await f.page.locator('#second').focus(); await insert(f);
        assert.equal(await f.page.locator('#first').inputValue(), '');
        assert.match(await f.page.locator('#second').inputValue(), /QA TEST REPORT/);
      });

    await check('opens Add a comment, then fills the editor without using Save',
      '<button type="button" id="open-comment">Add a comment…</button><div id="mount"></div><script>document.getElementById("open-comment").onclick=()=>{const el=document.createElement("textarea");el.id="comment";el.setAttribute("aria-label","Comment");document.getElementById("mount").append(el);};</script>', async (f) => {
        await prepare(f); await insert(f);
        assert.match(await f.page.locator('#comment').inputValue(), /QA TEST REPORT/);
      });

    await check('blocks inserting a report for a different issue',
      '<textarea id="comment" aria-label="Comment"></textarea>', async (f) => {
        await f.host.locator('#qa-ticket-key').fill('KAN-99'); await prepare(f);
        assert.match(await f.host.locator('textarea').inputValue(), /QA TEST REPORT — KAN-99/);
        assert.equal(await f.host.locator('[data-qa-draft-action="insert"]').isDisabled(), true);
        assert.equal(await f.page.locator('#comment').inputValue(), '');
      });

    await check('SPA ticket navigation invalidates the prepared report',
      '<textarea id="comment" aria-label="Comment"></textarea>', async (f) => {
        await prepare(f);
        await f.page.evaluate(() => history.pushState({}, '', '/browse/KAN-99'));
        await f.page.waitForFunction(() => document.getElementById('phub-jira-report-draft').shadowRoot.querySelector('#qa-ticket-key').value === 'KAN-99');
        assert.equal(await f.host.locator('[data-qa-draft-action="insert"]').isDisabled(), true);
        assert.equal(await f.page.locator('#comment').inputValue(), '');
      });

    await check('authentication failure leaves the editor untouched',
      '<textarea id="comment" aria-label="Comment"></textarea>', async (f) => {
        await prepare(f);
        assert.match(await f.host.locator('[role="status"]').innerText(), /HTTP 401/);
        assert.equal(await f.host.locator('[data-qa-draft-action="insert"]').isDisabled(), true);
        assert.equal(await f.page.locator('#comment').inputValue(), '');
      }, { apiStatus: 401 });

    await check('rejects a mismatched ticket returned by the API',
      '<textarea id="comment" aria-label="Comment"></textarea>', async (f) => {
        await prepare(f);
        assert.match(await f.host.locator('[role="status"]').innerText(), /API trả về ticket khác/);
        assert.equal(await f.host.locator('[data-qa-draft-action="insert"]').isDisabled(), true);
      }, { responseKey: 'KAN-99' });

    assert.ok(requests.some((r) => r.url.includes('/rest/api/3/issue/')));
    assert.ok(requests.every((r) => r.method === 'GET'));
    assert.ok(requests.every((r) => !r.url.includes('/comment')), 'No comment API calls');
    console.log(`${passed} browser scenarios passed; all requests GET; Save clicks and submissions: 0.`);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
