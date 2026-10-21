# AX-303 學員前置作業（先讀這一份）

> 📘 **第一天全部動作（上午＋下午）照順序寫在 [`course/SETUP.md`](course/SETUP.md)**，卡住先看那份最後的「常見問題」。

你不需要會寫程式。全程只在**瀏覽器**（和手機上的 Telegram）。終端機的事，都是 Claude 代勞。
Windows、Mac 做法一樣。**開課前只要完成下面四步**，每步都有「做完你應該看到什麼」。其餘的（Cloudflare、知識庫、金鑰、Telegram）第一天上午在現場一起做。

> **這門課的東西都在 `course/` 資料夾**：給你看的講義、手工貼，還有店的資料、規格、驗收單、存檔點（見 `course/README.md`）。根目錄其他的（`CLAUDE.md`、`.claude/`）是 Claude 的到職須知與工具，你不用打開。

> 這個 repo 是公開的範本，裡面沒有任何金鑰，也不要把你公司的真實資料放進來——課程全程用一家虛構的烘焙坊「里歐烘焙坊」與假資料。

## 開課前：四步

| 步驟 | 做什麼 | 做完你應該看到 |
|---|---|---|
| 1 | 訂閱 **Claude 付費方案**（Pro 以上），登入 claude.ai。若是公司帳號，先問管理員有沒有開放「網頁版 Claude Code」 | 瀏覽器打開 **claude.ai/code** 能進去，不是「無權限」畫面 |
| 2 | 開一個 **GitHub 帳號**（免費）：github.com | 登入後看到 GitHub 首頁 |
| 3 | 打開講師報名信附的範本網址，按綠色 **Use this template → Create a new repository**；名稱隨意，選 **Public** | 你的 GitHub 帳號底下多了一個自己的 repo，根目錄有 `README.md`、`CLAUDE.md` 和一個 `course/` 資料夾 |
| 4 | 到 claude.ai/code，依畫面連結你的 GitHub 帳號 | 在 claude.ai/code 的 repo 清單看得到你剛建的 repo |

> 這四步做完就可以上課。沒有 Cloudflare 帳號、沒有金鑰、沒有 Telegram bot 都沒關係，現場帶著做。

## 第一天上午「環境架設」現場做（講師帶，這裡先給你看有什麼）

| 現場步驟 | 做什麼 | 做完你應該看到 |
|---|---|---|
| A | 到 **rag.arcrun.dev** 照安裝畫面裝 **Arcrun RAG**。過程中它會要你**登入 Cloudflare**：有帳號就登入，沒有就在那一步**新開一個**（免費版即可）。Arcrun RAG 會裝在這個 Cloudflare 帳號裡 | 你手上有「MCP 網址」（`https://arcrun-mcp.….workers.dev/mcp`；登入 Portal 的設定頁也複製得到）和你登入 Portal 用的 email、密碼。Arcrun 沒有另外的 token 或金鑰。登入失敗請舉手，那是已知問題 |
| A2 | **趁早把店的資料放進資料室**（整理要時間，下午才用得到，所以早上就放）：<br>① 到 rag.arcrun.dev 第 4 格下載 **Arcrun 小幫手（同步器）**（Mac／Windows）並打開；第一次會跳「尚未簽章」警告，照 https://uncle6.me/n8n/Arcrun-RAG-安裝後從-n8n-串接-MCP-全圖解 第 7 步放行。打開後按**開始設定 → 連線**，填知識庫網址、Portal email、密碼；<br>② 在這個 GitHub repo 頁面按綠色 **Code → Download ZIP**，解壓縮後只拿出 `course/company-data/` 這個資料夾，放到電腦一個固定的地方（例如「文件／烘焙坊資料」），**把裡面的 `README.md` 刪掉**，只留 5 份店的資料；<br>③ 小幫手點你的知識庫 → 「資料夾」分頁 → 右上角橘色**加資料夾**，選剛剛那個資料夾。<br>⚠️ **只放這 5 份，不要整個 repo 或別的檔案丟進去**：檔案一多，當天的免費 AI 額度會用完，整理會停到隔天早上 8 點 | 小幫手那個資料夾那一列出現進度（例如 `3/5`），最後打勾 `5`。不用等它跑完，先往 B 做 |
| B | 打開 **Cloudflare**（就是剛剛裝 Arcrun RAG 時登入的那個，瀏覽器已經登入了）→ 照 `course/paste-by-hand/how-to-paste.md` 手工貼一個小程式，證明帳號和環境是通的 | 打開網址看到「你現在連到的是 Cloudflare 在 ＿＿ 的機房」 |
| C | 同一個 Cloudflare 畫面順手拿金鑰：右上角頭像 → **My Profile → API Tokens → Create Token** → 選 **Edit Cloudflare Workers** 範本，再加上兩列 **Account → D1 → Edit**、**Account → Workers AI → Edit**（小模型工讀生要用）。再在 Cloudflare 上方的**搜尋框輸入「id」**，點 **Copy account ID（複製 Account ID）** | 你手上有「一串金鑰」和「一串 Account ID」，先存在只有你看得到的地方 |
| D | **接給 Claude**，兩件事：<br>① 打開 claude.ai 的**設定 → 連接器 → 新增自訂連接器**，名稱填 `Arcrun RAG`，網址貼 A 的 MCP 網址，儲存後按**授權**，在跳出的頁面填你的 **Portal email ＋密碼**（就是你登入知識庫的那一組）；<br>② 在 claude.ai/code 選你的 repo，打開**環境（Environment）設定**，**Network access** 選 **Full**，然後在**環境變數**填兩行：<br>`CLOUDFLARE_API_TOKEN=C 的金鑰`<br>`CLOUDFLARE_ACCOUNT_ID=C 的 Account ID` | ① 連接器清單裡 Arcrun RAG 顯示已連線。② 環境存好。兩個 Cloudflare 的值只填在這裡，不要貼進對話、不要寫進任何檔案；Arcrun 這邊全程沒有 token 要填 |
| E | **開一個新的工作階段**，對 Claude 說：「請執行 setup」 | Claude 逐項檢查，結尾給你一張清單。**全部「通過」才往下**；哪一項沒過，Claude 只會告訴你那一項怎麼辦，照做再說一次「請執行 setup」。Arcrun RAG 那一列會真的讀一次你的知識庫地圖，讀得到才算通過。Telegram 那一列看 G 步放的 Secret（`TELEGRAM_BOT_TOKEN`）名稱在不在；還沒做 G 步會提醒你，但不擋 |

