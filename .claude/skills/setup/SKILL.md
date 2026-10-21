---
name: setup
description: 課前與 D1 開場用（Claude Code on the web 版）。檢查雲端環境的 Node、wrangler、jq，驗證 Cloudflare 金鑰、Arcrun RAG（學員在 claude.ai 連接器授權過、這個工作階段讀得到知識庫）。學員說「幫我設定環境」「/setup」時使用。
---

# setup：幫學員確認雲端環境準備好（網頁版）

學員是不寫程式的主管，用瀏覽器開 Claude Code on the web。**你代勞所有指令**，每一步用一句白話說你在做什麼。
這個環境是 Linux 雲端虛擬機：不用裝 Git Bash、不用 winget、**不能用 `wrangler login`**（雲端沒有瀏覽器可以跳出來）。Cloudflare 靠環境變數裡的金鑰登入。

## 步驟（照順序，每步印出「通過」或「失敗＋原因」）

1. **Node**：`node -v`，要 v20 以上（雲端預設 22）。
2. **jq**：`jq --version`（雲端預設已裝）。
3. **wrangler**：`npx --yes wrangler --version`。
4. **Cloudflare 金鑰有沒有設**：金鑰與 Account ID 是環境變數（課堂預設，10-18 實測過 whoami／d1／deploy／run-tests 全通）。只檢查「有沒有」，**絕對不要把值印出來**：
   `[ -n "$CLOUDFLARE_API_TOKEN" ] && echo 有 || echo 沒有`，`CLOUDFLARE_ACCOUNT_ID` 同理。
   - 兩個都有 → 通過這一步，繼續第 5、6 步（**以環境變數為準**）。
   - `CLOUDFLARE_API_TOKEN` 沒有，但學員說金鑰是放在環境的 **Network secrets**（選用、尚未驗證的做法）→ 照下面「選用：Network secrets」檢查，不要直接判失敗。
   - 其他情況沒有 → 告訴學員去 claude.ai/code 的環境設定（Environment variables）補上，補完要**開新 session**才讀得到。
5. **雲端連得到 Cloudflare 嗎**：`curl -s -o /dev/null -w "%{http_code}" https://api.cloudflare.com/client/v4/user/tokens/verify`
   連不上或 403 且訊息提到 blocked / not allowed → 是環境的網路等級太窄。告訴學員：環境設定的 Network access 要改成 **Full**（或 Custom 並加入 `*.cloudflare.com`、`*.workers.dev`）。
6. **登入驗證**：`npx wrangler whoami`，要看到學員自己的帳號名稱。看到別人的帳號或失敗，只講那一項怎麼辦。
7. **Arcrun RAG 接得上、讀得到知識庫**：Arcrun RAG 是學員在 claude.ai 的「設定 → 連接器」用 MCP OAuth2（Portal 的 email＋密碼）授權的，**不用任何 token、也不用環境變數**。你在這個工作階段裡找名字結尾是 `kbdb_get_map` 的工具（連接器的工具名通常長得像 `mcp__某個名字__kbdb_get_map`；工具若是延後載入的，先用工具搜尋找 `kbdb_get_map`），然後**真的呼叫它一次**（讀知識庫地圖）。
   - 回得出地圖（哪怕是空的）→ 通過。
   - 找不到這個工具 → 這個工作階段沒帶到連接器。告訴學員：到 claude.ai 的 **設定 → 連接器**，看有沒有 Arcrun RAG 那一列、狀態是不是「已連線」；沒有就新增自訂連接器（貼 MCP 網址，結尾是 `/mcp`）並授權；加完或授權完，要**開新的工作階段**才讀得到。
   - 呼叫回授權錯誤（401／未授權／過期）→ 到同一頁按 Arcrun RAG 那列的**重新授權**，在跳出的頁面填 Portal 的 email＋密碼；再開新的工作階段。
   - 呼叫逾時或連不上 → 先確認 Arcrun RAG 的網址在瀏覽器打得開（Portal 能登入），再重試一次；仍不行才轉給講師。
   - 只看「連接器那一列存在」**不算通過**：授權過期或網址貼錯時，那一列還是在。一定要真的呼叫成功。
8. **Telegram bot（上午環境架設時學員自己放好；只看名稱在不在）**：bot token 由學員直接放進 Cloudflare 後台 Worker `leo-bakery` 的 Secret，**不進這個工作區**，你拿不到、也不要去問學員 token；學員**不用**編密語、**不用**拼 setWebhook 網址（Worker 之後自己向 Telegram 登記）。跑 `npx wrangler secret list --name leo-bakery`（只列名稱，不會印值）：看到 `TELEGRAM_BOT_TOKEN` → 印「通過（名稱在；bot 要等下午門市客服蓋好、打開儀表板後才會回話）」。Worker 不存在或沒有這個名稱 → 印「還沒放好：照 README 的 G 步做」，**不擋**其他項目。學員說「幫我檢查 Telegram 接好了沒」或下午 bot 沒反應 → 用 `telegram-check` 技能（跑 `node .claude/scripts/check-telegram.mjs <Worker 網址>`，Worker 沒接好會自己接好，你只看得到結果）；最後以對 bot 傳 `/id` 有回數字為準。

## 選用：Network secrets（尚未驗證，不是課堂預設）

只有學員已經把 Cloudflare 金鑰放進環境的 Network secrets（Name `Cloudflare`、Allowed websites `api.cloudflare.com`、`Authorization`／`Bearer`）、環境變數沒有 `CLOUDFLARE_API_TOKEN` 時才走這段：
- 先 `curl -s https://api.cloudflare.com/client/v4/user/tokens/verify | jq -r '.result.status // .errors[0].message'`（不帶標頭，系統代為帶上），`active` 才算金鑰有效；驗證錯誤 → 那一筆沒加好，**存好的秘密不能改，要刪掉重加**。
- 再 `npx wrangler whoami`。**這一格沒實測過**：wrangler 沒有 `CLOUDFLARE_API_TOKEN` 時通常會要互動登入。失敗就**不要跑 `wrangler login`**，照實告訴學員「這條路還沒驗證，請改回環境變數 `CLOUDFLARE_API_TOKEN`」，並回報講師那一行原文。

## 收尾

印一張清單：

| 項目 | 結果 |
|---|---|
| Node | 版本或失敗原因 |
| wrangler | 同上 |
| jq | 同上 |
| Cloudflare 金鑰與連線 | 帳號名稱或失敗原因 |
| Arcrun RAG | 通過（連接器已授權、讀得到知識庫地圖）/ 哪一項失敗 |
| Telegram bot | 通過（名稱都在）／還沒放好（照 README G 步） |

全部通過才說「環境好了」（Telegram 那列沒放好只提醒，不擋）。任何一項失敗，只講那一項該怎麼辦，不要一次丟一堆。

## 不要做

- 不要印出、複述、或寫進任何檔案：`CLOUDFLARE_API_TOKEN` 的值、Telegram bot token。Telegram token 你本來就拿不到；學員若主動把它貼進對話，請他以後別這樣做，並提醒他到 Cloudflare 或 @BotFather 重新產生一把。
- 不要叫學員自己開終端機或裝東西到自己的電腦。
- 不要跑 `wrangler login`。
