// 小模型接話員（參考解答）：聽懂人話 → 從「這個工位拿得到的工具」裡挑一個 → 填好參數。
// 小模型只做這一件事。價格、前置天數、產能、退訂比例、誰能做什麼，全在 core.js 的程式裡；
// 工位沒有的工具（刪除、核准、改價）不在菜單上，小模型想挑也挑不到，挑到菜單外的名字一律當「做不到」。
// 模型掛了、逾時、回得亂七八糟 → 回 null，由 core.js 退回規則備援（所以沒接模型時整套照樣能跑）。

export const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'; // 8B 小模型，Workers AI 免費額度內；換模型改 wrangler.toml 的 MODEL

const CJK = /^[一-鿿]{1,5}$/;
const SANITIZE = {
  int: (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n >= 1 && n <= 999 ? n : null; },
  name: (v) => (typeof v === 'string' && CJK.test(v.trim()) ? v.trim() : null),
  phone: (v) => { const d = String(v ?? '').replace(/\D/g, ''); return /^09\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : null; },
  date: (v) => (typeof v === 'string' && /^20\d\d-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null),
  rid: (v) => { const m = String(v ?? '').toUpperCase().match(/R-\d{3,}/); return m ? m[0] : null; },
  oid: (v) => { const m = String(v ?? '').toUpperCase().match(/LEO-\d{4}-\d{3}/); return m ? m[0] : null; },
  discount: (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n < 10 ? n : null; },
  text: (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null),
};
const TYPE_HINT = { int: '整數', name: '稱呼(中文)', phone: '手機號碼', date: '日期 YYYY-MM-DD', rid: '需求編號 R-001', oid: '訂單編號 LEO-2610-001', discount: '幾折(8 代表 8 折)', text: '文字' };

function clean(spec, raw) {
  const out = {};
  for (const [k, t] of Object.entries(spec || {})) {
    const v = raw?.[k];
    if (v === undefined || v === null || v === '' || v === 'null') { out[k] = null; continue; }
    out[k] = Array.isArray(t) ? (t.includes(v) ? v : null) : (SANITIZE[t] ? SANITIZE[t](v) : null);
  }
  return out;
}

function menu(agent) {
  return Object.entries(agent.tools).map(([name, t]) => {
    const a = Object.entries(t.args || {}).map(([k, ty]) => `${k}:${Array.isArray(ty) ? ty.join('|') : TYPE_HINT[ty] || ty}`).join(', ');
    return `- ${name} {${a}}　${t.desc}`;
  }).join('\n');
}

export function buildMessages(agent, text, today, actor) {
  const sys = [
    `你是${agent.role}。對方用日常說話的方式講一件事，你只能從下面的工具選一個，輸出一行 JSON：{"tool":"工具名","args":{…}}。不要解釋、不要多餘的字。`,
    '規則：沒提到的欄位填 null，不要猜、不要編；做不到或不是這個工位的事，選 decline。',
    '工具：', menu(agent),
    `今天是 ${today}。${actor ? `說話的人：${actor}。` : ''}`,
  ].join('\n');
  const msgs = [{ role: 'system', content: sys }];
  for (const [q, a] of agent.examples || []) { msgs.push({ role: 'user', content: q }); msgs.push({ role: 'assistant', content: JSON.stringify(a) }); }
  msgs.push({ role: 'user', content: text });
  return msgs;
}

function firstJson(s) {
  const i = s.indexOf('{'); if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; } }
  }
  return null;
}
const textOf = (out) => String(out?.response ?? out?.choices?.[0]?.message?.content ?? out?.result?.response ?? '');

// 回 { tool, args } 或 null（模型不可用／亂回）。tool 不在菜單上 → 'decline'（挑到不存在的工具＝做不到）。
export async function pickTool(env, agent, text, today, actor) {
  const model = env.MODEL || DEFAULT_MODEL;
  const call = env.AI.run(model, { messages: buildMessages(agent, text, today, actor), max_tokens: 220, temperature: 0 });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('小模型逾時')), Number(env.MODEL_TIMEOUT_MS || 20000)));
  const raw = textOf(await Promise.race([call, timeout]));
  const j = firstJson(raw);
  if (!j || typeof j.tool !== 'string') return null;
  const { tool, args, ...rest } = j;
  const spec = agent.tools[tool];
  if (!spec) return { tool: 'decline', args: { category: null }, model, raw };
  return { tool, args: clean(spec.args, args && typeof args === 'object' ? args : rest), model, raw };
}
