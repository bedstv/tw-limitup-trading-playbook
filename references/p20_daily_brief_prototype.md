# P2.0 每日候選股 brief prototype

目的：將 P1 研究成果轉成每日可輸出的候選清單格式，包含：

- D0 盤後候選
- D1 觀察清單
- D2+ 重返警示價觀察
- EPS／處置風險欄位
- D0 大盤日線 regime proxy

此階段是離線 prototype，使用已處理資料，不是即時交易建議。

## 執行指令

共用資料層：`../tw-market-data`

```bash
python3 scripts/build_p20_daily_brief.py \
  --as-of-date 2026-07-07 \
  --output-tag 2026-07-07
```

## 產出

- D0 候選：`../tw-market-data/data/processed/daily_brief_d0_candidates_2026-07-07.csv`
- D1 觀察：`../tw-market-data/data/processed/daily_brief_d1_watch_2026-07-07.csv`
- D2+ 觀察：`../tw-market-data/data/processed/daily_brief_d2_watch_2026-07-07.csv`
- Markdown brief：`../tw-market-data/data/reports/daily_brief_2026-07-07.md`
- health：`../tw-market-data/data/manifests/daily_brief_2026-07-07_health.json`

## 2026-07-07 prototype 結果

| 清單 | 數量 | 說明 |
|---|---:|---|
| D0 盤後候選 | 0 | 5,000 張以上主池無候選 |
| D1 觀察 | 4 | 無 D1 blowoff |
| D1 abnormal gap check | 4 | 需人工確認除權息／資料基準 |
| D2+ 近期觀察 | 1 | 長榮航太已重返 |

## D1 觀察提醒

2026-07-07 D1 觀察的 4 檔都出現極端負 gap，因此 prototype 標記 `abnormal_gap_check = True`。這通常可能來自：

- 除權息或減資等價格基準變化。
- 官方行情與事件基準價不一致。
- 資料解析需進一步檢查。

P2 後續必須加入 corporate action filter，避免誤判跳空。

## 已完成的 pipeline 形狀

```text
D0 事件表
  -> 5,000 張以上主池
  -> risk flags
  -> D0 market regime
  -> D0 candidate CSV

P1.3 outcome labels
  -> D1 watch CSV
  -> D2+ reclaim watch CSV
  -> Markdown daily brief
```

## 尚未 trade-ready 的原因

- 尚未即時抓取當日資料。
- 尚未接 09:15 分時大盤 regime。
- 尚未接分時個股資料，無法判斷進場／停損先後。
- EPS／處置尚未完整 as-of。
- abnormal gap 尚未接 corporate action calendar。

## 下一步：P2.1

建立每日盤後資料更新流程：

1. 指定日期抓 TWSE／TPEx 收盤資料。
2. 更新 D0 事件表。
3. 重新產生 P2.0 daily brief。
4. 將 partial market dates、abnormal gap、risk flags 寫入 health。
5. 之後再接通知系統。
