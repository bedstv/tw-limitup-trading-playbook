# P1.2b 完整歷史事件回填：2016 至 2026-07-07

目的：建立可供後續 D1／D2 outcome labeling 與策略回測使用的全市場 D0 漲停事件母表。

## 執行範圍

- 共用資料層：`../tw-market-data`
- 年度回填指令：

```bash
python3 scripts/backfill_p12_years.py \
  --start-year 2018 \
  --end-year 2026 \
  --final-end-date 2026-07-07 \
  --workers 1
```

2016、2017 已先以同一流程個別完成；最後使用下列指令合併：

```bash
python3 scripts/merge_p12_events.py \
  --start-year 2016 \
  --end-year 2026 \
  --output-tag p12_2016_2026
```

## 產出

- 合併事件表：`../tw-market-data/data/processed/d0_limitup_events_p12_2016_2026.csv`
- 合併健康報告：`../tw-market-data/data/manifests/p12_2016_2026_event_health.json`

## 總體健康摘要

| 指標 | 數值 |
|---|---:|
| 年份範圍 | 2016 至 2026-07-07 |
| 年度檔數 | 11 |
| missing_years | 0 |
| failed_dates | 0 |
| event_count | 59,256 |
| event_stock_count | 2,024 |
| duplicate_event_key_count | 0 |
| closed_limit_up_false_count | 0 |
| price_limit_verified_false_count | 0 |
| base_candidate_count | 11,550 |
| selected_for_event_backtest_count | 9,900 |
| fallback_activated_date_count | 1,896 |

## 年度摘要

| 年度 | price_rows | D0漲停事件 | base_candidate | selected_for_event_backtest | failed_dates | partial_market_dates |
|---:|---:|---:|---:|---:|---:|---:|
| 2016 | 571,726 | 3,303 | 394 | 382 | 0 | 2 |
| 2017 | 577,157 | 3,733 | 960 | 874 | 0 | 3 |
| 2018 | 602,841 | 4,218 | 644 | 591 | 0 | 1 |
| 2019 | 605,837 | 2,721 | 412 | 401 | 0 | 1 |
| 2020 | 623,195 | 7,350 | 1,345 | 1,129 | 0 | 1 |
| 2021 | 643,361 | 8,136 | 2,152 | 1,770 | 0 | 0 |
| 2022 | 650,939 | 4,312 | 512 | 506 | 0 | 2 |
| 2023 | 648,316 | 4,421 | 1,307 | 1,084 | 0 | 3 |
| 2024 | 668,674 | 6,596 | 1,675 | 1,373 | 0 | 2 |
| 2025 | 687,473 | 7,139 | 645 | 624 | 0 | 3 |
| 2026 | 489,739 | 7,327 | 1,504 | 1,166 | 0 | 2 |

## 本階段修補

1. 新增年度回填腳本 `scripts/backfill_p12_years.py`。
2. 新增年度事件合併與 health summary 腳本 `scripts/merge_p12_events.py`。
3. TWSE 新版 `rwd/zh/afterTrading/MI_INDEX` 對部分舊年度日期會回 HTML 安全性頁，因此加入官方 legacy `exchangeReport/MI_INDEX` fallback。
4. Python HTTPS 憑證鏈相容性失敗或 HTTP 307 時，改用系統 `curl --location` fallback，仍保留 HTTPS 驗證。

## 仍需保守標示

此事件母表可用於下一步 outcome labeling，但還不能直接視為可交易回測結果：

- historical current disposition 尚未 as-of verified。
- possible disposition next day 尚未 as-of verified。
- EPS 官方公告時間尚未串入。
- TPEx 歷史下櫃主檔仍不完整，`survivorship_biased = true`。
- partial market dates 已被保留在 health manifest，不會被假裝成完整資料。

## 下一步：P1.3

建立 D1／D2 outcome labels：

1. 對每筆 `selected_for_event_backtest = true` 的 D0 事件找 D1、D2 行情。
2. 標記 D1 開盤跳空、是否超過 5%／7%。
3. 標記 D1 是否開高走低、收綠、量是否為 D0 的 1.5～2 倍以上。
4. 標記 D1 當沖情境：觸價、停損、相對強勢留倉。
5. 標記 D2+ 觀察：是否重返 D1 跳空價／開盤價，以及失效價是否跌破。

完成 P1.3 後，才能進入第一版勝率、平均報酬、MFE／MAE 與成本後績效統計。
