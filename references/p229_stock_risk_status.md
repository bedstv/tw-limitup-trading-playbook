# P2.29 個股風險資料狀態

系統不再把「當期 EPS 尚未公告」與「官方來源抓取失敗」混為同一個
「風險資料未完整」。每檔候選會保留以下狀態：

- `VERIFIED_CLEAR`：官方 EPS 與處置快照已驗證，未發現 EPS 虗損或處置標記。
- `EPS_NOT_ANNOUNCED`：官方來源取得成功，但該公司當期 EPS 尚未公告；不得當作已確認非虗損。
- `OFFICIAL_SOURCE_MISSING`：官方來源未通過當日驗證，不產生「無風險」結論。
- `NEAR_DISPOSITION`：官方警示顯示 1 日內可能進入處置。
- `CURRENTLY_DISPOSED`：快照日當下已在處置期間。

EPS 虗損另以 `eps_status=ACCUMULATED_LOSS` 保留，因此即使同時有處置警示，
也不會丟失 EPS 風險。Dashboard 與 Telegram 顯示中文狀態與官方資料日；
`eps_snapshot_date`、`eps_source`、`disposition_snapshot_date` 供稽核使用。

2026-08-10 實際資料驗證：3022、9934、2465 的第二季 EPS 當日尚未公告，
因此標示「EPS 尚未公告」；6206 已有官方 EPS 且無處置標記，顯示
「已驗證無 EPS／處置風險」。四檔均顯示官方資料日 2026-08-10。
