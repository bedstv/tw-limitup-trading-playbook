# 後續工作清單

此清單從目前 P2.0 狀態往可用系統推進，依優先順序排列。

## 目前狀態

- P1 系列已完成：全市場歷史事件、D1/D2 outcome labels、日線統計、保守日線回測、walk-forward、日線大盤 regime proxy、EPS/處置風險 prototype。
- P2.0 已完成：每日 brief prototype，可輸出 D0 候選、D1 觀察、D2+ 重返觀察與 Markdown/CSV。
- 目前已有一頁式 GitHub Pages playbook，並已加入靜態 Dashboard MVP，可查看每日候選股、風險標記與觀察狀態。

## P2.1 每日晚間資料更新 pipeline

目的：讓每日 brief 不只靠既有 processed data，而是能在盤後更新當天資料後自動產生。

狀態：已建立 `tw-market-data/scripts/run_p21_afterhours_pipeline.py`，並以 2026-07-07 完成
端到端驗證。詳見 [P2.1 每日盤後資料更新 pipeline](p21_afterhours_pipeline.md)。

待做：

- 將 `run_p21_afterhours_pipeline.py` 接上每日排程。
- 重新產出 D0 候選、D1 觀察、D2+ 觀察與 data health manifest。
- 處理部分市場資料缺漏、官方端點延遲、TWSE/TPEx 任一市場失敗時的健康狀態。
- 加入除權息/減資/分割等異常跳空檢查，避免 D1 gap 被誤判為交易訊號。
- 保持 `tw-market-data` 的資料 schema 可被後續股票專案重複使用。

輸出：

- `daily_brief_d0_candidates_<date>.csv`
- `daily_brief_d1_watch_<date>.csv`
- `daily_brief_d2_watch_<date>.csv`
- `daily_brief_<date>.md`
- `daily_brief_<date>_health.json`

## P2.2 Dashboard MVP

目的：把每日 brief 變成可以打開看的候選股介面，而不是只看 Markdown/CSV。

狀態：已完成 GitHub Pages 靜態 MVP，讀取 `data/daily/index.json` 與每日 JSON artifact；
P2.1 pipeline 已可用 `--dashboard-output-dir` 自動產生 dashboard JSON。
詳見 [P2.2 GitHub Pages Dashboard MVP](p22_dashboard_mvp.md)。

待做：

- 讀取最新一份 `daily_brief` JSON/CSV artifact，顯示：
  - D0 盤後候選股
  - D1 可觀察/不可追價/異常跳空檢查
  - D2+ 重返警示價觀察
  - 處置風險與 EPS 虧損標記
  - 警示價、停損價、失效價、下一步建議
- 加入資料健康狀態：資料日、缺漏市場、是否 trade-ready、是否含 current-only 風險快照。
- 支援日期切換，至少能查看最近 20 個交易日 brief。

MVP 原則：

- 先做靜態 dashboard，不做登入、不做下單、不做即時報價。
- 顯示「候選/觀察/失效」狀態，但不包裝成買賣保證。
- 每個欄位都能追溯到 pipeline 輸出的 CSV/manifest。

## P2.3 資料完整性修正

目的：修掉 Dashboard 因 TPEx partial market 與錯日期/空資料快取造成的不可用問題。

狀態：已完成。2026-07-07 current-year `partial_market_dates` 已由 `TPEx` 缺漏修正為空，
`download_complete=true`。詳見 [P2.3 資料完整性修正](p23_data_completeness.md)。

已完成：

- 新增 TWSE/TPEx payload 日期解析與驗證。
- 若 cache 日期不符 requested date，強制重抓。
- 若 cache 為空行情列，強制重抓一次。
- 2026-07-07 Dashboard 已重新產生，D0 候選 2 檔、D1 觀察 10 檔、D1 abnormal gap 0。

## P2.4 Corporate action feed

目的：接上除權息、減資、分割等資料源，避免 D1 gap / D2 reclaim 因價格基準改變而誤判。

狀態：已完成 V1 官方資料接線。資料來自 TWSE／TPEx 官方除權息、減資、分割／面額
變更端點；每日 pipeline 會建立 `corporate_actions_<date>.csv`。

已完成：

- D0 當日公司行動候選直接排除。
- D1 公司行動日停止一般 gap 判讀並顯示原因。
- D2 若 D1 價格基準改變則標示排除，不再使用原警示價。
- Dashboard 健康限制已移除 corporate-action 未接線警告。

後續研究版仍可加入調整後價格序列；交易版目前採排除法，較保守且不會誤用未調整價格。

## P2.5 A 型策略修正

> 2026-07-08 調整：原 P2.3 被前移處理資料可用性阻塞。A 型策略修正順延到資料完整性、
> corporate action 與風險 as-of 封存之後。

## P2.5a 每日 EPS／注意／處置封存

狀態：已完成 production V1。

- TWSE／TPEx 12 個官方綜合損益表端點合併為全市場累積 EPS 快照。
- 每日封存官方注意累計與處置名單。
- 僅允許資料日完全相同的快照套用候選，禁止用未來快照回填。
- 2026-07-09 首次封存涵蓋 1,969 檔 EPS、43 筆注意／處置資料。
- 歷史缺少的每日注意／處置快照維持缺值，不宣稱已回補。

