# D1 存檔點

狀態：知識庫已接好、門市客服上線並過了自己的驗收單（D1 收場的狀態）。

- 有的工位：service
- 部署閘 `course/.ax303-gate`：`service`
- 驗法：`node .claude/scripts/run-tests.mjs --stations service` 全綠
- 怎麼用：對 Claude 說「從 D1 存檔點 接著做」（它會跑 `restore-savepoint` 這個技能）
- 不在這個存檔點裡的：知識庫（Arcrun RAG）的內容在你自己的雲端帳號裡，不在這個 repo；技能會幫你檢查有沒有，沒有就重新上傳 `course/company-data/`
