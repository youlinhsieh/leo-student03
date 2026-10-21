# SDD：里歐烘焙坊的五個 AI 工位

> 本文件裡的路徑都在 repo 的 `course/` 底下（`course/` 是烘焙坊的 Worker 專案根目錄）。

## 要達成什麼

讓「里歐烘焙坊的一天」（`scenario/one-day-script.md`）由五位小模型工讀生跑完，人只做一件事：店長按核准。主管（Claude Code）負責蓋、測、修，學員不寫程式。

**入口只有 Telegram**：客人問、下單，員工打卡、請假、報修，店長核准，全都在 Telegram 上做。網頁只剩 `orders/index.html` 一頁唯讀儀表板（看 Telegram bot 接通了沒、訂單、等核准、排產、日報、日誌），用來示範「Cloudflare 也能放網頁」。成功標準見 `company-data/owner-acceptance.md`（轉正四條）。

## 五個工位

| 工位 | 對誰 | 給它什麼資料 | 准它做什麼 | 不准（程式裡根本不提供） |
|---|---|---|---|---|
| `service` 門市客服 | 客人 | 門市品項（含過敏原）、客製選項表、阿珠姨的規則 | 回答品項／過敏原／前置天數／退訂規則；客製與禮盒報價；**收下訂單需求**（問齊：尺寸或盒數、取貨日、稱呼、電話） | 查任何訂單內容與電話、答應折扣、核准、刪除 |
| `intake` 接單員 | 店裡 | 需求表、訂單、產能 | 把需求轉成訂單（驗前置天數、產能、師傅確認級）；查訂單；收訂金；改口味（截止前）；**送出**加急／取消／折扣申請 | 刪除訂單、核准、直接改價、跳過店長 |
| `kitchen` 廚房排產 | 廚房 | 訂單、設備狀態、排班 | 算某天的產能、排產單、備料；超過產能標紅 | 改、移、取消任何訂單，核准 |
| `desk` 內勤小幫手 | 員工 | 排班、設備、訂單 | 本人打卡；**送出**請假申請（提醒人手不夠）；設備報修（烤箱會讓廚房那天產能下修）；查訂單進度、排班 | 替別人打卡或請假、核准、改訂單 |
| `report` 老闆日報 | 老闆 | **只有工作日誌**與待核准的申請 | 產生日報 | 改任何資料、核准 |

## 小模型怎麼接話（五個工位都一樣）

一句話進來 → **小模型從「這個工位拿得到的工具」裡挑一個、把參數填好** → 程式照規則執行 → 把結果回給人。小模型只做第一步（聽懂人話）；金額、天數、產能、誰能做什麼，在第二步的程式裡算。

| 工位 | 它的工具菜單（菜單上沒有的，它就是做不到） |
|---|---|
| `service` | 蛋糕報價、禮盒報價、收下需求、查品項、回答規則；**decline**（折扣、查別人的訂單、刪除／核准／改價） |
| `intake` | 列需求、師傅確認、轉單、查單、收訂金、送加急／取消／折扣申請、改口味；**decline**（刪除、核准、改價） |
| `kitchen` | 查某天排產；**decline**（改／移／取消訂單） |
| `desk` | 查排班、打卡（本人）、請假（本人）、報修、查進度；**decline**（替別人、核准、改訂單） |
| `report` | 產生日報；**decline**（改數字、核准） |

做法的幾個要點（都是實作時出過包的）：

