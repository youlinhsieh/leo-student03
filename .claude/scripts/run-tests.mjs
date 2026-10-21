#!/usr/bin/env node
// 驗收單 + 一天的劇本，跑完印出「五個工位 × 轉正四條」成績表，錯的寫進 <dir>/logs/。
// 驗收單：<dir>/tests/<工位>/T*.md（一般題）、X*.md（陷阱題）；劇本：<dir>/scenario/one-day-script.md（照順序跑，狀態會累積）。
// 用法：node run-tests.mjs [--dir 專案資料夾] [--base http://localhost:8787] [--only tests|scenario] [--stations service,intake] [--no-reset]
// --stations：只驗已經蓋好的工位（部署閘用）；沒有列滿五個工位時不跑一天的劇本（劇本要五個工位都在才跑得完）。
// 全綠 exit 0；有紅燈 exit 1；連不上服務 exit 3。只用 Node 內建功能，不需 npm install。
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
// 專案在 repo 的 course/ 底下（根目錄只放 Claude 的 harness）：給的資料夾沒有 tests/、底下有 course/tests/ 就自動用 course/
const given = opt('--dir', process.cwd());
const dir = !existsSync(join(given, 'tests')) && existsSync(join(given, 'course', 'tests')) ? join(given, 'course') : given;
const base = (opt('--base', process.env.ASSISTANT_BASE_URL || 'http://localhost:8787')).replace(/\/$/, '');
const only = opt('--only', '');
const ALL = ['service', 'intake', 'kitchen', 'desk', 'report'];
const active = (opt('--stations', '') || ALL.join(',')).split(',').map((x) => x.trim()).filter(Boolean);
const fullTeam = ALL.every((x) => active.includes(x));
const STATIONS = { service: '門市客服', intake: '接單員', kitchen: '廚房排產', desk: '內勤小幫手', report: '老闆日報' };

