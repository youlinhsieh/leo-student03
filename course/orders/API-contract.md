# 里歐烘焙坊 API 合約（前端、測試表、劇本都已經照這份寫好，後端照這份做）

> 本文件裡的路徑（`orders/`、`data/`、`tests/`、`scenario/`、`company-data/`、`wrangler.toml`）都在 repo 的 `course/` 底下；`course/` 就是烘焙坊的 Worker 專案根目錄。

儀表板 `orders/index.html`（唯讀，只能看；含「Telegram bot 接通了嗎」一格）、`tests/`、`scenario/`、Telegram 都只會打下面這些網址。**合約不能改**；後端做不到就回報，不要去改前端或測試。

## 一、資料放哪、怎麼進來

`data/` 底下的 CSV 是**店的舊系統匯出的起始資料**，要放進 D1：

| 檔案 | 內容 | D1 裡 |
|---|---|---|
| `orders.csv` | 20 張訂單（客製蛋糕＋禮盒團訂） | 訂單表，可被改（狀態、交期、金額、口味） |
| `customers.csv` | 8 位客戶 | 客戶表（接單員轉單時會新增客戶） |
| `equipment.csv` | 烤箱 A／B／C、攪拌機、冷藏櫃 | 設備表，可被改（報修） |
| `shifts.csv` | 員工 10/21–10/27 的排班（上班／休） | 排班表，可被改（請假核准後那天變「休」） |
| `staff.csv`、`products.csv` | 員工、門市品項 | 只讀，程式啟動時讀進來就好 |

另外 D1 要有：**需求表**（客服收下的訂單需求）、**申請表**（等店長核准的事）、**打卡表**、**工作日誌表**（見第四節）。

**資料表自己會建**（後端必做，否則本機開發第一次就 500）：`wrangler dev`（本機）和部署到 Cloudflare（遠端）用的是**兩份各自獨立的 D1**，新的那份一開始是空的。後端收到任何 `/api/` 請求時，先確認表存在（`CREATE TABLE IF NOT EXISTS`），訂單表是空的就用 CSV 填。`POST /api/reset` 同樣會先建表、再換回起始資料。做完要驗：**把本機 D1 資料夾（`.wrangler/state`）整個刪掉**再 `wrangler dev`、跑一次測試，不用任何手動指令就能跑。

> 店裡的「今天」固定是環境變數 `SHOP_TODAY`（`wrangler.toml` 的 `[vars]`，課程當天 `2026-10-21`）。後端所有「今天、明天、前置天數、離交期幾天」都用它算，**不要用真的現在時間**，否則劇本每天跑出來不一樣。

## 二、網址

| 動作 | 請求 | 成功回傳 |
|---|---|---|
| 列出全部訂單 | `GET /api/orders` | `{"orders":[…]}`，依 `order_id` 排序。每筆有：`order_id, type(cake\|box), customer(客戶名), item, size, flavor, shape, qty, points, amount, deposit, status, order_date, due_date, rush(0\|1), note, refund` |
| 查一張訂單 | `GET /api/orders/LEO-2610-006` | `{"order":{…}}`；沒有這張回 404 `{"error":"查無此訂單"}` |
| 列出申請 | `GET /api/approvals` | `{"approvals":[{id, kind(加急\|取消\|折扣\|請假), target, summary, status(待核准\|已核准\|已退回), requested_by, …}]}` |
| 核准／退回 | `POST /api/approvals/3/approve`、`POST /api/approvals/3/reject` | `{"approval":{…}}`；不是「待核准」回 409。**只有店長在 Telegram 按的按鈕（以及測試劇本裡代表店長的那一步）會走到這兩個網址，五個工位絕對不能呼叫** |
| 某天的排產單 | `GET /api/schedule?date=2026-10-22`（不給 date＝明天） | `{"date","capacity","ovens_ok","ovens_total","chefs_present","used","over","is_over","lines":[{order_id,customer,item,qty,points}],"materials":{…}}` |
| 工作日誌 | `GET /api/logs`、`GET /api/logs?station=desk` | `{"logs":[{id,ts,day,station,actor,action,target,result(ok\|blocked\|pending),summary,data}]}` |
| 老闆日報 | `GET /api/report/daily?date=2026-10-21`（不給＝今天） | `{"date","orders_new","amount",…,"text":"日報全文"}`；**只能從日誌與申請表算出來** |
| 五個工位 | `POST /api/<工位>/chat`，body `{"message":"…","user":"阿德"}`（`user` 可省略） | `{"station","reply":"工位的回答"}`；可以多帶 `via`（`model`＝小模型接的話、`rules`／`rules-fallback`＝規則備援）和 `tool`（小模型挑了哪個工具），測試表只看 `reply` |
| Telegram 入口 | `POST /api/telegram/webhook`（Telegram 呼叫，帶 `X-Telegram-Bot-Api-Secret-Token`；密語由 `TELEGRAM_BOT_TOKEN` 算出，學員不用編） | `{"ok":true}`；密語不對回 403，沒設 `TELEGRAM_BOT_TOKEN` 回 503 |
| Telegram 接通狀態（儀表板那一格） | `GET /api/telegram/status`（儀表板每次載入都打；**Worker 在這時發現 Telegram 還沒登記或登記錯網址，會自己 `setWebhook` 補登記**，見 `orders/SDD-stations.md`〈Worker 自己接上 Telegram〉） | `{"state","summary","secrets":{"TELEGRAM_BOT_TOKEN":bool},"missing":[…],"expected_webhook","registered_now":bool,"webhook":null或{url,pending,last_error_message,last_error_date}}`；`state` 是 `secret-missing`／`token-invalid`／`webhook-set-failed`／`delivery-error`／`ok`。**永遠 HTTP 200**（沒接通是狀態，不是錯誤）。**token 與密語的值絕不出現在回應或日誌**，只回有沒有放 |
| 重置資料（教學用） | `POST /api/reset` | `{"ok":true}`：訂單、客戶、設備、排班換回 CSV 起始資料；需求、申請、打卡、日誌清空。測試前會自動呼叫；**只在課程沙盒的 Worker 做**，不要放進真的公司系統 |

