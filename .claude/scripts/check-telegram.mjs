#!/usr/bin/env node
// 查 Telegram bot 接好了沒（學員說「幫我檢查 Telegram 接好了沒」時，CC 跑這支）。
// 用法：node .claude/scripts/check-telegram.mjs <Worker 網址>        （也可以用環境變數 WORKER_URL）
// 它只呼叫 Worker 的 GET /api/telegram/status：查與接（沒登記就由 Worker 自己 setWebhook）都是 Worker 用它身上的 Secret 去跟 Telegram 講，
// 這支腳本和 CC 都拿不到 token，只看得到結果。結尾那一行「結論：」就是要回報給學員的話。
// 結束碼：0＝已接上、1＝卡住（看「卡在」那行）、2＝連不到 Worker／網址不對。
const base = String(process.argv[2] || process.env.WORKER_URL || '').trim().replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) { console.log('結論：缺 Worker 網址——問學員 leo-bakery 的網址（https://leo-bakery.….workers.dev），或看最近一次部署輸出的網址。'); process.exit(2); }
let res, text;
try { res = await fetch(base + '/api/telegram/status', { headers: { accept: 'application/json' } }); text = await res.text(); } catch (e) {
  console.log(`結論：連不到 ${base}（${String(e.message || e).slice(0, 80)}）。可能是網址打錯、Worker 還沒部署，或雲端環境的 Network access 擋住了 *.workers.dev。`); process.exit(2);
}
let j; try { j = JSON.parse(text); } catch { j = null; }
if (!res.ok || !j || !j.state) {
  console.log(`結論：${base} 有回應，但不是烘焙坊的 Worker（HTTP ${res.status}）。可能還是 Hello World、還沒把門市客服部署上去，或網址不是 leo-bakery。`); process.exit(2);
}
const say = {
  'secret-missing': '卡在：Cloudflare 後台 Worker leo-bakery 還沒有 TELEGRAM_BOT_TOKEN 這個 Secret。請學員到 Settings → Variables and Secrets → Add，Type 選 Secret，貼 BotFather 給的 token，按 Deploy（不要貼給 Claude）。',
  'token-invalid': '卡在：Worker 拿它的 token 問 Telegram，被拒或連不上。請學員到 BotFather 確認 token，重新貼一次 TELEGRAM_BOT_TOKEN 並 Deploy（不要貼給 Claude）。',
  'webhook-set-failed': '卡在：Worker 想把自己的網址登記給 Telegram，Telegram 不收。',
  'delivery-error': '卡在：網址登記好了，但 Telegram 想把訊息送進來時失敗。',
  ok: '',
};
console.log(`Secret：${j.secrets && j.secrets.TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN 已放' : 'TELEGRAM_BOT_TOKEN 沒放'}`);
console.log(`狀態：${j.state}${j.registered_now ? '（這一次由 Worker 自己登記好的）' : ''}`);
console.log(`Worker 說：${j.summary}`);
if (j.state === 'ok') console.log(j.registered_now ? '結論：剛剛已接好——Telegram 原本還沒登記，Worker 自己登記了網址。已接上，可以對 bot 傳 /id。' : '結論：已接上（Secret 在、網址對、Telegram 沒回報送不進來）。可以對 bot 傳 /id。');
else console.log('結論：' + (say[j.state] || '還沒接通') + ` Worker 說：${j.summary}`);
process.exit(j.state === 'ok' ? 0 : 1);
