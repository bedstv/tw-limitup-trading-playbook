# P1.9 EPS／處置風險標記

目的：把使用者指定的兩個警示欄位接進資料層：

1. 候選股若 1 日內可能遭處置，需標示。
2. 候選股若當年累積 EPS 為虧損，需標示。

## 執行指令

共用資料層：`../tw-market-data`

```bash
python3 scripts/annotate_p19_risk_flags.py \
  --outcomes-tag p13_2016_2026_selected \
  --output-tag p19_2016_2026_selected
```

## 產出

- risk flags：`../tw-market-data/data/processed/risk_flags_p19_2016_2026_selected.csv`
- health：`../tw-market-data/data/manifests/p19_2016_2026_selected_risk_flags_health.json`

## 結果摘要

| 指標 | 數值 |
|---|---:|
| 候選列數 | 9,900 |
| EPS source rows | 756 |
| D0 as-of 可接到 EPS | 84 |
| EPS 負值 | 17 |
| EPS official timestamp verified | 0 |
| warning snapshot rows | 69 |
| warning snapshot date | 2026-07-03 |
| current snapshot currently disposed row matches | 551 |
| current snapshot possible next-day disposition row matches | 44 |

## 重要限制

P1.9 是功能接線與 coverage 檢查，不是完整歷史風險回測。

### EPS

目前 EPS 來源是既有樣本，不是完整全市場財報資料：

- 9,900 筆候選中，只有 84 筆可在 D0 as-of 方式接到 EPS。
- EPS availability 使用 conservative available date。
- 尚未接官方公告時間，因此 `eps_availability_verified = False`。

### 處置／可能處置

目前 warning data 是 `2026-07-03` 的 current snapshot：

- 可用於 P2 之後每日候選系統的即時標記。
- 不可用來回推 2016～2026 歷史 as-of 狀態。
- 因此 `disposition_asof_verified = False`。

## 結論

P1.9 已完成風險欄位資料模型與 prototype，但完整性不足以納入歷史績效判定。

進入 P2 後需做兩件事：

1. 每日封存 warning snapshot，從封存日起建立 as-of history。
2. 擴充 EPS 全市場資料，並取得或保守推估公告日。