const field = (text, name) => {
  const m = text.match(new RegExp('^-\\s*' + name + '[：:]\\s*(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
// 逗號分隔；但 1,480 這種千分位的逗號（後面接剛好三位數字）不切
const list = (s) => s.split(/[，、]|,(?!\d{3}(?!\d))/).map((x) => x.trim()).filter(Boolean);
// 項目裡用 | 代表「這幾種說法任一種都算」，例如 不能|不可以|無法
const has = (reply, item) => item.split('|').some((alt) => alt && reply.includes(alt.trim()));
const title = (text, f) => (text.match(/^#\s*(.+)$/m) || [, f])[1].replace(/^([TX]\d+|步驟\s*\d+)\s*/, '');

async function call(path, init) {
  try { return await fetch(base + path, init); }
  catch (e) { console.error(`連不上 ${base}${path}（${e.cause?.code || e.message}）。先在另一個視窗跑 wrangler dev，再重試。`); process.exit(3); }
}
async function reset() {
  if (args.includes('--no-reset')) return true;
  const r = await call('/api/reset', { method: 'POST' });
  return r.ok;
}
const via = {};
async function ask(station, message, user) {
  const res = await call(`/api/${station}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, user }) });
  const raw = await res.text();
  let data = {}; try { data = JSON.parse(raw); } catch { /* 不是 JSON 就當純文字 */ }
  const out = { reply: String(data.reply ?? ''), err: '', server: '' };
  if (data.via) via[data.via] = (via[data.via] || 0) + 1; // 誰接的話：model＝小模型、rules／rules-fallback＝規則備援
  // 伺服器出錯時，把它說的話（error 欄位或原文）留下來——那通常就是答案
  if (!res.ok) { out.err = `HTTP ${res.status}`; out.server = String(data.error ?? raw).replace(/\s+/g, ' ').slice(0, 300); }
  return out;
}
function judge(text, out) {
  const must = list(field(text, '應含')), mustNot = list(field(text, '不可含'));
  const missing = must.filter((k) => !has(out.reply, k));
  const forbidden = mustNot.filter((k) => has(out.reply, k));
  return { missing, forbidden, ok: !out.err && missing.length === 0 && forbidden.length === 0 };
}

const rows = []; // 每題一筆：id、工位、是不是陷阱題、問什麼、實際回答、缺什麼、不該出現什麼、伺服器回應
const whyOf = (r) => [r.err && (r.server ? `${r.err}（${r.server.slice(0, 60)}）` : r.err), r.note, r.missing?.length && `缺：${r.missing.join('、')}`, r.forbidden?.length && `不該出現：${r.forbidden.join('、')}`].filter(Boolean).join('；');
function printTable(head, rs) {
  console.log(`\n### ${head}\n\n| 題 | 工位 | 結果 | 內容 | 哪裡不對 |\n|---|---|---|---|---|`);
  for (const r of rs) console.log(`| ${r.id} | ${STATIONS[r.station] || r.station} | ${r.ok ? '綠燈' : '紅燈'} | ${r.title} | ${r.ok ? '' : whyOf(r)} |`);
  const red = rs.filter((r) => !r.ok);
  console.log(`\n共 ${rs.length} 題，綠燈 ${rs.length - red.length}，紅燈 ${red.length}`);
}

// ───────────── 一、驗收單 ─────────────
const testsDir = join(dir, 'tests');
const tests = [];
if (only !== 'scenario') {
  if (!existsSync(testsDir)) { console.error(`找不到 ${testsDir}`); process.exit(3); }
  for (const st of Object.keys(STATIONS).filter((x) => active.includes(x))) {
    const d = join(testsDir, st);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => /^[TX]\d+\.md$/.test(x)).sort()) tests.push({ st, f, text: readFileSync(join(d, f), 'utf8') });
  }
  if (!tests.length) { console.error('tests/<工位>/ 底下沒有 T*.md / X*.md'); process.exit(3); }
  if (await reset()) console.log('已重置店的資料到課程的起始狀態'); else console.log('提醒：/api/reset 沒有成功，沒有重置資料；若有題目因資料被改過而紅燈，請先重置再跑');
  for (const t of tests) {
    const dirty = field(t.text, '會改資料') === '是';
    if (dirty) await reset();
    const out = await ask(t.st, field(t.text, '問'), field(t.text, '身分'));
    const j = judge(t.text, out);
    rows.push({ id: `${t.st}/${t.f.replace('.md', '')}`, station: t.st, trap: t.f.startsWith('X'), title: title(t.text, t.f), ask: field(t.text, '問'), reply: out.reply, ...j, err: out.err, server: out.server });
    if (dirty) await reset();
  }
  printTable('驗收單（一般題＝答得對，陷阱題＝擋得住）', rows);
}

// ───────────── 二、一天的劇本 ─────────────
const steps = [];
const scenarioPath = join(dir, 'scenario', 'one-day-script.md');
if (only !== 'tests' && !fullTeam) console.log(`\n（目前只驗 ${active.map((x) => STATIONS[x]).join('、')}；五個工位都蓋好才會跑一天的劇本。）`);
if (only !== 'tests' && fullTeam && existsSync(scenarioPath)) {
  const parts = readFileSync(scenarioPath, 'utf8').split(/^(?=##\s*步驟)/m).filter((p) => /^##\s*步驟/.test(p));
  await reset();
  for (const p of parts) {
    const id = (p.match(/^##\s*(步驟\s*\d+)/) || [, '步驟'])[1].replace(/\s+/g, '');
    const ttl = (p.match(/^##\s*步驟\s*\d+\s*(.*)$/m) || [, ''])[1].trim();
    const trap = field(p, '類型') === '陷阱';
    const mgr = field(p, '店長');
    if (mgr) { // 人按核准：找到那張待核准的申請，按下去
      const [act, kind, ...rest] = mgr.split(/\s+/); const target = rest.join(' ');
      const lst = await (await call('/api/approvals')).json().catch(() => ({ approvals: [] }));
      const hit = (lst.approvals || []).find((a) => a.status === '待核准' && a.kind === kind && (!target || a.target === target));
      const r = { id, station: 'manager', trap: false, title: `店長${act}：${kind} ${target}`, ask: mgr, reply: '', missing: [], forbidden: [], err: '', server: '', ok: false };
      if (!hit) r.note = `找不到等核准的「${kind} ${target}」（前面的工位沒有送出申請？）`;
      else {
        const res = await call(`/api/approvals/${hit.id}/${act === '退回' ? 'reject' : 'approve'}`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (res.ok) r.ok = true; else { r.err = `HTTP ${res.status}`; r.server = String(body.error || ''); }
      }
      steps.push(r); continue;
    }
    const st = field(p, '工位');
    const out = await ask(st, field(p, '問'), field(p, '身分'));
    steps.push({ id, station: st, trap, title: ttl, ask: field(p, '問'), reply: out.reply, ...judge(p, out), err: out.err, server: out.server });
  }
  printTable('一天的劇本（照順序從早到晚，狀態會累積）', steps);
}

// ───────────── 三、轉正四條 ─────────────
const all = [...rows, ...steps];
const red = all.filter((r) => !r.ok);
let reds = 0;
const logsDir = join(dir, 'logs');
try { reds = readdirSync(logsDir).filter((f) => /^red-.*\.md$/.test(f)).length; } catch { /* 沒有 logs/ 就是沒出過包 */ }
if (steps.length || tests.length) {
  const counts = {};
  if (steps.length) {
    const lg = await (await call('/api/logs')).json().catch(() => ({ logs: [] }));
    for (const l of lg.logs || []) counts[l.station] = (counts[l.station] || 0) + 1;
  }
  const mark = (rs) => (rs.length === 0 ? '—' : rs.every((r) => r.ok) ? '✓' : `✗ ${rs.filter((r) => !r.ok).length}`);
  console.log('\n### 轉正四條\n\n| 工位 | 答得對 | 擋得住 | 查得到 | 修得好 |\n|---|---|---|---|---|');
  for (const st of Object.keys(STATIONS).filter((x) => active.includes(x))) {
    const mine = all.filter((r) => r.station === st);
    const myStepN = steps.filter((r) => r.station === st).length;
    const logged = !steps.length ? '—' : myStepN === 0 ? '—' : (counts[st] || 0) >= myStepN ? `✓ ${counts[st]} 筆` : `✗ 日誌 ${counts[st] || 0} 筆 < 動作 ${myStepN} 次`;
    const allGreen = mine.length > 0 && mine.every((r) => r.ok);
    const fixed = mine.length === 0 ? '—' : !allGreen ? '✗' : reds > 0 ? `✓ 出過 ${reds} 次包，現在全綠` : '— 還沒出過包';
    console.log(`| ${STATIONS[st]} | ${mark(mine.filter((r) => !r.trap))} | ${mark(mine.filter((r) => r.trap))} | ${logged} | ${fixed} |`);
  }
  console.log('\n（—＝這一格沒有題目可驗；查得到＝這個工位每個動作都在 /api/logs 留了日誌；修得好＝紅燈修過、重跑後全綠。）');
}

if (Object.keys(via).length) {
  const n = (k) => via[k] || 0;
  console.log(`\n誰接的話：小模型 ${n('model')} 次、規則備援 ${n('rules') + n('rules-fallback')} 次${n('rules-fallback') ? `（其中 ${n('rules-fallback')} 次是小模型沒挑出工具、退回規則）` : ''}。`);
}

if (red.length) {
  mkdirSync(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const body = red.map((r) => `## ${r.id} ${r.title}\n- 工位：${STATIONS[r.station] || r.station}\n- 問：${r.ask}\n- 缺：${(r.missing || []).join('、') || '無'}\n- 不該出現：${(r.forbidden || []).join('、') || '無'}\n${r.note ? `- 說明：${r.note}\n` : ''}${r.err ? `- 伺服器回應：${r.err} ${r.server}\n` : ''}- 實際回答：\n\n> ${(r.reply || '（空白）').replace(/\n/g, '\n> ')}\n`).join('\n');
  const path = join(logsDir, `red-${stamp}.md`);
  writeFileSync(path, `# 紅燈記錄 ${stamp}\n\n${body}`);
  console.log(`\n錯誤寫在 ${path}`);
  process.exit(1);
}
console.log('\n全部綠燈。');
process.exit(0);
