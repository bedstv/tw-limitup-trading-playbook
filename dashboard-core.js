export const text = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : String(value);

export const riskCount = (row) =>
  [
    row.eps_ytd_negative,
    row.currently_disposed_snapshot,
    row.possible_disposition_next_day,
  ].filter(Boolean).length;

export const decisionStatus = (row) => row.d1_decision_status || "PENDING";

export const paperProgress = (documents, minimumDays = 20) => {
  const summaries = documents.map((document) => document.paper_trading).filter(Boolean);
  const total = (field) => summaries.reduce((sum, row) => sum + Number(row[field] || 0), 0);
  return {
    decision_days: summaries.length,
    remaining_days: Math.max(0, minimumDays - summaries.length),
    candidate_count: total("candidate_count"),
    watch_count: total("watch_count"),
    executed_count: total("executed_count"),
    data_incomplete_count: total("data_incomplete_count"),
  };
};

export const rowsForExport = (data) => [
  ...(data.d0_candidates || []).map((row) => ({ ...row, stage: "D0" })),
  ...(data.d1_watch || []).map((row) => ({ ...row, stage: "D1" })),
  ...(data.d2_watch || []).map((row) => ({ ...row, stage: "D2+" })),
];

export const filterAndSortRows = (rows, filters) => {
  const filtered = rows.filter((row) => {
    if (filters.setup !== "all" && row.setup_type !== filters.setup) return false;
    if (filters.liquidity !== "all" && row.liquidity_bucket !== filters.liquidity) return false;
    if (filters.risk === "clear" && riskCount(row) > 0) return false;
    if (filters.risk === "flagged" && riskCount(row) === 0) return false;
    if (filters.decision !== "all" && decisionStatus(row) !== filters.decision) return false;
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (filters.sort === "volume") return Number(b.volume_lots || 0) - Number(a.volume_lots || 0);
    if (filters.sort === "risk") return riskCount(a) - riskCount(b);
    const priority = { WATCH: 0, PULLBACK_ONLY: 1, PENDING: 2, DOWNRANK: 3, REJECT: 4 };
    return (priority[decisionStatus(a)] ?? 5) - (priority[decisionStatus(b)] ?? 5)
      || Number(b.volume_lots || 0) - Number(a.volume_lots || 0);
  });
};

export const buildHistoryByStock = (documents) => {
  const histories = new Map();
  const add = (row, event) => {
    if (!row.stock_id) return;
    const current = histories.get(row.stock_id) || { stock_id: row.stock_id, name: row.name || "", events: [] };
    current.name ||= row.name || "";
    current.events.push(event);
    histories.set(row.stock_id, current);
  };
  documents.forEach((data) => {
    const date = data.as_of_date || data.effective_date || "";
    (data.d0_candidates || []).forEach((row) => add(row, {
      date,
      stage: "D0",
      status: decisionStatus(row),
      detail: row.d1_decision_reason || row.next_step || "盤後候選",
      price: row.close,
    }));
    (data.d1_watch || []).forEach((row) => add(row, {
      date: row.d1_date || date,
      stage: "D1",
      status: row.d1_blowoff_observation ? "BLOWOFF" : "WATCH",
      detail: row.next_step || "D1 觀察",
      price: row.alert_reclaim_price || row.stop_loss_price,
    }));
    (data.d2_watch || []).forEach((row) => add(row, {
      date: row.as_of_date || date,
      stage: "D2+",
      status: row.status || "WATCH",
      detail: row.next_step || "D2+ 觀察",
      price: row.alert_reclaim_price || row.invalidation_price,
    }));
  });
  histories.forEach((history) => history.events.sort((a, b) => `${a.date}-${a.stage}`.localeCompare(`${b.date}-${b.stage}`)));
  return histories;
};

const csvCell = (value) => `"${text(value, "").replaceAll('"', '""')}"`;

export const csvForRows = (rows) => {
  const headers = ["stage", "stock_id", "name", "industry", "setup_type", "close", "volume_lots", "d1_decision_status", "stop_loss_price", "next_step"];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
};

export const markdownForRows = (rows, date) => [
  `# 台股候選匯出｜${date}`,
  "",
  "| 階段 | 股票 | 型態 | 收盤 | 量 | D1 狀態 | 停損 | 下一步 |",
  "| --- | --- | --- | ---: | ---: | --- | ---: | --- |",
  ...rows.map((row) => `| ${text(row.stage)} | ${text(row.stock_id)} ${text(row.name, "")} | ${text(row.setup_type)} | ${text(row.close)} | ${text(row.volume_lots)} | ${decisionStatus(row)} | ${text(row.stop_loss_price)} | ${text(row.next_step)} |`),
].join("\n");