`<工位>` 是：`service`（門市客服）、`intake`（接單員）、`kitchen`（廚房排產）、`desk`（內勤小幫手）、`report`（老闆日報）。每個工位做什麼、能碰什麼，見 `orders/SDD-stations.md`。

沒有刪除訂單、新增訂單的網址（訂單只能由接單員工位轉單產生）。

## 三、規則（**後端要用程式算，不交給小模型判斷**）

規則的白話版在 `company-data/aunt-zhu-notes.md` 與 `custom-cake-options.md`；程式要照下面的數字做：

- **報價**：客製蛋糕＝尺寸（6 吋 680／8 吋 980／10 吋 1,380）＋口味（芒果 +100、抹茶紅豆 +80、香草巧克力 +0）＋造型（一般 0／進階 +400／師傅確認級 +1,000），乘以個數。禮盒＝單價（彌月 880／喜餅 1,200）×盒數，20 盒以上 9 折、50 盒以上 85 折，四捨五入到整數。訂金：蛋糕 3 成、禮盒 5 成。
- **點數**：6 吋 2、8 吋 3、10 吋 5（乘個數）；禮盒每盒 1。
- **前置天數**：一般 2、進階 4、師傅確認級 7；禮盒 30 盒以內 5、超過 10。
- **每日產能**＝可用烤箱數 × 15 ＋ 到班師傅數 × 5。烤箱「報修中」且報修日 ≤ 那天就不可用；師傅是 `staff.csv` 裡角色為「師傅」且那天排班不是「休」的人。已排點數＝交期在那天、狀態是待收訂金／已收訂金／排產中的訂單點數合計。超過產能＝標紅。
- **加急**：最短可提前到（離今天）一般 1 天、進階 2 天、禮盒 30 盒以內 3 天；師傅確認級與超過 30 盒的禮盒不收加急；加急費 30%；新交期那天產能要夠。**加急、取消、超額折扣、請假都只能「送出申請」，要店長核准才生效。**
- **取消退訂金**：離交期 ≥7 天退全額、3–6 天退一半、≤2 天不退。
- **改單**：交期前 3 天截止，之後不能改口味。
- **核准生效時**：加急＝交期改成新日期、金額加上加急費、`rush=1`（核准時產能要再驗一次，不夠回 409）；取消＝狀態「已取消」、記下退多少；折扣＝金額與訂金依新折扣重算；請假＝那天那個人的排班變「休」。

## 四、工作日誌（五個工位每個動作都要記）

每次工位被呼叫、做完一個動作（包含「被擋下」），都寫一筆日誌：`station、actor（誰在說話）、action、target、result、summary、data`。

- `result`：做成了＝`ok`；被規則擋下＝`blocked`；送出等店長核准的申請＝`pending`。
- 店長按核准／退回也記一筆（`station` 填 `manager`）。
- 老闆日報**不准自己去數資料表**，只能從日誌（與申請表的「待核准」）算出：今天接了幾單與金額、誰請假、哪台設備在修、被擋下幾件、哪些等核准。

## 五、日報要有的六段

一、接單（新成立訂單張數、金額、訂金）　二、店長核准　三、人與設備（打卡、請假、報修）　四、廚房（明天的產能與已排點數）　五、被擋下幾件（逐條簡述）　六、等店長核准幾件。

## 六、同一件事「失敗」要怎麼回

- 找不到的資料：HTTP 200，`reply` 說「查不到」，**不要編**。
- 被規則擋下：HTTP 200，`reply` 說明擋下的原因與正確的做法（例如「要店長核准」），日誌 `result=blocked`。
- 後端自己出錯：HTTP 500，`{"error":"後端出錯：原因"}`（測試表會把這句原樣記進紅燈記錄）。
