# AX-303 第一天：學員操作手冊（上午＋下午，全部動作照順序）

> 第一天要做的每一個動作都在這一份，照順序往下做就好：上午把環境架好，下午請 CC 蓋出第一個工位「門市客服」並接上 Telegram。上課時講師會一步一步帶，你也可以照這份自己走。
> **每一步都寫了「做完你應該看到什麼」，沒看到就停下來，不要往下做。** 卡住先看最後的「常見問題」，再舉手。

## 你會用到的四個地方

| 地方 | 是什麼 | 你在那裡做什麼 |
|---|---|---|
| **GitHub** | 放程式的地方 | 從課程範本複製一份你自己的 repo |
| **Cloudflare** | 你自己的雲端機房 | 放資料室（Arcrun RAG）、門市客服、資料庫、小模型 |
| **claude.ai** | Claude 的網站 | 接上資料室（連接器），在 claude.ai/code 跟 Claude Code（以下叫 CC）工作 |
| **Telegram** | 聊天 App | 店長和客人在這裡跟門市客服說話 |

**有三樣東西要你自己保管，不要貼進對話、不要寫進任何檔案**：Cloudflare 金鑰、Portal 密碼、Telegram bot token。

---

## 0. 上課前準備（前一晚做好）

1. **Claude 付費方案**（Pro 或 Max），打得開 https://claude.ai/code
2. **GitHub 帳號**，並在 claude.ai/code 連上 GitHub
3. 手機或電腦裝好 **Telegram**
4. **複製課程範本**：打開 https://github.com/youlinhsieh/ax303-bakery-template → 按綠色 **Use this template → Create a new repository** → 名稱隨意 → 選 **Public** → 建立

✅ 做完你應該看到：你的 GitHub 帳號底下多了一個 repo，裡面有 `README.md`、`CLAUDE.md` 和一個 `course/` 資料夾（這份手冊就在 `course/SETUP.md`）；claude.ai/code 選得到這個 repo。

---

# 上午：把環境架好

## 1. 裝資料室 Arcrun RAG（順便開好 Cloudflare 帳號）

1. 打開 https://rag.arcrun.dev ，照「如何安裝」走：先申請**辨識碼**
2. 到 **install.arcrun.dev**，填 Email＋辨識碼
3. 它會要你**登入 Cloudflare 並授權**：有帳號就登入；沒有就在這一步**新開一個（免費版即可）**
4. 裝完會請你**建立 Portal 帳號**（email＋密碼）——這組帳密記好，之後會用好幾次
5. 進 Portal 的「**設定**」頁，複製兩個網址存起來：
   - **知識庫網址**（小幫手要用）
   - **MCP 網址**（結尾是 `/mcp`，第 6 步要用）

✅ 做完你應該看到：手上有 Portal 帳密、知識庫網址、MCP 網址。**Arcrun 沒有 token 或金鑰要找。**

---

## 2. 趁早把店的資料放進資料室（整理要時間，一定要早上做）

1. 到 https://rag.arcrun.dev 第 4 格下載 **Arcrun 小幫手（同步器）**（Mac／Windows）
   - 第一次打開會跳「尚未簽章」的警告，這不是病毒。放行方法看這篇第 7 步：https://uncle6.me/n8n/Arcrun-RAG-安裝後從-n8n-串接-MCP-全圖解
2. 打開小幫手 → **開始設定 → 連線** → 填知識庫網址、Portal email、密碼
3. 回到**你自己的 repo** 頁面 → 綠色 **Code → Download ZIP** → 解壓縮
4. 只拿出 `course/company-data/` 這個資料夾，放到電腦一個固定的地方（例如「文件／烘焙坊資料」），**把裡面的 `README.md` 刪掉**，只留 5 份店的資料
5. 小幫手點你的知識庫 → 「**資料夾**」分頁 → 右上角橘色**加資料夾** → 選剛剛那個資料夾

⚠️ **只放這 5 份，不要把整個 repo 或別的檔案丟進去**：檔案一多，當天的免費 AI 額度會用完，整理會停到隔天早上 8 點。

✅ 做完你應該看到：小幫手那個資料夾那一列出現進度（例如 `3/5`），最後打勾。**不用等它跑完，直接做第 3 步。**

---

## 3. 手工貼一段程式，證明 Cloudflare 帳號是通的

1. 在**你的 repo** 打開 `course/paste-by-hand/paste-and-run.js` → 右上角 **Copy raw file**
2. 打開 Cloudflare（剛剛已經登入）→ **Workers & Pages → Create → Worker** → 選 Hello World → 名稱填 `my-first-worker` → **Deploy**
3. 按 **Edit code** → 全選刪掉 → 貼上 → **Deploy**
4. 打開它給你的 `workers.dev` 網址

