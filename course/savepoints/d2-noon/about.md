# D2 中午存檔點

狀態：門市客服、接單員、內勤小幫手、廚房排產都上線（D2 午餐前的狀態；老闆日報與劇本是下午的事）。

- 有的工位：service、intake、desk、kitchen
- 部署閘 `course/.ax303-gate`：`service,intake,desk,kitchen`
- 驗法：`node .claude/scripts/run-tests.mjs --stations service,intake,desk,kitchen` 全綠
- 怎麼用：對 Claude 說「從 D2 中午存檔點 接著做」（它會跑 `restore-savepoint` 這個技能）
- 不在這個存檔點裡的：知識庫（Arcrun RAG）的內容在你自己的雲端帳號裡，不在這個 repo；技能會幫你檢查有沒有，沒有就重新上傳 `course/company-data/`
