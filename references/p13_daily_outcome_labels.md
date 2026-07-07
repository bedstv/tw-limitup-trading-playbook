# P1.3 D1／D2 日線 outcome labels

目的：把 P1.2b 產生的 D0 漲停候選，轉成可回測前的 D1／D2 結果標籤。此階段只使用日線 OHLCV，因此標籤可驗證，但尚不能代表真實分時成交回測。

## 執行指令

共用資料層：`../tw-market-data`

```bash
python3 scripts/build_p13_outcomes.py \
  --events-tag p12_2016_2026 \
  --start-year 2016 \
  --end-year 2026 \
  --output-tag p13_2016_2026_selected \
  --selected-only
```

另產出 all-events 對照組：

```bash
python3 scripts/build_p13_outcomes.py \
  --events-tag p12_2016_2026 \
  --start-year 2016 \
  --end-year 2026 \
  --output-tag p13_2016_2026_all
```

## 產出

- 交易候選標籤表：`../tw-market-data/data/processed/d1_d2_outcomes_p13_2016_2026_selected.csv`
- 交易候選健康報告：`../tw-market-data/data/manifests/p13_2016_2026_selected_outcome_health.json`
- 全漲停事件對照表：`../tw-market-data/data/processed/d1_d2_outcomes_p13_2016_2026_all.csv`
- 全漲停事件健康報告：`../tw-market-data/data/manifests/p13_2016_2026_all_outcome_health.json`

## 交易候選結果摘要

| 指標 | 數值 |
|---|---:|
| input_event_count | 9,900 |
| output_row_count | 9,900 |
| missing_price_key_count | 0 |
| missing_d1_count | 6 |
| D1 開盤跳空 > 5% | 1,967 |
| D1 開盤跳空 > 7% | 1,081 |
| D1 V1 可直接追價 | 7,927 |
| D1 跌破停損價（日線低點） | 1,971 |
| D1 留倉候選（日線 proxy） | 5,385 |
| D1 開高走低收綠且量 >= D0 1.5 倍 | 969 |
| D2+ 五日內重返 D1 警示價 | 504 |

## 全漲停事件對照組

| 指標 | 數值 |
|---|---:|
| input_event_count | 59,256 |
| output_row_count | 59,256 |
| missing_d1_count | 51 |
| D1 開高走低收綠且量 >= D0 1.5 倍 | 5,229 |
| D2+ 五日內重返 D1 警示價 | 2,358 |

## 標籤定義

- `d1_open_gap_pct`：D1 開盤相對 D0 收盤漲幅。
- `d1_gap_over_5pct`：D1 開盤跳空超過 5%，V1 不直接追價。
- `d1_gap_over_7pct`：D1 開盤跳空超過 7%，V1 視為拒絕追價。
- `d1_direct_chase_allowed_v1`：D1 開盤跳空未超過 5%。
- `d1_volume_ratio_d0`：D1 成交量 / D0 成交量。
- `d1_blowoff_observation`：D1 開高、收盤跌破開盤且跌破 D0 收盤，成交量 >= D0 的 1.5 倍。
- `d1_alert_reclaim_price`：若 D1 blowoff 成立，警示價取 D1 開盤價。
- `d1_stop_loss_price`：取 `max(D-1 收盤價, D0 開盤價)`；因為任一價位跌破即觸發停損，較高者會先被觸發。
- `d1_stop_touched_daily`：D1 日低跌破停損價。
- `d1_hold_candidate_daily_proxy`：D1 收盤仍 >= D0 收盤且未跌破停損價。這只是日線 proxy，正式相對強勢仍需大盤／分時資料。
- `d2_invalidation_price_v1`：取 `max(D1 低點, D0 低點)`。
- `d2plus_reclaim_touched`：D2 起 5 個交易日內，高點觸及 D1 警示價。

## 重要限制

此階段不可直接解讀為真實買賣績效：

- 日線 OHLCV 無法知道 09:15 前後的大盤強弱。
- 日線 OHLCV 無法知道高低點發生順序，因此停損與觸價的先後仍不確定。
- `d1_hold_candidate_daily_proxy` 尚未接入大盤相對強勢。
- 分時成交價、滑價與交易成本尚未模擬。

## 下一步：P1.4

建立第一版「日線可驗證」統計：

1. 先統計 D1 blowoff observation 之後，D2+ 重返警示價的機率。
2. 依 setup_type、流動性 bucket、D1 gap、D1 volume ratio 分群。
3. 加入停損失效條件，計算觀察成功率。
4. 不計真實當沖 PnL，只先計算條件命中率與風險標籤。
5. 若要進真實當沖回測，再補 5 分 K 或 1 分 K 與 09:15 大盤強弱。
