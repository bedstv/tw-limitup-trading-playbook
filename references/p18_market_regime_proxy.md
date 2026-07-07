# P1.8 大盤 regime proxy

目的：先用 D0 已知的 TAIEX 日線資訊，粗略驗證「大盤強弱會影響 D1 blowoff 後交易結果」這個假設。此階段不是 09:15 分時 regime。

## 執行指令

共用資料層：`../tw-market-data`

```bash
python3 scripts/analyze_p18_market_regime.py \
  --trades-tag p15_2016_2026_selected \
  --output-tag p18_2016_2026_selected \
  --start-year 2016 \
  --end-year 2026
```

## 產出

- TAIEX regime 表：`../tw-market-data/data/processed/taiex_regime_p18_2016_2026_selected.csv`
- regime 交易表：`../tw-market-data/data/processed/trades_with_regime_p18_2016_2026_selected.csv`
- regime 統計：`../tw-market-data/data/processed/market_regime_stats_p18_2016_2026_selected.csv`
- health：`../tw-market-data/data/manifests/p18_2016_2026_selected_market_regime_health.json`

## 總體

- TAIEX 日線 regime 筆數：2,680
- D1 blowoff 訊號數：969
- missing regime：0

## Regime 結果

| D0 market regime | 訊號數 | 進場數 | 勝率 | 平均報酬 | 中位數報酬 | 停損率 |
|---|---:|---:|---:|---:|---:|---:|
| CRASH | 14 | 0 | - | - | - | - |
| NEUTRAL | 443 | 102 | 37.25% | +0.29% | -3.72% | 42.16% |
| STRONG_UP | 63 | 10 | 30.00% | -1.10% | -3.05% | 40.00% |
| TREND_DOWN | 70 | 14 | 42.86% | +4.23% | -1.44% | 35.71% |
| TREND_UP | 341 | 87 | 43.68% | +1.75% | -1.65% | 35.63% |
| WEAK_DOWN | 38 | 8 | 62.50% | +5.46% | +7.07% | 25.00% |

## 解讀

1. `TREND_UP` 比 `NEUTRAL` 好，勝率、平均、中位數、停損率都改善。
2. `NEUTRAL` 尤其弱，中位數 -3.72%，停損率 42.16%。
3. `WEAK_DOWN` 看起來最好，但進場只有 8 筆，不可採信。
4. D0 日線 regime 有訊號，但強度不足以讓整體中位數轉正。

## 與原始假設的關係

你的原始假設是：

- 大盤強：散戶追漲，只選量縮。
- 大盤弱或大跌：散戶逃命，帶量代表主力承接。

P1.8 只能粗略檢查 D0 已知大盤狀態，尚不能驗證 D1 09:15 的盤中情緒。因此目前結論是：

- 大盤 regime 值得保留。
- 但日線 proxy 不夠，P2 必須接 09:15 分時大盤。

## P2 延伸

P2 應建立：

- 09:15 TAIEX 或台指期 regime。
- D1 開盤後相對強弱。
- 強盤/弱盤下，D0 量縮/放量候選的分流統計。