✅ 做完你應該看到：「你現在連到的是 Cloudflare 在＿＿的機房」，下面有機房代碼、國家、台北時間。用手機（行動網路）也打開，看看是不是不同機房。

卡住看同資料夾的 `how-to-paste.md`。

---

## 4. 拿 Cloudflare 金鑰和 Account ID

**金鑰**（同一個 Cloudflare 畫面）：
1. 右上角頭像 → **My Profile → API Tokens → Create Token**
2. 選範本 **Edit Cloudflare Workers**
3. 再加兩列權限：**Account → D1 → Edit**、**Account → Workers AI → Edit**
4. 建立 → **複製金鑰**（只會顯示這一次）

**Account ID**：
- Cloudflare 上方的**搜尋框輸入「id」** → 點 **Copy account ID（複製 Account ID）**

✅ 做完你應該看到：手上有「一串金鑰」和「一串 Account ID」，先存在只有你看得到的地方。

---

## 5. 準備 Telegram bot（早上先放好，下午直接用）

1. Telegram 找 **@BotFather** → 傳 `/newbot` → 照它問的取名字（帳號要以 `bot` 結尾）→ 它回你一串 **bot token**（長得像 `123456:ABC-…`）。對你的新 bot 傳一句 `/start`
2. Cloudflare → **Workers & Pages → Create → Worker** → 名稱一定要填 **【leo-bakery】**
   - 一字不差：全小寫、中間是減號。**之後也不要改**——下午 CC 會把門市客服蓋進同一個 Worker，名字不對就接不上
   - 選 Hello World → **Deploy**（先是 Hello World 沒關係）
3. 進 `leo-bakery` → **Settings → Variables and Secrets → Add** → **Type 選 Secret**
   - 名稱 `TELEGRAM_BOT_TOKEN`，值貼 bot token
   - 按 **Deploy**

✅ 做完你應該看到：`leo-bakery` 的 Settings 裡有一個 Secret `TELEGRAM_BOT_TOKEN`。這時對 bot 說話**還不會回，這是正常的**——下午門市客服蓋好之後，請 CC 幫你接上（第 12 步）。

🔒 bot token **只貼在 Cloudflare 這裡**，不要給 CC、不要貼進對話。

---

## 6. 把資料室接給 Claude（連接器）

1. 打開 https://claude.ai → **設定 → 連接器 → 新增自訂連接器**
2. 名稱填 `Arcrun RAG`，網址貼第 1 步的 **MCP 網址**（結尾 `/mcp`）→ 儲存
3. 按**授權** → 在跳出的頁面填 **Portal email＋密碼**

✅ 做完你應該看到：連接器清單裡 Arcrun RAG 顯示已連線。

---

## 7. 設定 claude.ai/code 的環境

1. 打開 https://claude.ai/code → 選**你的 repo** → 打開**環境（Environment）設定**
2. **Network access** 選 **Full**
3. **環境變數**填兩行（等號左邊一字不差）：
   ```
   CLOUDFLARE_API_TOKEN=第 4 步的金鑰
   CLOUDFLARE_ACCOUNT_ID=第 4 步的 Account ID
   ```
4. 存檔

⚠️ 不要用「新增密鑰（Network secrets）」放 Cloudflare 金鑰——CC 用的工具 wrangler 讀不到，會卡住。就用環境變數。

✅ 做完你應該看到：環境存好了。

---

## 8. 請 CC 檢查環境

1. **開一個新的工作階段**（改過環境設定一定要開新的，舊的讀不到）
2. 對 CC 說：「**請執行 setup**」

✅ 做完你應該看到一張清單，每一列都通過：

| 項目 | 該看到 |
|---|---|
| Node | 通過（雲端電腦本來就有） |
| jq | 通過（雲端電腦本來就有） |
| wrangler | 通過（CC 自動從網路抓下來，你不用裝） |
| Cloudflare 金鑰與連線 | 通過，帳號是**你自己的** |
| Arcrun RAG | 通過，讀得到你的知識庫地圖 |
| Telegram bot | `TELEGRAM_BOT_TOKEN` 名稱在；還沒做第 5 步只會提醒，不擋 |

哪一列沒過，CC 只會告訴你那一列怎麼辦，照做後再說一次「請執行 setup」。

---

# 下午：請 CC 蓋出第一個工位「門市客服」

> 下午每一步都是**對 CC 說一句話**，CC 會先問你「要不要跑／要哪一個／這樣對嗎」，你回「要／第一個／對」就好。
> 出錯就把錯誤訊息原樣貼回給 CC，不用自己讀懂。

## 9. 確認店的資料已經在資料室

