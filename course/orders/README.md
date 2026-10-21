# orders：工位規格與唯讀儀表板

> 你在：學員範本 `course/orders/`。頁碼是 AX-303 簡報的頁碼（D1＝第一天、D2＝第二天）。

**這裡的東西幹嘛用**：Claude 蓋工位時照著做的規格，以及店長看的那一頁唯讀儀表板。

| 檔案 | 用途 |
|---|---|
| [`SDD-stations.md`](SDD-stations.md) | 五個工位各做什麼、給哪些工具、哪些事要店長核准；Telegram 的店員／店長設定也在這 |
| [`API-contract.md`](API-contract.md) | 儀表板和 Telegram 會呼叫的網址與格式（前後端照它對接） |
| [`index.html`](index.html) | 唯讀儀表板：Telegram bot 接通了沒（卡在哪一環）、今天的訂單、等核准、排產、日報、日誌摘要；只能看、沒有按鈕 |

**什麼時候用**：D1 第 35 頁（全局圖）、第 36 頁（第一個工位）、第 37 頁（照規格蓋門市客服、接上 Telegram）；D2 第 7 頁（照 `SDD-stations.md` 加開三個工位）。
對 Claude 說「照 course/orders/SDD-stations.md 蓋…」就好，你不用讀懂它。

**下一步**：D1 收場後是 [`../savepoints/`](../savepoints/)；D2 從 [`../data/`](../data/) 開始。
