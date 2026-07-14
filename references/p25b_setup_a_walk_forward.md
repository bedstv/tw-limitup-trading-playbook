# P2.5b A 型研究候選池：結果與 walk-forward

本研究沿用 P2.5a 事先固定的定義，不更動每日選股規則。

| cohort | D0 候選數 |
| --- | ---: |
| 嚴格 A：量比 <= 1.20、ATR5 <= ATR20 | 31 |
| 放寬後新增：量比 <= 1.50、ATR5 <= ATR20 x 1.10 | 30 |
| 放寬 A 合計 | 61 |

以既有保守日線交易契約（D1 吹落訊號、15 bps 單邊成本、同日進場與停損不交易）評估：

| 指標 | 結果 |
| --- | ---: |
| D1 吹落訊號 | 14 |
| 實際成交 | 4 |
| 失效而未進場 | 10 |
| 驗證期（2022–2026）實際成交 | 4 |
| 探索期（2016–2021）實際成交 | 0 |

驗證期的 4 筆交易雖有正的平均與中位數報酬，但樣本遠低於預先設定的最少 10 筆，因此所有規則均判定為 `insufficient_sample`。

結論：A 型放寬候選池仍維持研究用途，**不得併入每日候選或紙上交易規則**。下一個合理步驟是累積可用的 1 分鐘線 forward paper-trading 資料，或取得可授權的歷史分鐘資料後，改用真實成交順序再驗證。

產物：

- `../tw-market-data/data/processed/d1_d2_outcomes_p25b_2016_2026_setup_a.csv`
- `../tw-market-data/data/processed/conservative_daily_trades_p25b_2016_2026_setup_a.csv`
- `../tw-market-data/data/processed/walk_forward_stats_p25b_2016_2026_setup_a.csv`
