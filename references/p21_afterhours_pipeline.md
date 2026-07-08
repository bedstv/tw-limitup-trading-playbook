# P2.1 每日盤後資料更新 pipeline

P2.1 已建立在 `tw-market-data` 的每日盤後 orchestration script：

```bash
python3 scripts/run_p21_afterhours_pipeline.py \
  --as-of-date 2026-07-07 \
  --workers 1 \
  --dashboard-output-dir ../tw-limitup-trading-playbook/data/daily
```

## 目的

讓 P2.0 的每日 brief 不再只是手動從既有 processed data 產生，而是能用單一指令串起
盤後更新、事件合併、D1/D2 outcome、風險標記、大盤 regime proxy 與每日報表。

這一步是 Dashboard MVP 與通知系統的上游基礎。

## Pipeline 步驟

| step | 說明 |
|---|---|
| refresh_current_year_events | 更新當年度官方 TWSE/TPEx 日行情與 D0 漲停事件 |
| merge_historical_events | 合併 2016 至當年度的歷史 D0 事件表 |
| rebuild_selected_outcomes | 重建 selected D1/D2 outcome labels |
| refresh_risk_flags | 重建 EPS/處置風險標記 prototype |
| refresh_taiex_regime_proxy | 重建 D0 日線 TAIEX regime proxy |
| build_daily_brief | 產出 D0/D1/D2 brief 與 Markdown |
| write_dashboard_artifact | 若指定 `--dashboard-output-dir`，產出 GitHub Pages dashboard JSON 與 index |

## 2026-07-07 驗證結果

| 指標 | 結果 |
|---|---:|
| step_count | 6 |
| failed_step_count | 0 |
| current-year price rows | 496,870 |
| current-year selected_for_event_backtest | 1,170 |
| merged selected_for_event_backtest | 9,904 |
| selected outcome rows | 9,904 |
| D1 blowoff observations | 968 |
| D2+ reclaim touched | 504 |
| daily D0 candidates | 0 |
| daily D1 watch | 4 |
| daily D2+ watch | 1 |
| trade_ready | false |

輸出 health：

- `tw-market-data/data/manifests/p21_afterhours_2026-07-07_health.json`

每日報表：

- `tw-market-data/data/reports/daily_brief_2026-07-07.md`

Dashboard artifacts：

- `tw-limitup-trading-playbook/data/daily/2026-07-07.json`
- `tw-limitup-trading-playbook/data/daily/index.json`

## 已知限制

1. `trade_ready=false` 是預期狀態  
   P2.1 只完成盤後日線資料產出；仍缺 D1 09:15 分時大盤、分時觸價順序與完整風險
   as-of 封存，因此不能視為完整當沖交易系統。

2. 2026-07-07 有 partial market data  
   health 顯示 2026-07-07 TPEx 為 partial market。Pipeline 會保留此狀態，不會把資料
   假裝成完整。

3. Risk flags 仍是 prototype  
   EPS coverage 不完整，處置/注意資料目前仍是 current snapshot，未完成每日 as-of
   封存前，不能用來回推歷史。

4. Corporate action 仍需專門資料源  
   P2.0/P2.1 目前只用 abnormal gap flag 標示可疑跳空；後續需要除權息、減資、分割
   等 corporate-action feed，避免 D1 gap 誤判。

## 對 Dashboard 的意義

P2.1 產生的 artifacts 可直接作為 P2.2 Dashboard MVP 的資料來源：

- `daily_brief_d0_candidates_<date>.csv`
- `daily_brief_d1_watch_<date>.csv`
- `daily_brief_d2_watch_<date>.csv`
- `p21_afterhours_<date>_health.json`
- `data/daily/<date>.json`
- `data/daily/index.json`

Dashboard 第一版應先顯示：

- 資料日與 `trade_ready`
- D0 候選
- D1 觀察與 abnormal gap
- D2+ 重返觀察
- EPS/處置風險標記
- pipeline health 摘要
