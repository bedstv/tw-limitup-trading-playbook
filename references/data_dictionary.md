# V1 Data Dictionary

本資料字典定義回測欄位、單位、可用時間與防止偷看未來的規則。所有日期均為
Asia/Taipei 交易日；`D−1`、`D0`、`D1` 以實際交易日曆推進，不使用日曆日。

## 1. 識別與股票母體

| 欄位 | 型別／單位 | 定義 | 最早可用時間 |
|---|---|---|---|
| `date` | date | 交易日期 | 當日 |
| `stock_id` | string | 股票代碼，保留前導零 | 靜態／歷史主檔 |
| `market` | enum | `TWSE` 或 `TPEx` | 歷史主檔 |
| `security_type` | enum | V1僅保留普通股 | 歷史主檔 |
| `list_date` | date | 上市櫃日期 | 歷史主檔 |
| `delist_date` | date/null | 下市櫃日期 | 歷史主檔 |
| `day_trade_eligible` | bool | 當日是否可現股當沖 | 當日開盤前 |
| `currently_disposed` | bool | D0是否已在處置期間 | D0開盤前 |
| `altered_trading_method` | bool | 是否變更交易方法 | D0開盤前 |
| `full_day_suspended` | bool | 是否全日停止／暫停交易 | D0開盤前 |

股票母體必須以當時存在的股票建立；若只使用目前仍上市股票，報告必須標示
`survivorship_biased=true`。

## 2. 日線價格與成交量

| 欄位 | 型別／單位 | 定義 | 最早可用時間 |
|---|---|---|---|
| `open` | TWD/share | 開盤價 | 當日開盤後 |
| `high` | TWD/share | 最高價 | 當日收盤後才完整 |
| `low` | TWD/share | 最低價 | 當日收盤後才完整 |
| `close` | TWD/share | 收盤價 | 當日收盤後 |
| `volume_shares` | shares | 成交股數 | 當日收盤後才完整 |
| `volume_lots` | lots | `volume_shares / 1000` | 當日收盤後 |
| `trading_value` | TWD | 成交金額 | 當日收盤後 |
| `reference_price` | TWD/share | 當日開盤競價基準 | 當日開盤前 |
| `official_limit_up_price` | TWD/share | 依交易所基準價與升降單位得到的正式漲停價 | 當日開盤前 |
| `closed_limit_up` | bool | `close == official_limit_up_price` | D0收盤後 |
| `prior_20d_max_high` | TWD/share | D0以前20個交易日最高價，不含D0 | D0收盤後 |
| `median_volume_20d_lots` | lots | D0以前20日成交量中位數，不含D0 | D0收盤後 |
| `volume_ratio_median20` | ratio | `D0 volume_lots / median_volume_20d_lots` | D0收盤後 |

除權息、減資、面額變更與新上市首五日無漲跌幅資料必須另外標記，不能只用
`close / previous_close - 1` 判斷漲停。

若5,000張以上的主要候選少於5檔，事件回測應納入所有符合2,000至4,999張的
備選事件，不可只留下表現最好的5檔。實際通知則最多顯示5檔，依主要流動性群組、
週MACD剛金叉、日MACD剛金叉、成交量由高到低排序。

## 3. MACD與盤整特徵

| 欄位 | 型別 | 公式／定義 | 可用時間 |
|---|---|---|---|
| `daily_dif` | float | `EMA12(close) - EMA26(close)` | D0收盤後 |
| `daily_signal` | float | `EMA9(daily_dif)` | D0收盤後 |
| `daily_golden_cross_bars_ago` | integer/null | DIF最近一次由下往上穿越Signal距D0幾根日K | D0收盤後 |
| `weekly_dif_completed` | float | 前一完整交易週的週MACD DIF | D0收盤後 |
| `weekly_signal_completed` | float | 前一完整交易週的週MACD Signal | D0收盤後 |
| `weekly_golden_cross_bars_ago` | integer/null | 以前一完整週為截止點計算 | D0收盤後 |
| `consolidation_window_days` | integer/null | 5、10、15中最長的合格窗 | D0收盤後 |
| `consolidation_range` | ratio | `max(high)/min(low)-1`，不含D0 | D0收盤後 |
| `atr5` | TWD/share | 5日ATR，不含未來資料 | D0收盤後 |
| `atr20` | TWD/share | 20日ATR，不含未來資料 | D0收盤後 |
| `setup_type` | enum | `A`、`B`、`AB`、`UNCLASSIFIED` | D0收盤後 |

星期一至星期四不可把該週星期五的最終週K回填使用。本週未完成MACD只能作加分
欄位，不能通過硬篩選。

## 4. 警示與財務資料

| 欄位 | 型別 | 定義 | 可用時間 |
|---|---|---|---|
| `possible_disposition_next_day` | bool | D0官方累積注意名單明示次一營業日再達標可能處置 | D0盤後公告後 |
| `attention_count_window` | integer/null | 官方揭露的累積注意次數 | D0盤後公告後 |
| `currently_disposed` | bool | D0已在處置期間，V1直接排除 | D0開盤前 |
| `eps_fiscal_year` | integer | EPS所屬年度 | 財報公告後 |
| `eps_fiscal_quarter` | integer | 最新已公告季度 | 財報公告後 |
| `basic_eps_ytd` | TWD/share | 當年度累積基本每股盈餘 | 財報公告後 |
| `eps_announcement_timestamp` | datetime | 市場可得的實際公告時間 | 公告發生時 |
| `negative_ytd_eps` | bool/null | `basic_eps_ytd < 0`；無資料為null，不可當false | D0盤後 |

