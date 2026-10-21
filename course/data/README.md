# data：舊系統匯出的資料

> 你在：學員範本 `course/data/`。頁碼是 AX-303 簡報的頁碼（D1＝第一天、D2＝第二天）。

**這裡的東西幹嘛用**：店裡舊系統匯出的試算表（CSV）。Claude 會把它們放進 Cloudflare 的 D1（雲端資料櫃），工讀生查訂單、排班、設備都靠這些。

| 檔案 | 內容 |
|---|---|
| [`orders.csv`](orders.csv) | 20 張訂單（客製蛋糕、禮盒團訂） |
| [`customers.csv`](customers.csv) | 客戶 |
| [`products.csv`](products.csv) | 品項 |
| [`staff.csv`](staff.csv) | 員工（Telegram 店員設定裡的名字要在這裡面） |
| [`shifts.csv`](shifts.csv) | 排班（請假要查） |
| [`equipment.csv`](equipment.csv) | 設備（報修要用） |

**什麼時候用**：D2 第 4 頁（舊系統的資料搬進雲端資料櫃）。對 Claude 說「把 course/data 資料夾的訂單、客戶、設備、排班放進 D1」。

**下一步**：[`../orders/SDD-stations.md`](../orders/SDD-stations.md)（D2 第 7 頁，加開三個工位）。
