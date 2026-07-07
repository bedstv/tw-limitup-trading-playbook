# P1.2a 歷史回填試跑：2016 Q1

目的：在正式回填 2016 至今前，先用 2016 Q1 驗證舊年度 TWSE／TPEx 官方端點、漲跌停價重建、MACD 暖機與候選股選取流程是否可運作。

## 執行範圍

- 共用資料層：`../tw-market-data`
- 指令：

```bash
python3 scripts/build_p11_events.py \
  --fetch-start-date 2015-06-01 \
  --output-start-date 2016-01-01 \
  --end-date 2016-03-31 \
  --workers 1 \
  --output-tag p12_2016_q1
```

`fetch-start-date` 早於輸出期，用來提供日 MACD、週 MACD 與 20 日量價特徵暖機。

## 產出

- 價格表：`../tw-market-data/data/processed/daily_price_full_market_p12_2016_q1.csv`
- 事件表：`../tw-market-data/data/processed/d0_limitup_events_p12_2016_q1.csv`
- 健康報告：`../tw-market-data/data/manifests/p12_2016_q1_event_health.json`

## 健康摘要

| 指標 | 數值 |
|---|---:|
| requested_weekdays | 219 |
| market_dates | 205 |
| failed_date_count | 0 |
| price_rows | 299,400 |
| price_stock_count | 1,663 |
| limitup_event_count | 1,015 |
| limitup_event_stock_count | 516 |
| verified_limit_event_count | 1,015 |
| base_candidate_count | 114 |
| selected_for_event_backtest_count | 106 |
| fallback_activated_date_count | 50 |
| primary_liquidity_event_count | 190 |
| fallback_liquidity_event_count | 198 |

## 額外驗證

- duplicate event keys：0
- `closed_limit_up = True`：全部通過
- `price_limit_verified = True`：全部通過
- manifest 的 `selected_for_event_backtest_count` 與事件表重算結果一致

## 已知缺口

`2016-01-12` 與 `2016-01-13` 的 TWSE 端點回傳無可用資料，但 TPEx 有資料，因此 health manifest 標示為 partial market dates。這兩天在完整回測前要再判斷是 TWSE 官方歷史端點缺漏、當時交易異常、或需改用替代歷史來源。

此階段仍保留 P1.1 限制：

- historical current disposition 尚未 as-of verified
- possible disposition next day 尚未 as-of verified
- EPS 官方公告時間尚未串入
- TPEx 歷史下櫃主檔不完整，結果仍標示 `survivorship_biased = true`

## 結論

P1.2a 通過。官方逐日全市場回填可以支援 2016 年舊資料；Python HTTPS 憑證鏈相容性問題已在共用資料層改為「urllib 優先、憑證相容性失敗時用系統 curl 且保留 HTTPS 驗證」的安全 fallback。

下一步可進入 P1.2b：

1. 分年產生 `p12_2016` 至 `p12_2026` 事件表。
2. 合併年度事件表並做跨年重複 key / 缺日 / partial market dates 報告。
3. 產生 D1 / D2 outcome labels，才進入第一版策略有效性回測。
