const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../report-core.js');

test('accepts Jira keys and rejects paths or markup', () => {
  assert.equal(core.issueKey(' kan-123 '), 'KAN-123');
  for (const key of ['', '123', '../KAN-1', '<b>KAN-1</b>', 'KAN-1/edit']) {
    assert.equal(core.issueKey(key), null);
  }
});

test('recognizes ticket pages and selected tickets in board URLs', () => {
  assert.equal(core.issueKeyFromUrl('https://team.atlassian.net/browse/KAN-42'), 'KAN-42');
  assert.equal(core.issueKeyFromUrl('https://team.atlassian.net/jira/software/projects/KAN/boards/1?selectedIssue=KAN-43'), 'KAN-43');
  assert.equal(core.issueKeyFromUrl('https://team.atlassian.net/browse/KAN-42?selectedIssue=KAN-43'), 'KAN-43');
  assert.equal(core.issueKeyFromUrl('https://team.atlassian.net/issues/KAN-44'), 'KAN-44');
  assert.equal(core.issueKeyFromUrl('https://team.atlassian.net/browse/KAN-44-OTHER'), null);
  assert.equal(core.issueKeyFromUrl('not a URL'), null);
});

test('extracts ADF text including breaks, lists, mentions and linked cards', () => {
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [
      { type: 'text', text: 'Acceptance criteria' }, { type: 'hardBreak' },
      { type: 'mention', attrs: { text: '@Tester' } },
    ] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verify login' }] }] },
    ] },
    { type: 'inlineCard', attrs: { url: 'https://example.test/spec' } },
  ] };
  const text = core.adfText(doc);
  assert.match(text, /Acceptance criteria\n@Tester\n/);
  assert.match(text, /Verify login/);
  assert.match(text, /https:\/\/example.test\/spec/);
  assert.equal(core.adfText(null), '');
  assert.equal(core.adfText('plain description'), 'plain description');
  const cycle = { type: 'doc' }; cycle.content = [cycle];
  assert.equal(core.adfText(cycle), '');
});

test('Done tickets still produce an explicitly untested report with actual metadata', () => {
  const report = core.buildReport({ key: 'KAN-42', fields: {
    summary: 'DST session validation', status: { name: 'Done' }, description: 'Verify session with a test clock',
  } }, { origin: 'https://team.atlassian.net', date: new Date('2026-11-02T00:00:00Z') });
  assert.match(report, /QA TEST REPORT — KAN-42/);
  assert.match(report, /https:\/\/team.atlassian.net\/browse\/KAN-42/);
  assert.match(report, /Jira status: Done/);
  assert.match(report, /Test result: NOT TESTED/);
  assert.match(report, /Ticket description for reference \(not verified\):\nVerify session/);
  assert.match(report, /2026-11-02T00:00:00.000Z/);
  assert.doesNotMatch(report, /Result: PASS|Result: FAIL/);
});

test('Vietnamese report requires real results and manual saving', () => {
  const report = core.buildReport({ key: 'KAN-42', fields: { summary: 'Kiểm tra đăng nhập' } }, {
    origin: 'https://team.atlassian.net', language: 'vi',
  });
  assert.match(report, /BÁO CÁO KIỂM TRA — KAN-42/);
  assert.match(report, /CHƯA KIỂM TRA/);
  assert.match(report, /tự nhấn Save/);
  assert.throws(() => core.buildReport({ key: '../invalid' }, { origin: 'https://team.atlassian.net' }));
});
