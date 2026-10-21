# 課程（這門課與這家店的東西都在這裡）

> 你在：學員範本 `course/`。repo 根目錄只放 Claude 的「到職須知與工具」（`CLAUDE.md`、`.claude/`）；換一門課就會換掉的東西，全在這個資料夾。
> 每個資料夾裡都有一份 README：這裡的東西幹嘛用、在簡報第幾頁用到、下一步去哪。頁碼是 AX-303 簡報的頁碼（D1＝第一天、D2＝第二天）。

**照上課順序：**

| 資料夾 | 是什麼 | 簡報 |
|---|---|---|
| [`handouts/`](handouts/) | 講義一（Claude 會講到的詞）、講義二（每個實作段說什麼、該看到什麼） | 整堂課 |
| [`paste-by-hand/`](paste-by-hand/) | 你自己貼進 Cloudflare 的小程式和步驟 | D1 第 9–12 頁 |
| [`company-data/`](company-data/) | 店的五份規矩，上傳到 Arcrun RAG | D1 第 30–32 頁 |
| [`tests/`](tests/) | 每個工位的驗收單（檢查哨先跑它） | D1 第 34、38 頁；D2 各工位 |
| [`orders/`](orders/) | 工位規格、唯讀儀表板 | D1 第 35–37 頁；D2 第 7 頁 |
| [`scenario/`](scenario/) | 一天的劇本（老闆的驗收） | D1 第 28、40 頁；D2 第 15–16 頁 |
| [`savepoints/`](savepoints/) | 跟不上時從這裡接 | D2 第 3、9 頁 |
| [`data/`](data/) | 舊系統匯出的資料（CSV） | D2 第 4 頁 |
| [`logs/`](logs/) | 紅燈記錄，出錯時交給 Claude | D2 第 13–14 頁 |

**Claude 會讀、會改，你不用打開的**：`wrangler.toml` 與 Claude 蓋出來的 `src/`（烘焙坊的 Worker 專案根目錄就是這個資料夾）。
