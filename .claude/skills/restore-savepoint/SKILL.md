---
name: restore-savepoint
description: 學員落後時，把專案接回全班的進度。學員說「從 D1 存檔點接著做」「從 D2 中午存檔點接著做」「我跟不上了，接回全班」時使用。把存檔點的程式放進 course/src/、設好部署閘、跑驗收單給學員看全綠。
---

# restore-savepoint：從存檔點接回全班

學員是不寫程式的主管。**你代勞，每一步用一句白話說你在做什麼。** 這門課的東西都在 repo 的 `course/` 底下，烘焙坊的 Worker 專案根目錄也是 `course/`。存檔點在 `course/savepoints/`，各有一份 `about.md`：


| 學員說 | 資料夾 | 內容 | 部署閘 `.ax303-gate` |
|---|---|---|---|
| 從 D1 存檔點接著做 | `course/savepoints/d1/` | 門市客服上線、過了自己的驗收單 | `service` |
| 從 D2 中午存檔點接著做 | `course/savepoints/d2-noon/` | 門市客服、接單員、內勤小幫手、廚房排產 | `service,intake,desk,kitchen` |

學員只說「我跟不上了」沒說哪一個：問一句「你卡在上午還是下午？」——D1 全天要接的用 d1；D2 中午以後要接的用 d2-noon。

## 步驟（照順序）

1. **先保住學員自己做的**：`course/` 底下若已有 `src/`，改名成 `course/src-mine-<MMDD-HHMM>/`（不要刪）。告訴學員：「你原本寫的我收起來了，沒有刪。」
2. **放進存檔點**：把 `course/savepoints/<目錄>/src/` 複製成 `course/src/`；把 `course/savepoints/<目錄>/.ax303-gate` 複製成 `course/.ax303-gate`。
3. **確認設定**：`course/wrangler.toml` 的 `database_id` 若還是「請填建好之後印出來的 id」，就照學員的 Cloudflare 帳號建 D1（叫 `leo-bakery-db`）並把 id 填進去。學員自己填過的不要動。
   接著確認 Telegram：`course/wrangler.toml` 的 `TELEGRAM_STAFF`、`TELEGRAM_MANAGERS` 還是空的 → 請學員對自己的 bot 傳 `/id`，把回的編號設成店員（名字用 `course/data/staff.csv` 裡的，例如阿德）和店長；bot token 你拿不到、也不要問：用 `npx wrangler secret list`（只列名稱）看 Worker 有沒有 `TELEGRAM_BOT_TOKEN` 這個 Secret；沒有 → 請學員照前置作業 G 步自己在 Cloudflare 後台貼 token（不用拼任何網址、不用編密語）；部署好後用 `telegram-check` 技能查接好了沒（Worker 會自己向 Telegram 登記網址，你拿不到 token）；最後以學員對 bot 傳 `/id` 有回數字為準。
4. **確認知識庫**：用 Arcrun RAG 的 MCP 查「退訂規則」。查得到就好；查不到（或 MCP 沒接上）→ 先跑 `setup` 技能，再把 `course/company-data/` 的檔案重新上傳到學員自己的 Arcrun RAG。**不要把金鑰值印出來。**
5. **起本機服務並驗證**：在 `course/` 裡背景跑 `npx wrangler dev --local`（雲端沒有 Cloudflare 登入就用 `sed '/^\[ai\]/,/^$/d' wrangler.toml > wrangler.dev.toml` 去掉 [ai] 後用 `-c wrangler.dev.toml`），然後在 repo 根目錄跑 `node .claude/scripts/run-tests.mjs --dir course --stations <閘的內容>`。
6. **把結果原樣給學員看**：全綠就說「你現在跟全班在同一個地方」，並說下一步是什麼（d1 → 下一幕：舊系統資料進雲端，先蓋接單員；d2-noon → 下午第五幕：工作日誌與老闆日報）。紅燈就照 `run-tests` 技能的方法找原因，不要改測試題。（去掉 [ai] 的本機服務沒有小模型，工位走規則備援，驗收單照樣會綠；要看小模型真的接話，用有 [ai] 的 `wrangler dev` 或部署後的網址跑，表尾會印「小模型接話 N 次」。）
7. **存檔**：做一次 commit（訊息寫「從 D1 存檔點接上」之類），推上學員自己的 repo 目前分支。

## 不要做

- 不要刪學員的 `course/src/`，也不要改 `course/tests/`、`course/scenario/`。
- 不要把存檔點的內容講成「標準答案」讓學員抄——它是讓人跟上進度的備份；後面的工位學員還是要自己請 Claude 蓋。
- 存檔點只有那個時點該有的工位。d1 裡沒有接單員是正常的，不要「順便補上」。
