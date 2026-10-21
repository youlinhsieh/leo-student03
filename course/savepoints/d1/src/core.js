// D1 存檔點（知識庫已接好、門市客服上線並過了自己的驗收單（D1 收場的狀態））。由課程維護者從參考解答切出來；學員不必讀它，叫 CC 從存檔點接著做即可。
// 里歐烘焙坊｜五個工位的參考解答（講師用，不進學員 repo）
// 原則：能用程式判斷的不交給小模型。產能、前置天數、加價、退訂比例、誰能做什麼，全寫在這裡的程式裡；
//       小模型（Workers AI）只在「規則文字問答」查不到時才被叫來，而且只准依規則文字回答。
// 不依賴 Cloudflare：只吃 env.DB（D1 介面）與 env.AI（可有可無）。本機 mock-server 用 node:sqlite 假裝 D1 跑同一份。
import { parseCsv } from './csv.js';
import { pickTool } from './agent.js';

// ───────────── 規則（阿珠姨的筆記的程式版；改規則兩邊都要改） ─────────────
const SIZE = { '6吋': { price: 680, pts: 2 }, '8吋': { price: 980, pts: 3 }, '10吋': { price: 1380, pts: 5 } };
const FLAVOR = { '香草': 0, '巧克力': 0, '芒果': 100, '抹茶紅豆': 80 };
const SHAPE = { '一般': { add: 0, lead: 2, rushMin: 1 }, '進階': { add: 400, lead: 4, rushMin: 2 }, '師傅確認級': { add: 1000, lead: 7, rushMin: null } };
const BOX = { '彌月禮盒': 880, '喜餅禮盒': 1200 };
const DEPOSIT = { cake: 0.3, box: 0.5 };
const RUSH_FEE = 0.3;
const OVEN_PTS = 15, CHEF_PTS = 5, MIN_CHEFS = 2;
const CHANGE_DEADLINE_DAYS = 3;
const MATERIAL = { // 每 1 點的備料
  cake: { 麵粉kg: 0.3, 奶油kg: 0.15, 雞蛋顆: 4, 鮮奶油L: 0.2 },
  box: { 麵粉kg: 0.25, 奶油kg: 0.12, 雞蛋顆: 2, 鮮奶油L: 0 },
};
const ACTIVE = ['待收訂金', '已收訂金', '排產中'];
const STATIONS = { service: '門市客服', intake: '接單員', kitchen: '廚房排產', desk: '內勤小幫手', report: '老闆日報' };

const boxLead = (qty) => (qty <= 30 ? 5 : 10);
const boxRushMin = (qty) => (qty <= 30 ? 3 : null);
const groupFactor = (qty) => (qty >= 50 ? 0.85 : qty >= 20 ? 0.9 : 1);
const factorLabel = (f) => ({ 1: '無折扣', 0.9: '9 折', 0.85: '85 折' }[f] || `${Math.round(f * 100) / 10} 折`);

// ───────────── 小工具 ─────────────
const nt = (n) => 'NT$ ' + Number(n).toLocaleString('en-US');
const pad = (n) => String(n).padStart(2, '0');
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const CN = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const num = (s) => (/^\d+$/.test(s) ? Number(s) : CN[s] ?? NaN);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

function parseDate(t, today) {
  if (/大後天/.test(t)) return addDays(today, 3);
  if (/後天/.test(t)) return addDays(today, 2);
  if (/明天/.test(t)) return addDays(today, 1);
  if (/今天|今日/.test(t)) return today;
  let m = t.match(/(20\d\d)-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${today.slice(0, 4)}-${pad(m[1])}-${pad(m[2])}`;
  return null;
}
const parseSize = (t) => { const m = t.match(/(10|[68]|六|八|十)\s*(?:吋|寸)/); if (!m) return null; const n = num(m[1]); return n + '吋'; };
const parseFlavor = (t) => (t.includes('抹茶') ? '抹茶紅豆' : Object.keys(FLAVOR).find((f) => t.includes(f)) || null);
function parseShape(t) {
  if (/師傅確認|3D|人物|動物|公仔|多層|貓咪|玩偶/.test(t)) return '師傅確認級';
  if (/進階|翻糖|立體/.test(t)) return '進階';
  return '一般';
}
const parseQty = (t, units) => { const m = t.match(new RegExp('(\\d+|[一二兩三四五六七八九十])\\s*(?:' + units + ')')); return m ? num(m[1]) : null; };
const parsePhone = (t) => { const m = t.match(/09\d{2}[- ]?\d{3}[- ]?\d{3}/); if (!m) return null; const d = m[0].replace(/\D/g, ''); return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`; };
function parseName(t) {
  let m = t.match(/(?:我是|我叫|我姓)\s*([一-鿿]{1,5})/);
  if (m) { let n = m[1]; for (const stop of ['要', '想', '訂', '的', '電話', '手機']) { const i = n.indexOf(stop); if (i > 0) n = n.slice(0, i); } return n; }
  m = t.match(/([一-鿿])(小姐|先生|太太|媽媽)/);
  return m ? m[1] + m[2] : null;
}
function parseDiscount(t) {
  let m = t.match(/(\d(?:\.\d)?)\s*折/);
  if (m) { const v = Number(m[1]); return v >= 10 ? v / 100 : v >= 1 ? v / 10 : null; }
  m = t.match(/([一二兩三四五六七八九])\s*([一二三四五六七八九])?\s*折/);
  if (m) return (num(m[1]) * 10 + (m[2] ? num(m[2]) : 0)) / (m[2] ? 100 : 10);
  m = t.match(/(\d{2})\s*%/); return m ? Number(m[1]) / 100 : null;
}

// 報價（純計算，不碰資料庫）
export function quoteCake({ size, flavor = '香草', shape = '一般', qty = 1 }) {
  const s = SIZE[size]; if (!s) return null;
  const unit = s.price + (FLAVOR[flavor] ?? 0) + SHAPE[shape].add;
  const amount = unit * qty;
  return { unit, qty, amount, deposit: Math.round(amount * DEPOSIT.cake), points: s.pts * qty, lead: SHAPE[shape].lead, rushMin: SHAPE[shape].rushMin, type: 'cake', rate: DEPOSIT.cake };
}
export function quoteBox({ kind, qty }) {
  const p = BOX[kind]; if (!p) return null;
  const f = groupFactor(qty); const amount = Math.round(p * qty * f);
  return { unit: p, qty, factor: f, list: p * qty, amount, deposit: Math.round(amount * DEPOSIT.box), points: qty, lead: boxLead(qty), rushMin: boxRushMin(qty), type: 'box', rate: DEPOSIT.box };
}

// ───────────── 資料庫 ─────────────
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, type TEXT, customer_id TEXT, item TEXT, size TEXT, flavor TEXT, shape TEXT, qty INTEGER, points INTEGER, amount INTEGER, deposit INTEGER, status TEXT, order_date TEXT, due_date TEXT, rush INTEGER DEFAULT 0, note TEXT DEFAULT \'\', refund INTEGER DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS customers (customer_id TEXT PRIMARY KEY, name TEXT, phone TEXT, kind TEXT, note TEXT)',
  'CREATE TABLE IF NOT EXISTS requests (request_id TEXT PRIMARY KEY, customer_name TEXT, phone TEXT, type TEXT, item TEXT, size TEXT, flavor TEXT, shape TEXT, qty INTEGER, due_date TEXT, status TEXT, chef_ok INTEGER DEFAULT 0, order_id TEXT, day TEXT)',
  'CREATE TABLE IF NOT EXISTS approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, target TEXT, summary TEXT, detail TEXT, status TEXT, requested_by TEXT, day TEXT, decided_at TEXT)',
  'CREATE TABLE IF NOT EXISTS equipment (equipment_id TEXT PRIMARY KEY, name TEXT, kind TEXT, status TEXT, fault_date TEXT, note TEXT DEFAULT \'\')',
  'CREATE TABLE IF NOT EXISTS shifts (date TEXT, staff_id TEXT, status TEXT, PRIMARY KEY (date, staff_id))',
  'CREATE TABLE IF NOT EXISTS clock (date TEXT, staff_id TEXT, clock_in TEXT, clock_out TEXT, PRIMARY KEY (date, staff_id))',
  'CREATE TABLE IF NOT EXISTS tg_chats (chat_id TEXT PRIMARY KEY, station TEXT, pending TEXT, updated TEXT)',
  'CREATE TABLE IF NOT EXISTS work_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, day TEXT, station TEXT, actor TEXT, action TEXT, target TEXT, result TEXT, summary TEXT, data TEXT)',
];

