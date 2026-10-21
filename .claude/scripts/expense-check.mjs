#!/usr/bin/env node
// 報帳檢查（expense-report 技能用）
//   node .claude/scripts/expense-check.mjs <expenses.csv>   檢查明細
//   node .claude/scripts/expense-check.mjs --page <掃描檔>   檢查是不是 A4（PDF／PNG／JPG）
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const COLUMNS = ['序號', '掃描檔', '頁/位置', '發票日期', '發票號碼', '賣方名稱', '賣方統編', '買方統編',
  '品項摘要', '未稅金額', '稅額', '總金額', '用途分類', '報帳人', '辨識信心', '備註', '狀態'];
const CATEGORIES = ['食材', '包材', '設備', '水電瓦斯', '交通', '雜支'];
const STATUSES = ['待確認', '已確認', '已寄出'];
const A4_RATIO = 297 / 210;

// ---------- CSV ----------
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

function readRecords(file) {
  const [header, ...body] = parseCsv(readFileSync(file, 'utf8'));
  return { header, records: body.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

// ---------- 規則 ----------
// 營業人統一編號檢查碼（財政部 2023 起：加權和可被 5 整除；第 7 碼為 7 時另有一種算法）
function validTaxId(id) {
  if (!/^\d{8}$/.test(id)) return false;
  const w = [1, 2, 1, 2, 1, 2, 4, 1];
  const sum = [...id].reduce((s, d, i) => {
    const p = Number(d) * w[i];
    return s + Math.floor(p / 10) + (p % 10);
  }, 0);
  return sum % 5 === 0 || (id[6] === '7' && (sum + 1) % 5 === 0);
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isInt = (s) => /^\d+$/.test(s);

function invoiceNumbersElsewhere(file) {
  // course/expenses/ 底下其他月份已經報過的發票號碼
  const root = dirname(dirname(resolve(file)));
  const seen = new Map();
  if (!existsSync(root)) return seen;
  for (const month of readdirSync(root, { withFileTypes: true })) {
    if (!month.isDirectory()) continue;
    const other = join(root, month.name, 'expenses.csv');
    if (resolve(other) === resolve(file) || !existsSync(other)) continue;
    for (const r of readRecords(other).records) if (r['發票號碼']) seen.set(r['發票號碼'], `${month.name} 第 ${r['序號']} 列`);
  }
  return seen;
}

function checkCsv(file) {
  const { header, records } = readRecords(file);
  const errors = [], warnings = [];
  const missing = COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    console.log(`✗ 欄位缺少：${missing.join('、')}`);
    console.log('結論：欄位不對，先照技能說明的欄位名重寫第一行');
    process.exit(1);
  }

  const elsewhere = invoiceNumbersElsewhere(file);
  const seen = new Map();
  let total = 0, pending = 0, pendingTotal = 0;

  for (const r of records) {
    const at = `第 ${r['序號'] || '?'} 列`;
    const err = (m) => errors.push(`${at}：${m}`);
    const warn = (m) => warnings.push(`${at}：${m}`);

    if (!r['掃描檔']) err('沒有掃描檔（沒貼 A4 掃描的不收）');
    if (!validDate(r['發票日期'])) err(`發票日期「${r['發票日期']}」要寫成 YYYY-MM-DD`);
    else if (r['發票日期'] > new Date().toISOString().slice(0, 10)) err(`發票日期 ${r['發票日期']} 在未來`);

    const no = r['發票號碼'];
    if (no) {
      if (!/^[A-Z]{2}\d{8}$/.test(no)) err(`發票號碼「${no}」應為兩個大寫英文字母＋八位數字`);
      if (seen.has(no)) err(`發票號碼 ${no} 跟${seen.get(no)}重複（同一張報兩次）`);
      if (elsewhere.has(no)) err(`發票號碼 ${no} 已在 ${elsewhere.get(no)} 報過`);
      seen.set(no, at);
    } else if (!/收據/.test(r['備註'])) warn('沒有發票號碼，備註也沒寫「收據」');

    for (const k of ['賣方統編', '買方統編']) if (r[k] && !validTaxId(r[k])) err(`${k}「${r[k]}」檢查碼不對（多半是看錯一位數）`);

    const [net, tax, sum] = ['未稅金額', '稅額', '總金額'].map((k) => r[k]);
    for (const [k, v] of [['未稅金額', net], ['稅額', tax], ['總金額', sum]]) if (v && !isInt(v)) err(`${k}「${v}」只能是整數，不加逗號或「元」`);
    if (!sum) err('沒有總金額');
    else if (isInt(sum)) {
      if (net && tax && isInt(net) && isInt(tax) && Number(net) + Number(tax) !== Number(sum)) err(`未稅 ${net} ＋ 稅額 ${tax} ≠ 總金額 ${sum}`);
      if (Number(sum) === 0) err('總金額是 0');
      total += Number(sum);
      if (r['狀態'] === '待確認') { pending++; pendingTotal += Number(sum); }
    }

    if (!CATEGORIES.includes(r['用途分類'])) err(`用途分類「${r['用途分類']}」要從 ${CATEGORIES.join('／')} 挑`);
    if (!['高', '低'].includes(r['辨識信心'])) err('辨識信心要填「高」或「低」');
    else if (r['辨識信心'] === '低') warn(`辨識信心低：${r['備註'] || '（備註沒寫看不清哪裡）'}`);
    if (!STATUSES.includes(r['狀態'])) err(`狀態「${r['狀態']}」要是 ${STATUSES.join('／')}`);
    if (!r['報帳人']) warn('沒寫報帳人');
  }

  for (const m of errors) console.log(`✗ ${m}`);
  for (const m of warnings) console.log(`△ ${m}`);
  console.log(`共 ${records.length} 張，合計 $${total}；待確認 ${pending} 張，合計 $${pendingTotal}`);
  if (errors.length) {
    console.log(`結論：有 ${errors.length} 個錯，先回去看掃描檔改正（看不清就留空標「低」，不要猜）`);
    process.exit(1);
  }
  console.log(warnings.length ? `結論：可以給人看，但有 ${warnings.length} 個提醒要放在最上面` : '結論：檢查通過，可以給人看');
}

// ---------- A4 ----------
function pageSize(file) {
  const buf = readFileSync(file);
  if (buf.subarray(0, 4).toString() === '%PDF') {
    const sizes = [...buf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)]
      .map((m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]);
    return sizes.length ? { kind: 'pdf', sizes } : null;
  }
  if (buf.readUInt32BE(0) === 0x89504e47) return { kind: 'image', sizes: [[buf.readUInt32BE(16), buf.readUInt32BE(20)]] };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { kind: 'image', sizes: [[buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]] };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function checkPage(file) {
  const info = pageSize(file);
  if (!info) {
    console.log('結論：認不出檔案的尺寸（只收 PDF／PNG／JPG），請重新掃描成 PDF');
    process.exit(1);
  }
  let bad = 0;
  info.sizes.forEach(([w, h], i) => {
    const ratio = Math.max(w, h) / Math.min(w, h);
    // PDF 再比實際尺寸（A4 ≈ 595×842 pt），圖片只能比長寬比
    const sizeOk = info.kind !== 'pdf' || (Math.abs(Math.min(w, h) - 595) < 20 && Math.abs(Math.max(w, h) - 842) < 20);
    const ok = Math.abs(ratio - A4_RATIO) < 0.04 && sizeOk;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} 第 ${i + 1} 頁 ${Math.round(w)}×${Math.round(h)}（長寬比 ${ratio.toFixed(3)}，A4 是 ${A4_RATIO.toFixed(3)}）`);
  });
  if (bad) {
    console.log(`結論：有 ${bad} 頁不是 A4，請把發票貼在 A4 紙上重掃`);
    process.exit(1);
  }
  console.log('結論：是 A4 掃描，可以辨識');
}

const args = process.argv.slice(2);
if (args[0] === '--page' && args[1]) checkPage(args[1]);
else if (args[0] && args[0] !== '--page') checkCsv(args[0]);
else {
  console.log('用法：expense-check.mjs <expenses.csv>　或　expense-check.mjs --page <掃描檔>');
  process.exit(2);
}