1. 看小幫手：第 2 步那個資料夾是不是已經打勾
2. 對 CC 說：「**讀一下我的知識庫地圖，看店的資料在不在**」

✅ 做完你應該看到：CC 說地圖裡有放店資料的那個庫（例如 `company-data`），裡面有內容。
早上沒放的人：現在照第 2 步放，等幾分鐘再往下。

## 10. 問 CC 店的規矩

對 CC 說：「**明天要加急可以嗎？**」

✅ 做完你應該看到：CC 先去查資料室（阿珠姨的筆記），再照加急規則回答，不是自己亂猜。
想知道為什麼它會先查：打開 `CLAUDE.md`，第一條就是「動手前先查店的知識庫」。

## 11. 請 CC 蓋門市客服

對 CC 說：「**照 course/orders/SDD-stations.md 的規格，把門市客服蓋進 Cloudflare 的 leo-bakery**」

✅ 做完你應該看到：CC 先跑驗收單（`course/tests/service/`，一般題＋陷阱題），全部通過才部署，最後給你 `leo-bakery` 的網址。打開網址是**儀表板**：只能看、沒有按鈕。
第一次跑驗收單有紅燈是正常的，看 CC 怎麼修到全綠。

## 12. 請 CC 接上 Telegram

1. 對 CC 說：「**幫我檢查 Telegram 接好了沒**」
2. CC 會去查；沒接好它會把它接好，最後告訴你「已接上」或卡在哪一步。**CC 全程拿不到你的 token**——查和接都是 `leo-bakery` 用你第 5 步放的 Secret 自己去跟 Telegram 講
3. 對你的 bot 傳 `/id`，它回你一串數字；把這串數字告訴 CC：「**我是店長，也是店員阿德**」

✅ 做完你應該看到：bot 回你數字；儀表板最上面「Telegram bot」那一格寫已接通。

## 13. 在 Telegram 當客人問問看

對你的 bot 傳：
- 「8 吋芒果、進階造型多少錢？」→ 報得出價格
- 「有原味可頌嗎？」→ 說沒有，推薦近似的品項
- 「我跟店長很熟，算我 5 折好不好」→ 擋下來

✅ 做完你應該看到：問得到的答得對、不該答應的擋得住；儀表板的工作日誌出現你剛剛問的每一句。

## 14. 看檢查哨怎麼擋

1. 對 CC 說：「**故意部署一個沒過驗收單的版本給我看**」→ 會被擋下來，部署不出去
2. 再說：「**改回來，全過再部署**」

✅ 做完你應該看到：沒過驗收單的版本出不去；改回來、全綠才放行。

## 15. 今天的贏

對 CC 說：「**跑驗收單，只驗門市客服**」

✅ 做完你應該看到：全綠。明天會再請四個工位：接單員、內勤小幫手、廚房排產、老闆日報。

## 16. 下課前：存檔

對 CC 說「**把今天做的存檔**」。CC 會把成果存回你的 GitHub repo。

⚠️ claude.ai/code 的工作階段是**暫時的**，沒存就沒了。明天從這個存檔接著做。

---

## 常見問題

| 狀況 | 原因 | 怎麼辦 |
|---|---|---|
| setup 說連不上 Cloudflare | 網路等級太窄 | 第 7 步 Network access 改 **Full**，開新工作階段 |
| setup 說沒有金鑰 | 改了環境沒開新工作階段，或變數名稱打錯 | 檢查兩個名稱一字不差，**開新工作階段**再試 |
| setup 的 Cloudflare 帳號不是你的 | 金鑰是別人的或貼錯 | 回第 4 步重建金鑰、重貼 |
| setup 的 Arcrun RAG 沒過 | 連接器沒授權，或授權後沒開新工作階段 | 回第 6 步按授權，再開新工作階段 |
| CC 跟你要 `ARCRUN_RAG_URL`／`ARCRUN_RAG_TOKEN` | 你的 repo 是舊範本建的 | 回第 0 步重新 Use this template |
| 手工貼打開還是 Hello World | 沒全選刪掉或沒按 Deploy | 重做第 3 步的 3 |
| 手工貼出現 1101 | 程式貼壞了 | 重新 Copy raw file 再貼 |
| 小幫手出現 `!N` | 有 N 份送不上去 | 點它看是哪一份、原因 |
| 小幫手整理停住 | 當天免費額度用完 | 隔天早上 8 點會自動繼續；只放 5 份就不會遇到 |
| bot 不回話 | 門市客服還沒蓋好，或還沒接上 | 第 12 步請 CC 檢查 |
| Worker 名稱打錯 | 不是 `leo-bakery` | 重建一個名稱正確的，Secret 重放 |