財報值必須以公告時間做as-of join，不能以季度結束日回填。處置風險也不能看到
D1實際遭處置後，再回填D0的`possible_disposition_next_day`。

## 5. D1市場與分鐘線

| 欄位 | 型別／單位 | 定義 | 可用時間 |
|---|---|---|---|
| `timestamp` | datetime | 一分鐘K結束時間 | 每分鐘結束後 |
| `minute_open/high/low/close` | TWD/share | 候選股一分鐘OHLC | 每分鐘結束後 |
| `minute_volume_shares` | shares | 一分鐘成交量 | 每分鐘結束後 |
| `intraday_vwap` | TWD/share | 截至當時累計成交金額／成交股數 | 當時 |
| `opening_5m_high` | TWD/share | 09:00至09:05完整區間最高價 | 09:05後 |
| `cum_volume_ratio_same_time` | ratio | 當日累積量／過去20日同時刻累積量中位數 | 當時 |
| `taiex_return_from_prev_close` | ratio | 指數當時值／前收−1 | 當時 |
| `taiex_intraday_vwap` | index points | 指數或可用代理的盤中VWAP | 當時 |
| `breadth_up_down_ratio` | ratio | 上漲家數／下跌家數 | 當時 |
| `stock_minus_taiex_return_pp` | percentage points | 個股報酬率減指數報酬率 | 當時 |
| `market_regime_0915` | enum | `STRONG`、`NEUTRAL`、`WEAK` | 09:15後 |
| `intraday_range_position` | 0..1 | `(price-low_so_far)/(high_so_far-low_so_far)` | 當時 |
| `D1_open_gap` | ratio | `D1 open / D0 close - 1` | D1開盤後 |
| `D1_entry_mode` | enum | `NORMAL_BREAKOUT`、`PULLBACK_ONLY`、`REJECT` | D1開盤後 |

日線資料不能產生可信的09:10成交、VWAP、停損先後順序或站穩三分鐘結果。這些欄位
若沒有分鐘線，必須保持缺值而不是用日高低價臆測。

`D1_open_gap <= 5%`可使用正常突破；`5% < gap <= 7%`禁止直接追價，只能在回測
不破停損、重新站上VWAP且報酬風險比合理後進場；`gap > 7%`在V1直接拒絕。

## 6. 進場、停損、留倉與D2+

| 欄位 | 型別／單位 | 定義 |
|---|---|---|
| `entry_trigger_price` | TWD/share | 第一個5分鐘高點 |
| `entry_timestamp` | datetime/null | 同時滿足全部進場條件後的第一個可成交時間 |
| `entry_fill_price` | TWD/share | 下一個可成交價加買進滑價 |
| `stop_price` | TWD/share | `max(D−1 close, D0 open)` |
| `stop_fill_price` | TWD/share | 觸及停損後第一個可成交價；跳空時不保證等於stop |
| `risk_budget_twd` | TWD | 帳戶權益×0.5% |
| `estimated_cost_per_share` | TWD/share | 佣金、稅與滑價折算 |
| `quantity_shares` | shares | 依風險公式計算後向下取整至1000股 |
| `hold_1310` | bool | 未獲利且13:10全部相對強勢條件成立 |
| `D1_volume_div_D0_volume` | ratio | D1全日量／D0全日量 |
| `reclaim_watch` | bool | 開高走低且量比在1.5至2.0（含） |
| `reclaim_trigger_price` | TWD/share | D1開盤價 |
| `reclaim_confirmed` | bool | 由下往上突破並連續3個完整分鐘收在其上，且量擴張 |
| `reclaim_invalidation_price` | TWD/share | `max(D1 low, D0 low)`；跌破較高支撐即失效 |
| `watch_age_trading_days` | integer | 進入觀察後經過的交易日數，最多20 |

## 7. 成本與績效欄位

| 欄位 | 單位 | 定義 |
|---|---|---|
| `gross_return` | ratio | 未扣成本交易報酬 |
| `commission_buy/sell` | TWD | 成交金額×0.1425%，另套最低手續費 |
| `transaction_tax` | TWD | 當沖賣出0.15%；隔夜股票賣出0.3% |
| `slippage_buy/sell` | TWD | 依V1日線或分鐘線滑價率計算 |
| `net_pnl` | TWD | 毛損益減全部成本 |
| `net_return` | ratio | `net_pnl / deployed_capital` |
| `MFE` | ratio | 持有期間最大有利變動 |
| `MAE` | ratio | 持有期間最大不利變動 |

成本假設必須做5、10、20、30bps單邊滑價敏感度，且報告毛報酬與淨報酬。

## 8. 資料健康旗標

每筆事件至少包含：

- `has_20d_history`
- `volume_unit_verified`
- `price_limit_verified`
- `weekly_bar_completed`
- `eps_asof_verified`
- `disposition_asof_verified`
- `minute_data_complete`
- `survivorship_biased`

任一必要旗標失敗時，不可靜默補值；應排除該事件並在資料健康報告計數。