> 不用先另外去開 Cloudflare 帳號：開帳號是裝 Arcrun RAG 的其中一步。

**步驟 D 要填的東西，一次看清楚**

| 東西 | 是不是秘密 | 填在哪裡 | 怎麼填 |
|---|---|---|---|
| Arcrun RAG | 沒有金鑰，用 Portal 帳密登入 | claude.ai **設定 → 連接器** | 新增自訂連接器，貼 MCP 網址，授權時填 Portal email＋密碼 |
| Cloudflare 金鑰（C 拿到的那串） | **是** | claude.ai/code 環境設定 → **環境變數** | `CLOUDFLARE_API_TOKEN`＝金鑰（課堂預設；Network secrets 是選用、尚未驗證，見下方） |
| Cloudflare Account ID | 不是 | 同一個環境設定 → **環境變數** | `CLOUDFLARE_ACCOUNT_ID`＝Account ID |
| Telegram bot token | **是** | **Cloudflare 後台**（上午，見 G），不是這裡 | 直接填進 Worker 的 Secret，不經過 Claude |

> **選用、尚未驗證（課堂不要當預設，講師說可以再試）**：Cloudflare 金鑰也可以改放 **Network secrets → Add secret**：**Name** 填 `Cloudflare`；**Secret type** 照預設 **Bearer**；**Allowed websites** 填 `api.cloudflare.com`；**Custom headers** 那一列照預設（**Name** `Authorization`、**Prefix** `Bearer`），**Value** 貼 C 的金鑰；按 **Add**。存好看不到值也不能改，貼錯要刪掉重加；Team 方案沒組織管理員角色時是短表單（**Host** `api.cloudflare.com`、**Secret type** **Token**、**Value** 貼金鑰）。這條路 wrangler 能不能用還沒實測，所以預設是環境變數。

## 第一天上午「接 Telegram」現場做（環境架設時一起做好，下午直接用）

| 現場步驟 | 做什麼 | 做完你應該看到 |
|---|---|---|
| F | 在手機或電腦的 **Telegram** 找 **@BotFather**，傳 `/newbot`，照它問的取個名字（帳號要以 `bot` 結尾）。它會回你一串 **bot token**。再對你的新 bot 傳一句 `/start` | 你手上有「一串 bot token」（長得像 `123456:ABC-…`） |
| G | **token 不給 Claude**，自己放進 Cloudflare（只有這兩件事：建 Worker、貼 token；**不用拼任何網址、不用自己想密語**）：<br>① Cloudflare → **Workers & Pages** → **Create** → **Worker** → 名稱一定要填 **【leo-bakery】**（一字不差、全小寫、中間是減號；跟 `course/wrangler.toml` 一樣，之後也不要改）→ **Deploy**（裡面先是 Hello World 沒關係，下午 Claude 會把門市客服蓋進同一個 Worker）。<br>② 進這個 Worker → **Settings → Variables and Secrets → Add**，**Type** 選 **Secret**，名稱 `TELEGRAM_BOT_TOKEN`，值貼 F 的 token；按 **Deploy**。 | Worker 的 Secret 清單裡有 `TELEGRAM_BOT_TOKEN`（值是隱藏的，正常）。這時對 bot 說話還不會回，**正常**：下午 Claude 把門市客服蓋進 `leo-bakery` 之後，**對 Claude 說「幫我檢查 Telegram 接好了沒」**：它會去查，沒接好就讓 Worker 自己接好（你不用拼網址、不用編密語；Claude 全程看不到 token），最後回你「已接上」或「卡在哪」；儀表板最上面「Telegram bot」那一格也會變成綠色「已接通」。之後 Claude 部署新版，Secret 會留著 |