- 用 Workers AI 的**小模型**（`wrangler.toml` 的 `MODEL`，預設 8B），不需要另外申請金鑰。叫它輸出一行 JSON：`{"tool":"…","args":{…}}`，後端再檢查：工具名要在這個工位的菜單裡（不在＝當成 decline）、參數要符合格式。
- **小模型填的參數，原話裡真的有才算數。** 它會把沒說的欄位湊一個合理的值（例如客人沒說取貨日，它填「今天」），結果工位不追問、直接收下錯的單。日期、編號、尺寸能用程式從原話抓的，用程式抓；抓不到才看小模型填的，而且要在原話裡找得到。訂單編號只信原話裡出現的。
- 菜單上要放**幾個範例**（一句話配一個正確的挑法），尤其是容易挑錯的：「客人要取消」是取消申請、不是查單；「算我便宜點」是 decline。
- 小模型逾時、掛了、回得亂七八糟：不要 500，回一句白話（「我現在腦筋打結，請再說一次」）並記進日誌。
- 費用：測試一輪約 65 次呼叫，在 Workers AI 免費額度內；不要寫迴圈反覆重跑。

## Telegram

一個 bot（在 @BotFather 建，拿到 token），Telegram 把每則訊息 POST 到 Worker 的 `/api/telegram/webhook`。**學員在 Telegram 這件事上只做兩個動作：領 token、把 token 貼進 Cloudflare 後台的 Secret**；不用拼任何網址、不用自己編密語。「告訴 Telegram 把訊息送到這個 Worker」（`setWebhook`）由 **Worker 自己做**（見下方〈Worker 自己接上 Telegram〉）。你不會拿到 bot token，也不要去問。

| 誰 | 怎麼認 | 進哪個工位 |
|---|---|---|
| 客人（任何人） | — | 只能進 `service` |
| 店員 | `wrangler.toml` 的 `TELEGRAM_STAFF`（Telegram 使用者編號 → 員工名字） | 預設 `desk`；`/客服 /接單 /廚房 /內勤 /日報` 換工位；員工名字就是工位收到的 `user` |
| 店長 | `TELEGRAM_MANAGERS`（使用者編號） | 同店員，另外：工位送出申請時**店長會收到訊息，附「核准／退回」按鈕**；`/待核准` 列出全部 |

- 對 bot 說 `/id`，它回你的 Telegram 編號（設定店員、店長時要用）。
- 秘密只有一個：`TELEGRAM_BOT_TOKEN`，由學員直接填進 Cloudflare 後台（Worker → Settings → Variables and Secrets → Secret），不經過你、不寫進任何檔案。程式裡只讀 `env.TELEGRAM_BOT_TOKEN`；沒設時 `/api/telegram/webhook` 回 503 並說明缺它。webhook 密語（Telegram 帶在 `X-Telegram-Bot-Api-Secret-Token` 標頭裡、Worker 用來認「真的是 Telegram 送的」）**由 token 算出來**（例如 SHA-256 十六進位字串，只含英數字），不要叫學員編、不要叫學員放。部署好之後，學員貼完 Secret 對你說「幫我檢查 Telegram 接好了沒」，你用 `telegram-check` 技能去查（`node .claude/scripts/check-telegram.mjs <Worker 網址>`）：沒接好就由 Worker 自己向 Telegram 登記（你不拿 token），最後回報「已接上」或「卡在哪」；學員打開儀表板也會觸發同一件事。
- 核准／退回**只有店長的按鈕走得到**，不經過任何工位、不經過小模型；按的人不是店長要拒絕。
- 客人資料不齊時（「還需要：取貨日期、電話」），下一句只補缺的就要接得起來：把上一句存起來，和這一句合併再處理。
- 回覆太長要截斷（Telegram 單則上限 4096 字）。

### Worker 自己接上 Telegram

- 儀表板每次載入都會問 `GET /api/telegram/status`。後端在這時：先問 Telegram 它記得的 webhook 網址（`getWebhookInfo`）；**空的或不是「這個 Worker 的網址 + `/api/telegram/webhook`」，就由 Worker 自己呼叫 `setWebhook` 登記**（`secret_token` 用上面算出來的密語），登記完再讀一次確認。已經登記對的就不重複登記。
- 為什麼放在狀態網址：CC 查接好了沒、學員開儀表板都會打它，而 Telegram 要求登記的網址必須是這個 Worker 的 https 網址，Worker 看自己收到的請求就知道。這個動作只動 Telegram 那一側，不改 D1、不寫日誌。
- 登記時用的 token、密語不得出現在回應、日誌、畫面（Telegram 回的錯誤文字若含它們要抹掉）。

