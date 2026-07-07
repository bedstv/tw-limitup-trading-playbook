# TW Limit-up Trading Playbook

一頁式台股漲停後交易規則手冊，整理：

- D0 盤後漲停候選與 A／B 型量價分類
- 次一交易日可能處置與當年度累積 EPS 虧損警示
- D1 大盤路由、當沖確認與停損
- 當沖未獲利但相對強勢時的留倉判定
- D1 爆量開高走低後的 D2+ 重返跳空價觀察
- D0、D1、D2+ 通知時程與固定輸出格式

目前回測規格狀態為`locked_v1`；已鎖定2,000張備選、D2失效價、D1跳空追價與
09:15大盤強弱判定，後續調整必須保留V1結果作為基準。

P1 已建立跨專案共用資料層 `../tw-market-data`，並完成 20 檔、2016 至今的可行性
樣本。實抓結果與尚缺資料見
[P1 共用資料層可行性報告](references/p1_data_feasibility.md)。

P1.1 已建立全市場官方漲停價事件產生器；目前完成 2026-06-01 至 2026-07-03
事件輸出，仍因歷史處置、EPS公告時間、TPEx下櫃主檔及一個TWSE暖機缺日而標示
為 provisional。詳見
[P1.1 全市場 D0 漲停事件表](references/p11_limitup_event_table.md)。

P1.2a 已完成 2016 Q1 歷史回填試跑，確認官方逐日全市場資料可支援舊年度事件表；
試跑產出 299,400 筆價格列、1,015 筆 D0 漲停事件與 106 筆事件回測候選。詳見
[P1.2a 歷史回填試跑](references/p12_historical_backfill_pilot.md)。

P1.2b 已完成 2016 至 2026-07-07 全市場 D0 漲停事件回填與合併；共 59,256 筆
D0 漲停事件、9,900 筆可進事件回測候選，重複事件 key 與漲停驗證失敗皆為 0。
詳見 [P1.2b 完整歷史事件回填](references/p12_full_historical_event_backfill.md)。

P1.3 已完成 D1／D2 日線 outcome labels；9,900 筆候選全部輸出，其中 D1 開高走低
收綠且量 >= D0 1.5 倍者 969 筆，D2+ 五日內重返警示價者 504 筆。詳見
[P1.3 D1／D2 日線 outcome labels](references/p13_daily_outcome_labels.md)。

P1.4 已完成日線可驗證訊號統計；V1 候選池 D1 blowoff 後五日內曾重返警示價為
52.0%，但要求重返早於失效價時降為 22.8%，放寬同日排序不明為 32.1%。詳見
[P1.4 日線可驗證訊號統計](references/p14_daily_signal_statistics.md)。

P1.5 已完成保守日線事件回測；D1 blowoff 969 筆中，保守進場 221 筆，成本後勝率
40.7%，平均報酬 +1.24%，中位數 -2.39%。結果顯示訊號不是高勝率策略，平均值主要
由少數大漲事件貢獻。詳見
[P1.5 保守日線事件回測](references/p15_conservative_daily_event_backtest.md)。

網站為純 HTML、CSS、JavaScript，可直接由 GitHub Pages 從 `main` 分支根目錄發布。

> 本專案僅為策略研究框架，不構成投資建議或獲利保證。所有參數均需經樣本外回測驗證。