## 第一天下午：門市客服上線後

| 現場步驟 | 做什麼 | 做完你應該看到 |
|---|---|---|
| H | Claude 把門市客服部署到 `leo-bakery` 之後，先對 Claude 說「**幫我檢查 Telegram 接好了沒**」，等它回「已接上」（儀表板最上面「Telegram bot」那一格也是綠色「已接通」）；再對你的 bot 傳 `/id`，把回的數字交給 Claude，說「我是店長，也是店員阿德」 | bot 回你一串數字就是接通了；Claude 把編號寫進設定，之後你在 Telegram 上收得到「等核准」的按鈕。那一格是紅色就照它寫的白話處理（缺 Secret／Telegram 不認 token 要重貼）；還不行先找講師 |

## 課程資料夾地圖（從簡報點進來會到這些地方）

課程的東西全在 [`course/`](course/)，每個資料夾裡都有一份 README，寫著「這裡的東西幹嘛用、在簡報第幾頁用到、下一步去哪」。

| 資料夾 | 簡報 |
|---|---|
| [`course/handouts/`](course/handouts/) | 整堂課 |
| [`course/paste-by-hand/`](course/paste-by-hand/) | D1 第 9–12 頁 |
| [`course/company-data/`](course/company-data/) | D1 第 30–32 頁 |
| [`course/tests/`](course/tests/) | D1 第 34、38 頁；D2 各工位 |
| [`course/orders/`](course/orders/) | D1 第 35–37 頁；D2 第 7 頁 |
| [`course/scenario/`](course/scenario/) | D1 第 28、40 頁；D2 第 15–16 頁 |
| [`course/savepoints/`](course/savepoints/) | D2 第 3、9 頁 |
| [`course/data/`](course/data/) | D2 第 4 頁 |
| [`course/logs/`](course/logs/) | D2 第 13–14 頁 |

根目錄其他的（`CLAUDE.md`、`.claude/`）是 Claude 的到職須知與工具，不用動。

## 開課當天

- 帶一台有鍵盤的筆電（只需要瀏覽器），手機裝好 Telegram。
- 課程講義在你 repo 的 `course/handouts/` 資料夾；上課時講師會說現在看哪一段。
- 每個實作段做完，對 Claude 說「存檔」，你的進度才會留在自己的 repo 裡。

## 跟不上進度時（存檔點）

兩天的內容很多，落後是正常的。你的 repo 裡有兩個**存檔點**（`course/savepoints/` 資料夾）：

| 你對 Claude 說 | 接回的進度 |
|---|---|
| 「從 D1 存檔點接著做」 | 門市客服上線、過了自己的驗收單（D1 收場的樣子） |
| 「從 D2 中午存檔點接著做」 | 再加上接單員、內勤小幫手、廚房排產（D2 午餐前的樣子） |

Claude 會先把你原本寫的收起來（不會刪），放進存檔點的程式，跑驗收單給你看全綠，再跟全班一起往下走。後面的工位不在存檔點裡，還是要請 Claude 自己蓋。

## 安全提醒

- 金鑰只放在環境設定的環境變數（Cloudflare 金鑰）和 Cloudflare 後台的 **Secret**（Telegram），不貼進對話、不寫進檔案。課後想收回：Cloudflare 的 API Tokens 頁刪掉那一把、在 @BotFather 對 bot 傳 `/revoke` 換掉 token，環境設定裡刪掉 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 兩個變數（若試過 Network secret，也刪掉那一筆）、Cloudflare 後台 Worker 的 Telegram Secret（`TELEGRAM_BOT_TOKEN`）；Arcrun 那邊到 claude.ai 的連接器清單把 Arcrun RAG 移除。
- 看到任何畫面要你輸入金鑰、卻不是上面列的地方，先停下來問講師。

## 卡關了？

截圖你卡住的畫面，連同「我在第幾步」寄給講師。**不用自己搜尋，也不用自己開終端機。**