### 儀表板上的「Telegram bot 接通了嗎」

儀表板（唯讀、沒有按鈕）有一格「Telegram bot」，學員打開就知道 bot 接通了沒；接不通時看得出卡在哪一環，不用問講師，也不用讓 Claude 碰 token。資料來自 `GET /api/telegram/status`（見 `orders/API-contract.md`），後端這樣判斷（由上往下，第一個不符合的就是卡點）：

| state | 條件 | 儀表板白話 |
|---|---|---|
| `secret-missing` | `TELEGRAM_BOT_TOKEN` 沒放 | Secret 還沒放：TELEGRAM_BOT_TOKEN（並說去哪貼） |
| `token-invalid` | token 放了，但問 Telegram（`getWebhookInfo`）被拒或連不上 | Telegram 不認這把 token／連不上 |
| `webhook-set-failed` | Telegram 記的網址空的或不對，Worker 想自己 `setWebhook`，Telegram 不收（或連不上） | Worker 想把網址登記給 Telegram，失敗了：（Telegram 的原文） |
| `delivery-error` | Telegram 回報最近送不進來（`last_error_message`，一小時內，或還有訊息積壓） | Telegram 想送進來失敗了：（原文，例如 403 Forbidden） |
| `ok` | 以上都沒有（剛剛才自動登記成功時，回應帶 `registered_now: true`，畫面寫「剛剛自動接上了」） | 已接通 |

要點：

- **儀表板沒有按鈕，token 與密語的值不能出現在畫面、API 回應或日誌**：回應只說「有沒有放」（true／false）；Telegram 回的錯誤文字若含 token 或密語要先抹掉；這個網址不寫工作日誌。
- 儀表板上不放任何按鈕（不能從網頁放 Secret）；缺 Secret 或 token 不對時，畫面用白話告訴學員去 Cloudflare 後台貼；webhook 不用學員做。
- 問 Telegram 的動作由 Worker 做（Worker 本來就持有 token）；Claude 不需要、也拿不到 token。
- 這個網址讀不到（例如後端還沒做）時，儀表板顯示「還沒有 Telegram 狀態」，不要讓整頁壞掉。

## 小模型三格（每個工位做之前先填滿）

| 格 | 每個工位的答案 |
|---|---|
| 給它什麼資料 | 上表「給它什麼資料」欄；資料來源是 D1（訂單、排班、設備、日誌）與 Arcrun RAG（店的規則） |
| 准它做什麼動作 | 上表「准它做什麼」欄；**一個工位只拿到它需要的工具** |
| 怎麼驗它做對 | `tests/<工位>/`（T＝答得對、X＝擋得住）＋ `scenario/one-day-script.md` |

## 原則

1. **能用程式判斷的，不交給小模型判斷**：價格、前置天數、產能、退訂比例、誰能做什麼，都寫在工具裡。小模型只負責聽懂人話、把結果說成人話。
2. **該擋的，不是在提示詞裡叫它「小心一點」，是工具根本沒有**：刪除、核准、改價，沒有這些工具。
3. **每個動作都留日誌**，日報從日誌長出來；日報工位不准碰別的資料。
4. **改任何工位之前，先查 Arcrun（店的規則）、再讀這份與 `orders/API-contract.md`。**

## 順序（對應課程的實作）

1. 先蓋 `service`，接上 Telegram（客人在 Telegram 上問得到、答得對、擋得住），再部署儀表板頁（前端已做好，打合約裡的網址，含 `/api/telegram/status`）。
2. 接上舊訂單系統的資料後，加開 `intake`、`kitchen`；再加 `desk`。
3. 全部工位都加上工作日誌後，蓋 `report`。
4. 每蓋完一個，跑測試；紅燈就修，全綠才部署。

## 驗收

`tests/` 全綠、`scenario/one-day-script.md` 全綠，才部署。
