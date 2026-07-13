# P2.10 Dashboard production 化

Dashboard 仍是靜態 GitHub Pages，但已由報表瀏覽升級為每日決策介面。

## 功能

- 讀取既有 `data/daily/index.json` 與各日 JSON；盤後與 D1 排程發布新檔後，日期選擇器會直接讀到。
- 依 A/B 型、主池／備選、風險標記、D1 狀態篩選，並可依策略優先、成交量或風險排序。
- 將目前篩選結果匯出為 CSV 或 Markdown；匯出內容包含階段、股票、型態、量、D1 狀態、停損與下一步。
- 匯集所有可用資料日，顯示個股 D0 → D1 → D2+ 的狀態歷程。
- `tests/dashboard_smoke.mjs` 驗證每日 artifact schema、預設篩選、狀態歷程與兩種匯出格式，避免 pipeline 欄位異動讓頁面靜默空白。

## 邊界

- 不接即時個股報價，也不自動下單。
- 狀態歷程僅顯示已發布的每日 artifact，缺少的交易日不會補造。
- 篩選與排序是研究／觀察輔助，不構成買賣保證。