export function createApp(data) {
  const products = parseCsv(data.products);
  const staff = parseCsv(data.staff);
  const csvOrders = parseCsv(data.orders), csvCustomers = parseCsv(data.customers);
  const csvEquip = parseCsv(data.equipment), csvShifts = parseCsv(data.shifts);
  const staffByName = (n) => { if (!n) return null; n = String(n).trim(); return staff.find((s) => s.name === n || (n === '店長' && s.role === '店長')) || null; };
  const chefs = staff.filter((s) => s.role === '師傅');

  const today = (env) => env.SHOP_TODAY || '2026-10-21';
  const P = (env, sql, ...a) => env.DB.prepare(sql).bind(...a);
  const one = (env, sql, ...a) => P(env, sql, ...a).first();
  const all = async (env, sql, ...a) => (await P(env, sql, ...a).all()).results || [];
  const run = (env, sql, ...a) => P(env, sql, ...a).run();

  let ready = false;
  async function ensure(env) {
    if (ready) return;
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    const { n } = await one(env, 'SELECT COUNT(*) AS n FROM orders');
    if (n === 0) await reset(env);
    ready = true;
  }
  async function reset(env) {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    const st = ['orders', 'customers', 'requests', 'approvals', 'equipment', 'shifts', 'clock', 'work_log'].map((t) => P(env, `DELETE FROM ${t}`));
    for (const o of csvOrders) st.push(P(env, 'INSERT INTO orders (order_id,type,customer_id,item,size,flavor,shape,qty,points,amount,deposit,status,order_date,due_date,rush,note,refund) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
      o.order_id, o.type, o.customer_id, o.item, o.size, o.flavor, o.shape, Number(o.qty), Number(o.points), Number(o.amount), Number(o.deposit), o.status, o.order_date, o.due_date, Number(o.rush), o.note));
    for (const c of csvCustomers) st.push(P(env, 'INSERT INTO customers VALUES (?,?,?,?,?)', c.customer_id, c.name, c.phone, c.kind, c.note));
    for (const e of csvEquip) st.push(P(env, 'INSERT INTO equipment (equipment_id,name,kind,status,fault_date,note) VALUES (?,?,?,?,NULL,\'\')', e.equipment_id, e.name, e.kind, e.status));
    for (const s of csvShifts) st.push(P(env, 'INSERT INTO shifts VALUES (?,?,?)', s.date, s.staff_id, s.status));
    await env.DB.batch(st);
  }

  // ───────────── 工作日誌（五個工位每個動作都記） ─────────────
  async function log(env, station, actor, action, target, result, summary, d = {}) {
    await run(env, 'INSERT INTO work_log (ts,day,station,actor,action,target,result,summary,data) VALUES (?,?,?,?,?,?,?,?,?)',
      new Date().toISOString(), today(env), station, actor || '', action, target || '', result, summary, JSON.stringify(d));
  }
  const ok = async (env, st, actor, action, target, summary, d) => log(env, st, actor, action, target, 'ok', summary, d);
  const blocked = async (env, st, actor, action, target, summary, d) => log(env, st, actor, action, target, 'blocked', summary, d);
  // 「這個工位沒有這個工具」：記一筆被擋下的日誌，回該說的話
  const decline = async (env, st, actor, t, d) => { await blocked(env, st, actor, d.action, d.target || '', `${d.why}：「${t.slice(0, 40)}」`); return d.text; };
  // 小模型挑工具共用的小幫手：先用程式從原話抓得到的（日期、編號、尺寸），抓不到才用小模型填的
  const pref = (fromText, fromModel) => (fromText ?? fromModel ?? null);
  // 小模型填的值要「原話裡真的有」才算數——它會把沒說的欄位湊一個合理的值（例如把今天當取貨日）。沒說的欄位要留空，讓工位去追問。
  const DATE_WORD = /\d\s*[號日月\/]|今天|明天|後天|週|星期|禮拜/;
  const gdate = (t, m, env) => parseDate(t, today(env)) ?? (m && DATE_WORD.test(t) ? m : null);
  const gname = (t, m) => parseName(t) ?? (m && t.includes(m) ? m : null);
  const gphone = (t, m) => parsePhone(t) ?? (m && t.replace(/\D/g, '').includes(m.replace(/\D/g, '')) ? m : null);
  const gin = (t, parsed, m, cut) => parsed ?? (m && t.includes(cut ? m.slice(0, -1) : m) ? m : null); // 尺寸去掉「吋」比，口味整個比
  const gint = (t, parsed, m) => parsed ?? (m && t.includes(String(m)) ? m : null);

  // ───────────── 產能與排產 ─────────────
  async function capacity(env, date) {
    const ovens = (await all(env, "SELECT * FROM equipment WHERE kind='烤箱'"));
    const ovensOk = ovens.filter((e) => !(e.status === '報修中' && e.fault_date && e.fault_date <= date)).length;
    const off = new Set((await all(env, "SELECT staff_id FROM shifts WHERE date=? AND status='休'", date)).map((r) => r.staff_id));
    const present = chefs.filter((c) => !off.has(c.staff_id));
    return { date, ovens_total: ovens.length, ovens_ok: ovensOk, chefs_present: present.length, chef_names: present.map((c) => c.name), capacity: ovensOk * OVEN_PTS + present.length * CHEF_PTS };
  }
  async function usedPoints(env, date, exceptId) {
    const r = await one(env, `SELECT COALESCE(SUM(points),0) AS n FROM orders WHERE due_date=? AND status IN ('待收訂金','已收訂金','排產中') AND order_id<>?`, date, exceptId || '');
    return r.n;
  }
  async function schedule(env, date) {
    const cap = await capacity(env, date);
    const lines = await all(env, `SELECT o.order_id, o.type, o.item, o.qty, o.points, o.status, c.name AS customer FROM orders o LEFT JOIN customers c ON c.customer_id=o.customer_id WHERE o.due_date=? AND o.status IN ('待收訂金','已收訂金','排產中') ORDER BY o.order_id`, date);
    const used = lines.reduce((a, l) => a + l.points, 0);
    const mat = {};
    for (const l of lines) for (const [k, v] of Object.entries(MATERIAL[l.type])) mat[k] = Math.round(((mat[k] || 0) + v * l.points) * 100) / 100;
    return { ...cap, used, over: Math.max(0, used - cap.capacity), is_over: used > cap.capacity, lines, materials: mat };
  }
  async function nextFreeDate(env, from, need) {
    for (let i = 1; i <= 14; i++) {
      const d = addDays(from, i); const c = await capacity(env, d);
      if (c.capacity - (await usedPoints(env, d)) >= need) return d;
    }
    return null;
  }

  // ───────────── 共用查詢 ─────────────
  const getOrder = (env, id) => one(env, 'SELECT o.*, c.name AS customer FROM orders o LEFT JOIN customers c ON c.customer_id=o.customer_id WHERE o.order_id=?', id);
  async function nextId(env, table, col, prefix, width) {
    const r = await all(env, `SELECT ${col} AS id FROM ${table} WHERE ${col} LIKE ?`, prefix + '%');
    const mx = r.reduce((a, x) => Math.max(a, Number(String(x.id).slice(prefix.length)) || 0), 0);
    return prefix + String(mx + 1).padStart(width, '0');
  }
  async function addApproval(env, kind, target, summary, d, who, station) {
    const dup = await one(env, "SELECT id FROM approvals WHERE kind=? AND target=? AND status='待核准'", kind, target);
    if (dup) return { dup: dup.id };
    const r = await run(env, 'INSERT INTO approvals (kind,target,summary,detail,status,requested_by,day) VALUES (?,?,?,?,?,?,?)', kind, target, summary, JSON.stringify(d), '待核准', who || '', today(env));
    const id = r.meta?.last_row_id;
    await log(env, station, who, 'request_approval', target, 'pending', `${kind}申請：${summary}`, { approval_id: id, kind, ...d });
    return { id };
  }
  const orderText = (o) => `${o.order_id}（${o.customer || o.customer_id}，${o.item}${o.type === 'box' ? ' ×' + o.qty : o.qty > 1 ? ' ×' + o.qty : ''}）`;

  // ═════════════ 工位一：門市客服（對外） ═════════════
  const SERVICE_DECLINE = {
    discount: { action: 'refuse_discount', why: '客人要折扣，客服不能答應', text: '折扣我沒辦法答應：只有禮盒團購折扣（20 盒以上 9 折、50 盒以上 85 折）可以直接算，其他折扣要店長核准，我可以幫你記下，由店長決定。' },
    order_info: { action: 'refuse_lookup', why: '客人要查訂單／個資，客服沒有這個能力', text: '為了保護客人資料，我不能查或透露任何訂單內容與電話。訂單進度請洽門市，由店員確認你的身分後協助。' },
    privileged_action: { action: 'refuse_action', why: '客服沒有這個能力', text: '這個我不能做：客服只能回答問題、報價、收下需求。刪除、核准、改價都不在我的權限內。' },
  };
  const FAQ = [
    [/營業|開門|幾點|地址|門市在哪|哪裡買/, () => '中山店、大安店每天 08:00–20:00 營業。定做的蛋糕與禮盒到門市取貨，取貨日以訂單約定為準。'],
    [/團購|團訂|折扣|優惠|折數/, () => '禮盒團購折扣：20 盒以上 9 折、50 盒以上 85 折。客製蛋糕沒有折扣。表外的折扣我不能答應，需要店長核准。'],
    [/退訂|退款|退錢|取消|不要了/, () => '退訂規則：離交期 7 天（含）以上，退全額訂金；3–6 天，退訂金的一半；2 天內，訂金不退。取消要由接單員送出申請、店長核准後才生效。'],
    [/改單|改訂單|更改|換口味|改口味|改日期|改尺寸/, () => `改單截止是交期前 ${CHANGE_DEADLINE_DAYS} 天（含當天往前算）；過了截止就不能改，請改由退訂重訂處理。`],
    [/訂金|預付|付多少/, () => '訂金：客製蛋糕 3 成，團訂禮盒 5 成，成立訂單後收取。'],
    [/加急|趕單|來不及|急單|趕時間/, () => `前置天數不足就算加急：加急費 ${RUSH_FEE * 100}%，要店長核准。一般造型最短 1 天、進階造型最短 2 天、禮盒（30 盒以內）最短 3 天；師傅確認級造型與超過 30 盒的禮盒不收加急。`],
    [/提前|前置|多久|幾天|多早|什麼時候要訂|要訂多久/, () => `前置天數：一般造型 ${SHAPE['一般'].lead} 天、進階造型 ${SHAPE['進階'].lead} 天、師傅確認級造型 ${SHAPE['師傅確認級'].lead} 天；禮盒 30 盒以內 5 天、超過 30 盒 10 天。少於前置天數就是加急。`],
    [/尺寸|口味|造型|選項|客製有什麼|可以選/, () => '客製蛋糕選項：尺寸 6 吋 NT$ 680、8 吋 NT$ 980、10 吋 NT$ 1,380；口味 香草、巧克力（+0）、芒果（+100，季節限定）、抹茶紅豆（+80）；造型 一般（+0）、進階（+400）、師傅確認級（+1,000，例如 3D 人物動物，要師傅確認才接）。'],
  ];

  async function aiAsk(env, question) {
    if (!env.AI) return null;
    const out = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是里歐烘焙坊的門市客服。只能依下面「店的規則」用繁體中文一句話回答，並沿用規則裡的用詞；規則沒提到就說「這個我查不到，請洽門市」。不准答應折扣、不准查別人的訂單。\n\n店的規則：\n' + data.rules },
        { role: 'user', content: question },
      ],
      max_tokens: 200,
    });
    return String(out.response || '').trim() || null;
  }

  async function takeRequest(env, t, actor) {
    const name = parseName(t), phone = parsePhone(t), due = parseDate(t, today(env));
    const isBox = /禮盒/.test(t);
    const size = parseSize(t), qty = parseQty(t, isBox ? '盒|份' : '個|顆|份|盒');
    const miss = [];
    if (!isBox && !size) miss.push('尺寸（6 吋、8 吋或 10 吋）');
    if (isBox && !qty) miss.push('要幾盒');
    if (!due) miss.push('取貨日期');
    if (!name) miss.push('怎麼稱呼');
    if (!phone) miss.push('聯絡電話');
    if (miss.length) { await ok(env, 'service', actor, 'ask_missing', '', `需求還缺：${miss.join('、')}`); return `想幫你記下需求，還需要：${miss.join('、')}。`; }
    let spec, q;
    if (isBox) {
      const kind = /喜餅/.test(t) ? '喜餅禮盒' : '彌月禮盒'; q = quoteBox({ kind, qty });
      spec = { type: 'box', item: kind, size: '', flavor: '', shape: '', qty };
    } else {
      const flavor = parseFlavor(t) || '香草', shape = parseShape(t), n = qty || 1;
      q = quoteCake({ size, flavor, shape, qty: n });
      if (!q) return `我們沒有 ${size} 的尺寸，客製蛋糕有 6 吋、8 吋、10 吋。`;
      spec = { type: 'cake', item: `${size}${flavor}蛋糕（${shape}造型）`, size, flavor, shape, qty: n };
    }
    const id = await nextId(env, 'requests', 'request_id', 'R-', 3);
    await run(env, 'INSERT INTO requests (request_id,customer_name,phone,type,item,size,flavor,shape,qty,due_date,status,chef_ok,order_id,day) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,\'\',?)',
      id, name, phone, spec.type, spec.item, spec.size, spec.flavor, spec.shape, spec.qty, due, '待轉單', today(env));
    await ok(env, 'service', actor, 'take_request', id, `收下需求 ${id}：${name} ${spec.item}×${spec.qty} 取貨 ${due}，報價 ${nt(q.amount)}`, { request_id: id, amount: q.amount, due });
    const need = spec.shape === '師傅確認級' ? '這個造型要師傅確認才接，確認前不會成立訂單。' : '';
    return `已收下需求 ${id}：${name}，${spec.item}×${spec.qty}，${md(due)} 取貨，報價 ${nt(q.amount)}（訂金 ${nt(q.deposit)}）。接單員會確認產能與交期，成立訂單後再通知你付訂金。${need}`;
  }

  const isDiscountAsk = (t) => /(算我|給我|幫我|可以|能不能|能否|打個|打|殺價|再|少算|便宜).{0,6}(折|便宜|優惠)|殺價|算便宜/.test(t) && !/有.{0,3}(折扣|優惠)嗎|折扣是|團購折扣/.test(t);
  const isLookupAsk = (t) => /LEO-\d{4}-\d{3}|(查|看|問).{0,6}(訂單|電話|客人|資料)|別人的|誰訂的/.test(t);
  const isPrivAsk = (t) => /(刪除|刪掉|直接核准|核准|幫我改價|改價格)/.test(t);
  async function serviceChat(env, t, actor) {
    // 1. 擋：折扣、查別人的訂單／個資、替店裡做決定（程式這一層是第二道網；小模型那一層是 serviceAgent 的 decline）
    if (isDiscountAsk(t)) {
      return decline(env, 'service', actor, t, SERVICE_DECLINE.discount);
    }
    if (isLookupAsk(t)) {
      return decline(env, 'service', actor, t, SERVICE_DECLINE.order_info);
    }
    if (isPrivAsk(t)) {
      return decline(env, 'service', actor, t, SERVICE_DECLINE.privileged_action);
    }
    // 2. 報價（有尺寸或說到禮盒，且在問價）
    const asksPrice = /多少錢|價格|價錢|報價|幾元|費用|怎麼算|多少/.test(t);
    if (/禮盒/.test(t) && asksPrice) {
      const kind = /喜餅/.test(t) ? '喜餅禮盒' : '彌月禮盒'; const qty = parseQty(t, '盒|份') || 1; const q = quoteBox({ kind, qty });
      await ok(env, 'service', actor, 'quote_box', kind, `${kind}×${qty} 報價 ${nt(q.amount)}`, { qty, amount: q.amount });
      const disc = q.factor < 1 ? `，已套用團購 ${factorLabel(q.factor)}（原價 ${nt(q.list)}）` : '';
      return `${kind} 每盒 ${nt(q.unit)}，${qty} 盒共 ${nt(q.amount)}${disc}；訂金 5 成 ${nt(q.deposit)}；前置 ${q.lead} 天。`;
    }
    const size = parseSize(t);
    if (size && asksPrice && !/禮盒/.test(t)) {
      const flavor = parseFlavor(t) || '香草', shape = parseShape(t), qty = parseQty(t, '個|顆') || 1;
      const q = quoteCake({ size, flavor, shape, qty });
      if (!q) return `我們沒有 ${size} 的尺寸，客製蛋糕有 6 吋、8 吋、10 吋。`;
      await ok(env, 'service', actor, 'quote_cake', size, `${size}${flavor}${shape}報價 ${nt(q.amount)}`, { amount: q.amount, shape });
      const extra = shape === '師傅確認級' ? '這個造型要師傅確認才接，確認後才能下單；' : '';
      return `${size} ${flavor}蛋糕、${shape}造型，每個 ${nt(q.unit)}（尺寸 ${nt(SIZE[size].price)}${FLAVOR[flavor] ? `＋口味 ${FLAVOR[flavor]}` : ''}${SHAPE[shape].add ? `＋造型 ${SHAPE[shape].add}` : ''}）${qty > 1 ? `，${qty} 個共 ${nt(q.amount)}` : ''}。${extra}訂金 3 成 ${nt(q.deposit)}；前置 ${q.lead} 天。`;
    }
    // 3. 下單（收下需求）
    if (/(要訂|想訂|幫我訂|預訂|訂一個|訂兩個|下單|我要.{0,6}(蛋糕|禮盒))/.test(t)) return takeRequest(env, t, actor);
    // 4. 品項、過敏原
    // 品項比對：全名，或「別名」前面沒有別的修飾字（「原味可頌」不是「可頌」，不能答成巧克力可頌）
    const aliasAt = (p) => { if (!p.alias) return -1; let i = t.indexOf(p.alias); while (i >= 0) { const prev = t[i - 1]; if (!prev || !/[一-鿿]/.test(prev) || /[的個塊片吃買有賣要訂這那款種]/.test(prev)) return i; i = t.indexOf(p.alias, i + 1); } return -1; };
    const hit = products.filter((p) => t.includes(p.name) || aliasAt(p) >= 0);
    const near = hit.length ? [] : products.filter((p) => p.alias && t.includes(p.alias));
    if (near.length) {
      const p = near[0]; const i = t.indexOf(p.alias); const phrase = (t.slice(Math.max(0, i - 2), i).match(/[一-鿿]*$/)?.[0] || '') + p.alias;
      await ok(env, 'service', actor, 'not_found', phrase, `客人問「${phrase}」，店裡沒有，近似品項：${p.name}`);
      return `我們沒有「${phrase}」。最接近的是「${p.name}」（NT$ ${p.price}，含：${p.allergens}）。要問它的話再告訴我。`;
    }
    const allergy = /過敏|含有|堅果|麩質|芝麻|大豆|成分|吃素|蛋奶/.test(t);
    if (hit.length && (allergy || !asksPrice)) {
      await ok(env, 'service', actor, 'allergen', hit.map((p) => p.name).join('、'), `查品項過敏原：${hit.map((p) => p.name).join('、')}`);
      return hit.map((p) => `「${p.name}」含：${p.allergens}。NT$ ${p.price}，每天 ${p.daily_output} 個。`).join('\n');
    }
    if (hit.length) {
      await ok(env, 'service', actor, 'price', hit.map((p) => p.name).join('、'), `查品項價格：${hit.map((p) => p.name).join('、')}`);
      return hit.map((p) => `「${p.name}」NT$ ${p.price}，每天 ${p.daily_output} 個。`).join('\n');
    }
    const kw = ['堅果', '芝麻', '大豆', '麩質', '蛋', '乳'].find((k) => t.includes(k));
    if (allergy && kw) {
      const list = products.filter((p) => p.allergens.includes(kw));
      await ok(env, 'service', actor, 'allergen_search', kw, `查含「${kw}」的品項`);
      return list.length ? `含「${kw}」的門市品項：${list.map((p) => p.name).join('、')}。` : `門市品項裡沒有含「${kw}」的。`;
    }
    if (/有什麼|有哪些|品項|賣什麼|菜單/.test(t)) {
      await ok(env, 'service', actor, 'menu', '', '列門市品項');
      return '門市每天出爐：' + products.map((p) => `${p.name} NT$ ${p.price}`).join('、') + '。另有客製蛋糕、彌月禮盒與喜餅禮盒可預訂。';
    }
    // 5. 規則問答：先用程式查固定答案，查不到才問小模型
    for (const [re, f] of FAQ) if (re.test(t)) { await ok(env, 'service', actor, 'faq', '', `回答規則問題：「${t.slice(0, 30)}」`); return f(); }
    const ai = await aiAsk(env, t).catch(() => null);
    if (ai) { await ok(env, 'service', actor, 'ai_answer', '', `小模型依規則回答：「${t.slice(0, 30)}」`); return ai; }
    await ok(env, 'service', actor, 'not_found', '', `查不到：「${t.slice(0, 30)}」`);
    return '這個我查不到，請洽門市，或換個方式問我（品項、過敏原、客製報價、前置天數、退訂規則）。';
  }

  // 小模型怎麼接客服的話：菜單上只有這幾個工具；沒有「查訂單」「給折扣」「刪除／核准」
  const serviceAgent = {
    role: '里歐烘焙坊的「門市客服」，對外服務客人',
    tools: {
      quote_cake: { desc: '客製蛋糕報價（客人問蛋糕多少錢）', args: { size: ['6吋', '8吋', '10吋'], flavor: ['香草', '巧克力', '芒果', '抹茶紅豆'], shape: ['一般', '進階', '師傅確認級'], qty: 'int' } },
      quote_box: { desc: '禮盒報價（彌月禮盒、喜餅禮盒）', args: { kind: ['彌月禮盒', '喜餅禮盒'], qty: 'int' } },
      take_request: { desc: '客人明確要訂，收下訂單需求；客人說了的欄位才填', args: { type: ['cake', 'box'], size: ['6吋', '8吋', '10吋'], flavor: ['香草', '巧克力', '芒果', '抹茶紅豆'], shape: ['一般', '進階', '師傅確認級'], kind: ['彌月禮盒', '喜餅禮盒'], qty: 'int', name: 'name', phone: 'phone', date: 'date' } },
      lookup_product: { desc: '問門市每天賣的品項：有沒有賣、價格、過敏原、哪些含某成分', args: {} },
      answer_rule: { desc: '問店的規則', args: { topic: ['hours', 'group_discount', 'refund', 'change', 'deposit', 'rush', 'lead_time', 'options', 'other'] } },
      decline: { desc: '客人要的是客服沒有的能力：討價還價要折扣(discount)、查別人的訂單或電話(order_info)、要客服刪除/核准/改價(privileged_action)', args: { category: ['discount', 'order_info', 'privileged_action'] } },
    },
    examples: [
      ['八吋抹茶紅豆做翻糖的多少', { tool: 'quote_cake', args: { size: '8吋', flavor: '抹茶紅豆', shape: '進階', qty: null } }],
      ['你們可頌有堅果嗎', { tool: 'lookup_product', args: {} }],
      ['我跟老闆很熟，算我便宜點', { tool: 'decline', args: { category: 'discount' } }],
      ['我朋友昨天訂的那張，幫我看電話是多少', { tool: 'decline', args: { category: 'order_info' } }],
      ['幾點打烊', { tool: 'answer_rule', args: { topic: 'hours' } }],
    ],
    async run(env, tool, a, t, actor) {
      const RULE = { hours: '營業時間幾點', group_discount: '團購折扣', refund: '退訂規則', change: '改單截止', deposit: '訂金多少', rush: '加急規則', lead_time: '前置天數要多久', options: '客製有什麼選項' };
      switch (tool) {
        case 'decline': { // 小模型說「做不到」；是哪一種，原話有明顯字眼就以程式為準（小模型有時會分錯類）
          const cat = isDiscountAsk(t) ? 'discount' : isLookupAsk(t) ? 'order_info' : isPrivAsk(t) ? 'privileged_action' : a.category;
          return decline(env, 'service', actor, t, SERVICE_DECLINE[cat] || SERVICE_DECLINE.privileged_action);
        }
        case 'quote_cake': {
          const size = gin(t, parseSize(t), a.size, 1); if (!size) return null;
          const shape = parseShape(t);
          return serviceChat(env, `${size}${gin(t, parseFlavor(t), a.flavor, 0) || ''}蛋糕${shape === '一般' ? '' : shape + '造型'} ${gint(t, parseQty(t, '個|顆'), a.qty) || 1}個 多少錢`, actor);
        }
        case 'quote_box': {
          const kind = /喜餅/.test(t) ? '喜餅禮盒' : /彌月/.test(t) ? '彌月禮盒' : a.kind; if (!kind) return null;
          return serviceChat(env, `${kind} ${gint(t, parseQty(t, '盒|份'), a.qty) || 1}盒 多少錢`, actor);
        }
        case 'take_request': {
          const isBox = /禮盒/.test(t) || a.type === 'box';
          const name = gname(t, a.name), phone = gphone(t, a.phone), due = gdate(t, a.date, env);
          const who = `${name ? `我是${name}，` : ''}${phone ? `電話${phone}，` : ''}`;
          const when = due ? `，${due}取貨` : '';
          if (isBox) return serviceChat(env, `${who}要訂${/喜餅/.test(t) ? '喜餅禮盒' : a.kind || '彌月禮盒'} ${gint(t, parseQty(t, '盒|份'), a.qty) || ''}盒${when}`, actor);
          const shape = parseShape(t);
          const size = gin(t, parseSize(t), a.size, 1);
          return serviceChat(env, `${who}要訂${size || ''}${gin(t, parseFlavor(t), a.flavor, 0) || ''}蛋糕${shape === '一般' ? '' : shape + '造型'} ${gint(t, parseQty(t, '個|顆|份|盒'), a.qty) || 1}個${when}`, actor);
        }
        case 'answer_rule': return RULE[a.topic] ? serviceChat(env, RULE[a.topic], actor) : serviceChat(env, t, actor);
        default: return serviceChat(env, t, actor); // lookup_product：品項比對的細節（別名、近似品項）程式做得比小模型準，原話交給它
      }
    },
  };

  // ═════════════ 店長核准（只有人按得到；五個工位都沒有這個能力） ═════════════
  async function decide(env, id, act) {
    const a = await one(env, 'SELECT * FROM approvals WHERE id=?', id);
    if (!a) return json({ error: '查無此申請' }, 404);
    if (a.status !== '待核准') return json({ error: `這張申請已經是「${a.status}」` }, 409);
    const d = JSON.parse(a.detail || '{}');
    if (act === 'reject') {
      await run(env, "UPDATE approvals SET status='已退回', decided_at=? WHERE id=?", new Date().toISOString(), id);
      await log(env, 'manager', '店長', 'reject', a.target, 'ok', `店長退回${a.kind}：${a.target}`, { kind: a.kind, decision: '已退回', date: d.date });
      return json({ approval: await one(env, 'SELECT * FROM approvals WHERE id=?', id) });
    }
    if (a.kind === '加急') {
      const o = await getOrder(env, a.target);
      const cap = await capacity(env, d.new_due), used = await usedPoints(env, d.new_due, a.target);
      if (used + o.points > cap.capacity) return json({ error: `${d.new_due} 現在產能不夠（產能 ${cap.capacity}，已排 ${used}，這張 ${o.points}），不能核准加急` }, 409);
      await run(env, 'UPDATE orders SET due_date=?, amount=amount+?, rush=1 WHERE order_id=?', d.new_due, d.fee, a.target);
    } else if (a.kind === '取消') {
      await run(env, "UPDATE orders SET status='已取消', refund=? WHERE order_id=?", d.refund, a.target);
    } else if (a.kind === '折扣') {
      const o = await getOrder(env, a.target);
      await run(env, 'UPDATE orders SET amount=?, deposit=? WHERE order_id=?', d.new_amount, Math.round(d.new_amount * (o.type === 'box' ? DEPOSIT.box : DEPOSIT.cake)), a.target);
    } else if (a.kind === '請假') {
      await run(env, 'INSERT INTO shifts (date,staff_id,status) VALUES (?,?,?) ON CONFLICT(date,staff_id) DO UPDATE SET status=excluded.status', d.date, d.staff_id, '休');
    }
    await run(env, "UPDATE approvals SET status='已核准', decided_at=? WHERE id=?", new Date().toISOString(), id);
    await log(env, 'manager', '店長', 'approve', a.target, 'ok', `店長核准${a.kind}：${a.summary}`, { kind: a.kind, decision: '已核准', date: d.date, ...d });
    return json({ approval: await one(env, 'SELECT * FROM approvals WHERE id=?', id), order: a.kind === '請假' ? undefined : await getOrder(env, a.target) });
  }

  // ═════════════ Telegram：所有操作的入口（客人、員工、店長都在這裡；網頁只有一頁唯讀儀表板） ═════════════
  // 客人（任何人）→ 門市客服。店員（TELEGRAM_STAFF 裡的人）→ 預設內勤小幫手，用 /客服 /接單 /廚房 /內勤 /日報 換工位。
  // 店長（TELEGRAM_MANAGERS 裡的人）→ 另外會收到「等核准」的通知，按鈕核准／退回。核准不經過任何工位，也不經過小模型。
  const TG_STATION = { '/客服': 'service', '/接單': 'intake', '/廚房': 'kitchen', '/內勤': 'desk', '/日報': 'report' };
  const tgApi = (env, method, body) => fetch(`${env.TELEGRAM_API || 'https://api.telegram.org'}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const tgSend = (env, chat, text, extra = {}) => tgApi(env, 'sendMessage', { chat_id: chat, text: String(text).slice(0, 4000), ...extra });
  const tgPeople = (env) => {
    let staffMap = {}; try { staffMap = JSON.parse(env.TELEGRAM_STAFF || '{}'); } catch { /* 設定壞掉就當沒有店員 */ }
    return { staffMap, managers: String(env.TELEGRAM_MANAGERS || '').split(',').map((x) => x.trim()).filter(Boolean) };
  };
  const approvalKeys = (id) => ({ reply_markup: { inline_keyboard: [[{ text: '核准', callback_data: `ap:approve:${id}` }, { text: '退回', callback_data: `ap:reject:${id}` }]] } });
  const approvalLine = (a) => `等核准 #${a.id}｜${a.kind}｜${a.summary}（申請人：${a.requested_by || '—'}）`;
  async function tgDecide(env, id, act) {
    const r = await decide(env, id, act); const j = await r.json();
    return r.ok ? `${act === 'approve' ? '已核准' : '已退回'} #${id}：${j.approval.summary}` : `沒辦法：${j.error}`;
  }
  const TG_HELP = (isStaff, isMgr) => isStaff
    ? `里歐烘焙坊 AI 工位。直接用說的就好。\n換工位：/客服 /接單 /廚房 /內勤 /日報（預設是內勤）。${isMgr ? '\n店長：/待核准 看等你核准的事，按鈕核准或退回。' : ''}`
    : '歡迎來到里歐烘焙坊！我是門市客服，可以問品項、過敏原、客製蛋糕與禮盒報價、前置天數、退訂規則，也可以直接告訴我要訂什麼（請附上稱呼、電話、取貨日）。';
  async function telegram(env, update) {
    const { staffMap, managers } = tgPeople(env);
    const cb = update.callback_query;
    if (cb) {
      const uid = String(cb.from?.id), chat = cb.message?.chat?.id ?? cb.from?.id;
      const [, act, id] = String(cb.data || '').split(':');
      if (!managers.includes(uid)) { await tgApi(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: '只有店長能按核准' }); return; }
      const text = await tgDecide(env, Number(id), act); await tgApi(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: text.slice(0, 190) }); await tgSend(env, chat, text); return;
    }
    const m = update.message; if (!m) return;
    const uid = String(m.from?.id), chat = m.chat?.id ?? m.from?.id;
    if (typeof m.text !== 'string') { await tgSend(env, chat, '目前只看得懂文字訊息。'); return; }
    const text = m.text.trim(); const name = staffMap[uid] || ''; const isStaff = !!name, isMgr = managers.includes(uid);
    const row = await one(env, 'SELECT * FROM tg_chats WHERE chat_id=?', String(chat));
    const save = (station, pending) => run(env, 'INSERT INTO tg_chats (chat_id,station,pending,updated) VALUES (?,?,?,?) ON CONFLICT(chat_id) DO UPDATE SET station=excluded.station, pending=excluded.pending, updated=excluded.updated', String(chat), station, pending || '', new Date().toISOString());
    const cmd = text.split(/\s+/)[0].replace(/@\w+$/, '');
    if (cmd === '/id') { await tgSend(env, chat, `你的 Telegram 編號是 ${uid}。要當店員或店長，把這串數字交給 Claude 設定。`); return; }
    if (cmd === '/start' || cmd === '/help' || cmd === '/說明') { await tgSend(env, chat, TG_HELP(isStaff, isMgr)); return; }
    if (cmd === '/待核准' || cmd === '/approvals' || /^\/(核准|退回)$/.test(cmd)) {
      if (!isMgr) { await tgSend(env, chat, '只有店長能核准。'); return; }
      if (cmd === '/待核准' || cmd === '/approvals') {
        const list = await all(env, "SELECT * FROM approvals WHERE status='待核准' ORDER BY id");
        if (!list.length) await tgSend(env, chat, '目前沒有等核准的事。');
        for (const a of list) await tgSend(env, chat, approvalLine(a), approvalKeys(a.id));
        return;
      }
      const id = Number((text.match(/\d+/) || [])[0]); await tgSend(env, chat, id ? await tgDecide(env, id, cmd === '/核准' ? 'approve' : 'reject') : '請說要處理哪一件，例如「/核准 3」。'); return;
    }
    if (TG_STATION[cmd]) {
      if (!isStaff) { await tgSend(env, chat, '這個工位只給店員用。你可以直接問我品項、報價、訂蛋糕。'); return; }
      const st = TG_STATION[cmd];
      if (!CHAT[st]) { await tgSend(env, chat, '這個工位還沒上班。'); return; }
      await save(st, ''); const rest = text.slice(cmd.length).trim();
      if (!rest) { await tgSend(env, chat, `已切到「${STATIONS[st]}」。直接說要做什麼。`); return; }
    }
    const station = isStaff ? (TG_STATION[cmd] || row?.station || 'desk') : 'service';
    if (!CHAT[station]) { await tgSend(env, chat, '這個工位還沒上班。'); return; }
    let msg = TG_STATION[cmd] ? text.slice(cmd.length).trim() : text;
    if (station === 'service' && row?.pending) msg = `${row.pending}，${msg}`; // 上一句還缺資料：客人只補缺的那幾項，接回上一句一起看
    const before = (await one(env, 'SELECT COALESCE(MAX(id),0) AS n FROM approvals')).n;
    const out = await converse(env, station, msg, name);
    await save(station, station === 'service' && /還需要：/.test(out.reply) ? msg : '');
    await tgSend(env, chat, out.reply);
    // 有新的申請等核准 → 通知店長（按鈕）
    for (const a of await all(env, "SELECT * FROM approvals WHERE status='待核准' AND id>? ORDER BY id", before)) for (const mg of managers) await tgSend(env, mg, approvalLine(a), approvalKeys(a.id));
  }

  // Telegram 自己接上：學員只放一個 Secret（TELEGRAM_BOT_TOKEN）。webhook 密語由 token 算出來（學員不用編、不用放），
  // 「告訴 Telegram 把訊息送到這個 Worker」（setWebhook）也由 Worker 自己做——儀表板每次載入問狀態時，發現還沒登記或登記錯網址就補登記。
  // token、密語的值絕不出現在回應、日誌、畫面。
  const webhookSecret = async (env) => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('leo-bakery:telegram-webhook:' + env.TELEGRAM_BOT_TOKEN));
    return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  const tgCall = async (env, method, body) => { // 回 Telegram 的 JSON；連不上或格式不對丟錯（錯誤訊息不含網址，網址裡有 token）
    let r; try { r = await fetch(`${env.TELEGRAM_API || 'https://api.telegram.org'}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); } catch { throw new Error('連不上 Telegram'); }
    try { return await r.json(); } catch { throw new Error('Telegram 回的不是預期的格式'); }
  };
  // state：secret-missing（token 沒放）／token-invalid（Telegram 不認這把 token，或連不上）／
  //        webhook-set-failed（Worker 想自己登記網址但 Telegram 不收）／delivery-error（Telegram 送不進來）／ok
  async function telegramStatus(env, origin) {
    const have = { TELEGRAM_BOT_TOKEN: !!env.TELEGRAM_BOT_TOKEN };
    const missing = Object.keys(have).filter((k) => !have[k]);
    const expected = origin + '/api/telegram/webhook';
    const out = (state, summary, extra = {}) => ({ state, summary, secrets: have, missing, expected_webhook: expected, registered_now: false, webhook: null, ...extra });
    if (missing.length) return out('secret-missing', 'Secret 還沒放：TELEGRAM_BOT_TOKEN（到 Cloudflare 後台 Worker leo-bakery 的 Settings → Variables and Secrets 貼上 BotFather 給的 token，按 Deploy）');
    const hookSecret = await webhookSecret(env);
    const scrub = (x) => String(x == null ? '' : x).split(env.TELEGRAM_BOT_TOKEN).join('<token>').split(hookSecret).join('<secret>').slice(0, 200);
    let info;
    try { info = await tgCall(env, 'getWebhookInfo'); } catch (e) { return out('token-invalid', `${e.message}（稍後再看；一直這樣就重新貼一次 TELEGRAM_BOT_TOKEN）`); }
    if (!info || !info.ok) return out('token-invalid', `Telegram 不認這把 token：${scrub(info && info.description) || '沒有說明'}（到 BotFather 確認 token，重新貼一次 TELEGRAM_BOT_TOKEN）`);
    let w = info.result || {}, registeredNow = false;
    if (w.url !== expected) { // 還沒登記，或登記在別的網址：Worker 自己補上
      let res; try { res = await tgCall(env, 'setWebhook', { url: expected, secret_token: hookSecret, allowed_updates: ['message', 'callback_query'] }); } catch (e) { return out('webhook-set-failed', `Worker 想把網址登記給 Telegram，失敗了：${e.message}`, { webhook: { url: scrub(w.url) } }); }
      if (!res || !res.ok) return out('webhook-set-failed', `Worker 想把網址登記給 Telegram，Telegram 不收：${scrub(res && res.description) || '沒有說明'}`, { webhook: { url: scrub(w.url) } });
      registeredNow = true;
      try { const again = await tgCall(env, 'getWebhookInfo'); if (again && again.ok) w = again.result || {}; else w = { ...w, url: expected }; } catch { w = { ...w, url: expected }; }
    }
    const webhook = { url: scrub(w.url), pending: Number(w.pending_update_count || 0), last_error_message: scrub(w.last_error_message), last_error_date: w.last_error_date || null };
    const recent = w.last_error_date && Date.now() / 1000 - w.last_error_date < 3600; // 錯誤超過一小時又沒有積壓的訊息＝舊帳，不算現在的問題
    if (!registeredNow && w.last_error_message && (recent || webhook.pending > 0)) return out('delivery-error', `Telegram 想把訊息送進來，失敗了：${webhook.last_error_message}`, { webhook });
    return out('ok', registeredNow ? 'Telegram bot 剛剛自動接上了：Worker 已把網址登記給 Telegram，現在可以對 bot 說話' : 'Telegram bot 已接通：Secret 在、網址對、Telegram 沒回報送不進來', { webhook, registered_now: registeredNow });
  }

  const CHAT = { service: serviceChat };
  const AGENTS = { service: serviceAgent };

  // 一句話進來：有小模型 → 小模型挑工具、程式照規則做；沒有／掛了／挑不出來 → 規則備援（照舊）。via 記是誰接的話。
  async function converse(env, station, text, actor) {
    const agent = AGENTS[station];
    if (!agent || !env.AI || env.NO_MODEL) return { reply: await CHAT[station](env, text, actor), via: 'rules' };
    let pick = null, why = '';
    try { pick = await pickTool(env, agent, text, today(env), actor); if (!pick) why = '小模型沒有回出工具'; } catch (e) { why = String(e.message || e).slice(0, 80); }
    if (pick) {
      const reply = await agent.run(env, pick.tool, pick.args, text, actor);
      if (reply != null) return { reply, via: 'model', tool: pick.tool, model: pick.model };
      why = `工具 ${pick.tool} 缺必要的資訊`;
    }
    return { reply: await CHAT[station](env, text, actor), via: 'rules-fallback', why };
  }

  return {
    async fetch(req, env) {
      const url = new URL(req.url); const p = url.pathname; const m = req.method;
      if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
      try {
        await ensure(env);
        const body = async () => req.json().catch(() => ({}));
        if (p === '/api/telegram/webhook' && m === 'POST') {
          if (!env.TELEGRAM_BOT_TOKEN) return json({ error: 'Telegram 還沒設定（TELEGRAM_BOT_TOKEN）' }, 503);
          if (req.headers.get('x-telegram-bot-api-secret-token') !== await webhookSecret(env)) return json({ error: '不是 Telegram 送來的' }, 403);
          await telegram(env, await body());
          return json({ ok: true });
        }
        if (p === '/api/telegram/status' && m === 'GET') return json(await telegramStatus(env, url.origin));
        if (p === '/api/reset' && m === 'POST') { await reset(env); return json({ ok: true }); }
        if (p === '/api/orders' && m === 'GET') return json({ orders: await all(env, 'SELECT o.*, c.name AS customer FROM orders o LEFT JOIN customers c ON c.customer_id=o.customer_id ORDER BY o.order_id') });
        let mm = p.match(/^\/api\/orders\/([^/]+)$/);
        if (mm && m === 'GET') { const o = await getOrder(env, decodeURIComponent(mm[1])); return o ? json({ order: o }) : json({ error: '查無此訂單' }, 404); }
        if (p === '/api/approvals' && m === 'GET') return json({ approvals: await all(env, 'SELECT * FROM approvals ORDER BY id') });
        mm = p.match(/^\/api\/approvals\/(\d+)\/(approve|reject)$/);
        if (mm && m === 'POST') return decide(env, Number(mm[1]), mm[2]);
        if (p === '/api/schedule' && m === 'GET') return json(await schedule(env, url.searchParams.get('date') || addDays(today(env), 1)));
        if (p === '/api/logs' && m === 'GET') {
          const st = url.searchParams.get('station');
          const rows = st ? await all(env, 'SELECT * FROM work_log WHERE station=? ORDER BY id', st) : await all(env, 'SELECT * FROM work_log ORDER BY id');
          return json({ logs: rows });
        }
        mm = p.match(/^\/api\/(service|intake|kitchen|desk|report)\/chat$/);
        if (mm && m === 'POST') {
          if (!CHAT[mm[1]]) return json({ error: '這個工位還沒上班' }, 404);
          const b = await body(); const text = String(b.message || '').trim();
          if (!text) return json({ error: '沒有收到訊息' }, 400);
          return json({ station: mm[1], ...(await converse(env, mm[1], text, b.user ? String(b.user) : '')) });
        }
        return json({ error: '沒有這個網址' }, 404);
      } catch (e) { return json({ error: '後端出錯：' + e.message }, 500); }
    },
  };
}
