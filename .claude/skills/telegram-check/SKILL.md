---
name: telegram-check
description: 學員貼好 Telegram bot token（放進 Cloudflare 後台 leo-bakery 的 Secret）之後，說「幫我檢查 Telegram 接好了沒」「bot 接上了嗎」「bot 沒反應」時使用。你去查 webhook 接好了沒、沒接好就讓 Worker 自己接好，最後回報「已接上」或「卡在哪」。全程你拿不到 token。
---

# telegram-check：查 Telegram 接好了沒（沒接好就接好）

學員在 Telegram 這件事只做兩個動作：向 BotFather 領 token、把 token 貼進 Cloudflare 後台 `leo-bakery` 的 Secret（名稱 `TELEGRAM_BOT_TOKEN`）。**接上 Telegram（webhook）不是學員的事，是你的事**——但你不用、也拿不到 token：查與接都由 Worker 用它身上的 Secret 去跟 Telegram 講，你只看得到結果。

## 步驟

1. **找 Worker 網址**：看最近一次 `wrangler deploy` 的輸出（`https://leo-bakery.<帳號>.workers.dev`）；找不到就問學員一次。Worker 還沒部署門市客服（還是 Hello World）→ 先照 `course/orders/SDD-stations.md` 蓋好、部署，再回來。
2. **跑查詢**：`node .claude/scripts/check-telegram.mjs <Worker 網址>`。它只呼叫 Worker 的 `GET /api/telegram/status`；Worker 發現 Telegram 還沒登記（或登記在別的網址），會**自己登記好**，再回報結果。
3. **照結尾那行「結論：」用一句白話回報學員**，三種常見情況：
   - **Secret 沒放**（`secret-missing`）→ 說缺 `TELEGRAM_BOT_TOKEN`，教他去 Cloudflare 後台 Worker `leo-bakery` → Settings → Variables and Secrets → Add → Type 選 Secret → 貼 token → Deploy；貼完叫他再跟你說一次。
   - **放了、本來沒接，這次接好了**（`ok`＋「剛剛已接好」）→ 回報「已接上」，請他對 bot 傳 `/id`。
   - **本來就接好了**（`ok`）→ 直接回報「已接上」。
   - 其他（`token-invalid`、`webhook-set-failed`、`delivery-error`）→ 把「Worker 說」那句白話轉給學員，並說下一步（token 不對就重貼；登記失敗或送不進來把原文給講師）。
4. 儀表板（Worker 網址）最上面的「Telegram bot」那一格顯示同一份狀態，可請學員打開對照。

## 鐵律

- **不要問學員 token、不要叫他貼進對話、不要自己去讀 Secret**；你沒有任何指令可以讀到它。要貼的人是學員，貼的地方是 Cloudflare 後台。
- **不要叫學員拼 `setWebhook` 網址、不要叫他編密語**——那一步已經由 Worker 自己做掉了。
- 雲端環境的 Network access 若擋住 `*.workers.dev`，腳本會說「連不到」：請學員把環境設定的 Network access 改成 Full 後開新 session（這格沒在真環境驗過）。