目前問題：

- V1 selected 候選幾乎全是 B 型。
- A 型只有 23 筆，無法統計。

待做：

- 重新定義「盤整一週以上不帶量」。
- 檢查目前 A 型是否被 MACD、量能、突破條件排除太多。
- 設計 A 型專屬候選池，不要被 B 型規則吞掉。

## P2.6 分時資料與真實當沖回測

目的：解決日線無法知道觸價順序的問題。

狀態：09:15 大盤 regime production V1 已完成；個股分鐘線與真實成交順序回測仍待做。

已完成：

- 使用 TWSE MIS 官方當日分鐘指數與即時指數資料。
- 僅使用 09:01–09:15 資料，封存 `STRONG／NEUTRAL／WEAK`。
- Dashboard D1 顯示 09:15 regime 與相對昨收報酬。
- 2026-07-09 的 regime 正確套用於 7/8 D0、7/9 D1 觀察；7/9 D0 仍須等待
  下一交易日 09:15，不能提前標示可交易。

待做：

- 取得 1 分 K 或 5 分 K。
- 模擬 D1 開盤後進場、停損、留倉。
- 解決同日同時觸發進場價與停損價的排序問題。

2026-07-13 進度：已完成資料來源無關的分鐘 OHLC 回測契約與保守執行引擎：09:16 起
才允許進場、同分鐘進場/停損一律不交易、虧損但相對強勢只列留倉覆核。實測目前
FinMind 帳號未開放歷史 `TaiwanStockKBar`；取得授權分鐘資料後，補 coverage manifest
即可執行歷史回放，不能在資料缺口時宣稱真實回測完成。

2026-07-13 更新：已接上 Fugle 免費 API。盤後排程會為當日已完成 09:15 判斷的
`WATCH`／`PULLBACK_ONLY` 候選封存 1 分 K 與 coverage manifest；可從現在起累積
forward paper-trading 資料。富果分 K 只回傳近 30 日，仍不構成 2016 至今的歷史回測。

## P2.7 每日晚間候選股系統

目的：開始從研究變成可運作系統。

狀態：D0 盤後、D1 09:15、D2 觀察與 GitHub Pages 發布均已接線；工作日 15:30
盤後 LaunchAgent 已安裝。

已完成：

- D0 盤後產生候選股。
- 輸出每檔建議、警示價、停損價、處置/EPS 標記。
- 產生 D1 09:15 與盤後更新。
- 產生 D2 觀察清單。
- 有效資料日、partial-market 與 afterhours-ready 發布前驗證。
- 成功／失敗 macOS 通知與本機日誌。

### D1 09:15 自動更新

狀態：已完成並安裝 macOS LaunchAgent。工作日 09:16 自動把當日 09:15 資料套用到
前一交易日 D0 候選，更新 Dashboard 並推送 GitHub。

## P2.8 通知系統

目的：符合你一開始提出的「晚上知道候選股，D+1 再通知可考慮購入」。

狀態：本機 macOS 通知 V1 已完成，沿用既有工作日盤後與 D1 09:16 排程。

已完成：

- 盤後通知最多三檔 D0 候選，包含板塊與 EPS／處置風險。
- D1 09:15 通知只列 `WATCH`／`PULLBACK_ONLY`，包含停損價；無合格標的時明確通知不介入。
- 資料不完整、休市或發布失敗時不發交易摘要，既有失敗告警維持有效。

待做：

- 選擇跨裝置管道：Email、Telegram、Slack 或 GitHub issue。
- 取得該管道的憑證與收件目標後再啟用外送。

## P2.9 GitHub / 共用資料層整理

目的：讓後續股票專案都能共用資料層。

狀態：已完成。

- `tw-market-data` 已建立為私有 GitHub repo：[`bedstv/tw-market-data`](https://github.com/bedstv/tw-market-data)。
- 套件版本為 `0.2.0`，並新增資料契約、schema 相容規則與本機 cache 備份政策。
- raw、processed、manifest 與 report 資料都維持在本機，不會被推送；repo 只保存程式、設定與資料文件。

## P2.10 Dashboard production 化

目的：讓 dashboard 成為每日決策中心，而不只是報表瀏覽頁。

狀態：已完成。

- 既有盤後與 D1 排程發布每日 JSON 後，Dashboard 日期選擇器自動讀取新資料。
- 已提供個股 D0 → D1 → D2+ 狀態歷程。
- 已加入 A/B 型、主池/備選、風險、D1 狀態篩選與策略／量能／風險排序。
- 已加入目前篩選結果的 CSV 與 Markdown 匯出。
- 已加入每日 artifact 與資料邏輯 smoke test；前端資料載入錯誤會明確顯示，不會靜默空白。

## P2.11 Paper trading

目的：避免只依賴歷史回測。

待做：

- 固定一版規則，至少 forward test 20～60 個交易日。
- 不在測試期間調參。
- 每日記錄候選、觸發、停損、結果。
- 與回測預期比較。
