# P2.3 資料完整性修正：TPEx partial market / 錯日期快取

P2.3 先處理 Dashboard「不能用」的第一個硬阻塞：每日行情資料不完整。

## 問題

2026-07-07 Dashboard 原先顯示：

- `Partial market: 2026-07-07: TPEx`
- D0 候選 0 檔
- D1 觀察 4 檔，且全部 abnormal gap

進一步檢查發現兩個問題：

1. TPEx 2026-07-07 本地 cache 是空資料  
   官方 TPEx 實際已有 1012 筆資料，但本地 cache 可能是在官方資料尚未完全發布時抓到
   `totalCount=0`，後續 pipeline 因為 cache 已存在就不再重抓。

2. TWSE cache 有日期錯置風險  
   本地曾出現 `2026-07-07` cache 內容卻像 `106年07月18日` 的資料。這比缺資料更危險，
   因為系統可能在使用錯日期行情而不自知。

## 修正

在 `tw-market-data` 中加入：

- payload 日期解析：
  - TWSE `115年07月07日` → `2026-07-07`
  - TPEx `115/07/07` → `2026-07-07`
- 快取日期驗證：
  - 若 cache payload 日期不等於 requested date，強制重抓。
- 空資料重抓：
  - 若 TWSE/TPEx parse 後沒有行情列且不是手動 `--force`，強制重抓一次。
- 單元測試：
  - TWSE title 日期解析。
  - TPEx table date 日期解析。

## 驗證結果

以 2026-07-07 重新跑 P2.1 pipeline：

| 指標 | 修正前 | 修正後 |
|---|---:|---:|
| current-year partial_market_dates | `2026-07-07: TPEx` | 無 |
| current-year download_complete | false | true |
| current-year price rows | 496,870 | 498,988 |
| current-year selected candidates | 1,170 | 1,172 |
| merged selected candidates | 9,904 | 9,906 |
| D0 candidates | 0 | 2 |
| D1 watch | 4 | 10 |
| D1 abnormal gap | 4 | 0 |
| D2+ watch | 1 | 3 |

Dashboard 2026-07-07 現在：

- D0 候選：
  - 6525 捷敏-KY
  - 6259 百徽
- D1 觀察 10 檔
- D2+ 觀察 3 檔
- `partial_market_dates={}`

## 還不能 trade-ready 的原因

P2.3 修掉的是「每日行情完整性」。Dashboard 仍會顯示 `trade_ready=false`，因為還有三個
實戰阻塞：

1. 尚未接 D1 09:15 分時大盤 regime。
2. EPS/處置仍未完成每日 as-of 風險封存。
3. Corporate action 還未接專門資料源。

## 下一步

下一個最應優先處理的是 P2.4：Corporate action feed。

原因：若除權息、減資、分割沒有正式資料源，D1 gap 仍可能被誤判。這會直接影響 D1
追價/放棄判斷與 D2+ 重返警示價觀察。
