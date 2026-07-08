# P2.2 GitHub Pages Dashboard MVP

P2.2 已在 GitHub Pages playbook 中加入每日候選股 Dashboard MVP。

## 目的

把 P2.1 盤後 pipeline 產出的每日 artifacts 轉成可以直接查看的靜態看板，作為後續通知、
paper trading 與 production dashboard 的前身。

## 目前功能

- 資料日選擇器。
- 顯示 `trade_ready` 與資料健康摘要。
- 顯示 D0 盤後候選。
- 顯示 D1 觀察清單與 abnormal gap 檢查。
- 顯示 D2+ 重返警示價觀察。
- 顯示 EPS 虧損與可能處置風險標記欄位。
- 若資料載入失敗，頁面會明確顯示錯誤，不會靜默空白。

## 資料格式

Dashboard MVP 讀取：

- `data/daily/index.json`
- `data/daily/<date>.json`

目前已放入 2026-07-07 範例資料：

- `data/daily/2026-07-07.json`

這份資料已可由 `tw-market-data` 的 P2.1 afterhours pipeline 自動產生，不包含大型歷史行情。
範例：

```bash
python3 scripts/run_p21_afterhours_pipeline.py \
  --as-of-date 2026-07-07 \
  --workers 1 \
  --dashboard-output-dir ../tw-limitup-trading-playbook/data/daily
```

## 2026-07-07 範例資料狀態

| 指標 | 結果 |
|---|---:|
| trade_ready | false |
| P2.1 step_count | 6 |
| P2.1 failed_step_count | 0 |
| D0 候選 | 0 |
| D1 觀察 | 4 |
| D1 abnormal gap | 4 |
| D2+ 觀察 | 1 |
| D2+ 已重返 | 1 |

`trade_ready=false` 是預期狀態，原因是尚未接 D1 09:15 分時大盤、完整 as-of 風險封存
與 corporate-action feed。

## MVP 邊界

- 靜態 GitHub Pages，不需要後端。
- 不做登入。
- 不接即時報價。
- 不做下單或交易授權。
- 只顯示候選/觀察/資料健康狀態，不宣稱買賣建議或獲利保證。

## 下一步

1. Dashboard 支援最近 20 個交易日資料日切換。
2. 加入排序與篩選：主池/備選、A/B 型、風險標記、量比、gap、regime。
3. 接 corporate-action feed，降低 abnormal gap 誤報。
4. 接 09:15 分時大盤後，再顯示 D1 intraday regime 與相對強弱。
