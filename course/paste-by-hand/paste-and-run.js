// 第一個 Worker：整段複製，貼進 Cloudflare 網頁的程式編輯器，按「部署」，打開網址就會動。
// 不需要金鑰、不需要終端機、不經過 Claude。證明你的 Cloudflare 帳號和環境是通的。
export default {
  async fetch(request) {
    // Cloudflare 在每個請求上附一份「你從哪裡來、是哪個機房接的」。這些都是 Worker 免費拿得到的，不用設定。
    const cf = request.cf || {};
    const 城市 = cf.city || '（本機測試看不到城市）';
    const 機房 = cf.colo || '—';       // 機房代碼，例如 TPE、NRT、LAX
    const 國家 = cf.country || '—';
    const 現在 = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    const 網頁 = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>你現在連到哪裡？</title>
<style>body{font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;max-width:560px;margin:10vh auto;padding:0 20px;color:#3b2a1e}
h1{font-size:26px;line-height:1.4}.big{font-size:34px;color:#b4531f;font-weight:700}.card{background:#fffaf3;border:1px solid #eadfce;border-radius:12px;padding:14px 18px;margin:12px 0}</style></head>
<body>
<h1>你現在連到的是 Cloudflare 在<br><span class="big">${城市}</span><br>的機房</h1>
<div class="card">機房代碼：<b>${機房}</b>　國家：<b>${國家}</b></div>
<div class="card">現在時間（台北）：<b>${現在}</b></div>
<p>同一個網址，請旁邊的同學用他的手機打開——你們看到的機房可能不一樣。這一頁沒有放在任何一台特定的主機上。</p>
</body></html>`;
    return new Response(網頁, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  },
};
