# P2.8 盤後自動更新

macOS LaunchAgent `com.bedstv.twlimitup.afterhours` 已安裝，於週一至週五 15:30 執行。

## 流程

1. 更新當年度 TWSE／TPEx 全市場行情。
2. 重建事件、D1/D2 outcome 與每日 brief。
3. 封存同日 EPS／注意／處置與公司行動。
4. 讀取同日 09:15 大盤 regime。
5. 產生 Dashboard JSON。
6. 驗證 `effective_date`、`afterhours_ready` 與 partial-market。
7. 僅在驗證通過後 commit 並 push GitHub Pages。

## 防呆與告警

- 休市日有效資料日不等於當天，不發布。
- 任一市場 partial data，不發布。
- pipeline、驗證、commit 或 push 失敗，顯示 macOS 失敗通知。
- 成功後顯示完成通知。
- 日誌位於 `tw-market-data/data/logs/afterhours.*.log`。
