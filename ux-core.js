import { decisionStatus, riskCount, text } from "./dashboard-core.js";

export const escapeHtml = (value) => text(value, "").replace(/[&<>\"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
})[char]);

export const fetchJson = async (path, { timeoutMs = 12000 } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`讀取 ${path} 時收到 ${response.status}`);
    return await response.json();
  } catch (error) {
    const reason = error.name === "AbortError" ? "讀取逾時" : error.message;
    throw new Error(`${path}：${reason}`);
  } finally {
    clearTimeout(timer);
  }
};

export const formatPrice = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return text(value);
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(number);
};

export const formatLots = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return text(value);
  return `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(number)} 張`;
};

export const formatPercent = (value, { alreadyPercent = false } = {}) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && value.trim().endsWith("%")) return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return text(value);
  return `${(number * (alreadyPercent ? 1 : 100)).toFixed(2)}%`;
};

export const setupLabel = (value) => ({
  A: "A 型｜盤整量縮漲停",
  B: "B 型｜突破前高、帶量漲停",
}[value] || "型態未分類");

export const regimeLabel = (value) => ({
  STRONG: "強勢盤",
  NEUTRAL: "中性盤",
  WEAK: "弱勢盤",
}[value] || "尚未取得大盤狀態");

export const decisionLabel = (value) => ({
  WATCH: "保留監看，尚未觸發",
  PULLBACK_ONLY: "等待拉回，不可追價",
  DOWNRANK: "次要觀察",
  REJECT: "不介入",
  DATA_INCOMPLETE: "資料不足，禁止判斷",
  PENDING: "尚未到判斷時間",
}[value] || "等待條件確認");

export const d2StatusLabel = (value) => ({
  reclaimed: "已重返，等待完整確認",
  watching: "持續等待重返",
  watch: "持續等待重返",
  invalidated: "已失效，停止觀察",
  expired: "已到期，停止觀察",
}[String(value || "").toLowerCase()] || "持續觀察");

const reasonCodeLabels = {
  NEUTRAL_CONFIRM: "大盤中性；仍須等待個股價格、VWAP 與量能同時確認。",
  GAP_OVER_5: "開盤跳空超過 5%，不可直接追價。",
  GAP_OVER_7: "開盤跳空超過 7%，不介入。",
  STRONG_B_DOWNRANK: "大盤強勢時，B 型突破股依固定規則降為次要觀察。",
  WEAK_B_PASSED: "弱勢盤中仍維持相對強勢，可保留監看，但尚未觸發進場。",
  WEAK_B_FAILED: "弱勢盤中的相對強度未通過，不介入。",
  CORPORATE_ACTION: "公司行動改變價格基準，不使用一般跳空或停損判斷。",
  DISPOSITION: "候選股已進入處置，不介入。",
  POSSIBLE_DISPOSITION: "候選股可能於下一交易日進入處置，不介入。",
  QUOTE_MISSING: "09:15 個股資料不足，禁止產生交易判斷。",
  STOP_NOT_BELOW_TRIGGER: "停損價未低於觸發價，風險條件無效，不介入。",
  RISK_OVER_5: "觸發價至停損價的風險超過 5%，不介入。",
};

export const reasonLabel = (row) => {
  const code = row?.d1_decision_reason_code || row?.message_code || "";
  if (reasonCodeLabels[code]) return reasonCodeLabels[code];
  const value = text(row?.d1_decision_reason || row?.next_step, "");
  const lower = value.toLowerCase();
  if (!value) return "等待系統提供下一步說明。";
  if (lower.includes("neutral market")) return reasonCodeLabels.NEUTRAL_CONFIRM;
  if (lower.includes("gap exceeded 7")) return reasonCodeLabels.GAP_OVER_7;
  if (lower.includes("gap exceeded 5")) return reasonCodeLabels.GAP_OVER_5;
  if (lower.includes("strong market") && lower.includes("downrank")) return reasonCodeLabels.STRONG_B_DOWNRANK;
  if (lower.includes("weak market") && lower.includes("passed")) return reasonCodeLabels.WEAK_B_PASSED;
  if (lower.includes("weak market") && lower.includes("failed")) return reasonCodeLabels.WEAK_B_FAILED;
  if (lower.includes("corporate action")) return reasonCodeLabels.CORPORATE_ACTION;
  if (lower.includes("possible") && lower.includes("disposition")) return reasonCodeLabels.POSSIBLE_DISPOSITION;
  if (lower.includes("under disposition")) return reasonCodeLabels.DISPOSITION;
  if (lower.includes("no d2 reclaim")) return "尚未形成 D2+ 重返條件；只保留相對強勢觀察。";
  if (lower.includes("add to d2 reclaim")) return "已進入 D2+ 重返觀察，必須等待價格與量能完成確認。";
  if (lower.includes("next trading day") || lower.includes("d1 open watch")) return "等待下一交易日 09:15 判斷；若開盤跳空超過 5%，不可直接追價。";
  if (/[a-z]{3}/i.test(value)) return "系統已保存判斷原因；中文說明尚待對應，不能據此進場。";
  return value;
};

const finite = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));

export const riskGeometry = (row) => {
  const trigger = row?.paper_entry_trigger_price;
  const stop = row?.stop_loss_price;
  if (!finite(trigger) || !finite(stop)) return { available: false, valid: true, distance: null, reasonCode: "" };
  const entry = Number(trigger);
  const stopPrice = Number(stop);
  if (stopPrice >= entry) return { available: true, valid: false, distance: null, reasonCode: "STOP_NOT_BELOW_TRIGGER" };
  const distance = (entry - stopPrice) / entry;
  if (distance > 0.05) return { available: true, valid: false, distance, reasonCode: "RISK_OVER_5" };
  return { available: true, valid: true, distance, reasonCode: "" };
};

export const safetyIssues = (row, stage) => {
  const issues = [];
  if (stage === "d1" && row?.d1_decision_ready === false) issues.push({ code: "QUOTE_MISSING", label: reasonCodeLabels.QUOTE_MISSING });
  if (row?.risk_data_status === "OFFICIAL_SOURCE_MISSING" || row?.risk_flags_trade_ready === false) issues.push({ code: "RISK_SOURCE_MISSING", label: "EPS／處置官方資料不完整，禁止判斷。" });
  if (row?.currently_disposed_snapshot) issues.push({ code: "DISPOSITION", label: reasonCodeLabels.DISPOSITION });
  if (row?.possible_disposition_next_day) issues.push({ code: "POSSIBLE_DISPOSITION", label: reasonCodeLabels.POSSIBLE_DISPOSITION });
  if (row?.corporate_action) issues.push({ code: "CORPORATE_ACTION", label: reasonCodeLabels.CORPORATE_ACTION });
  if (stage === "d1") {
    const geometry = riskGeometry(row);
    if (!geometry.valid) issues.push({ code: geometry.reasonCode, label: reasonCodeLabels[geometry.reasonCode] });
  }
  return issues;
};

export const riskStatusLabel = (row) => {
  if (row?.risk_status_label || row?.risk_data_status_label) return row.risk_status_label || row.risk_data_status_label;
  if (riskCount(row) > 0) return "有風險標記";
  return "風險資料尚未細分";
};

export const candidateView = (row, stage, context = {}) => {
  const issues = safetyIssues(row, stage);
  const rawDecision = decisionStatus(row);
  let state = "waiting";
  let action = stage === "d0" ? `等待 ${context.decisionDate || "下一交易日"} 09:15 判斷` : decisionLabel(rawDecision);
  if (stage === "d2") {
    action = d2StatusLabel(row?.status);
    state = ["invalidated", "expired"].includes(String(row?.status || "").toLowerCase()) ? "blocked" : "watching";
  } else if (issues.length) {
    action = "條件無效，不介入";
    state = "blocked";
  } else if (stage === "d1") {
    state = rawDecision === "REJECT" ? "blocked" : rawDecision === "WATCH" ? "watching" : rawDecision === "PULLBACK_ONLY" ? "caution" : "waiting";
  }
  const geometry = riskGeometry(row);
  return {
    ...row,
    stage,
    formationDate: context.formationDate || row?.date || row?.d0_date || "",
    decisionDate: context.decisionDate || row?.d1_trade_date || row?.d1_date || "",
    action,
    state,
    issues,
    reason: issues[0]?.label || reasonLabel(row),
    geometry,
  };
};

export const buildDecisionLanes = ({ selected, previous, selectedDate, nextTradingDate }) => {
  const previousMatches = previous?.d0_decision_date === selectedDate;
  const d1Rows = previousMatches ? (previous.d0_candidates || []) : [];
  return {
    d1: {
      id: "d1",
      title: "今天 09:15 判斷",
      subtitle: previousMatches ? `${previous.effective_date} 盤後候選 → ${selectedDate} 09:15 判斷` : `${selectedDate} 尚無可用的 09:15 判斷名單`,
      formationDate: previousMatches ? previous.effective_date : "",
      decisionDate: selectedDate,
      rows: d1Rows.map((row) => candidateView(row, "d1", { formationDate: previous.effective_date, decisionDate: selectedDate })),
    },
    d0: {
      id: "d0",
      title: "明日準備名單",
      subtitle: `${selectedDate} 盤後候選 → ${nextTradingDate || "下一交易日"} 09:15 判斷`,
      formationDate: selectedDate,
      decisionDate: nextTradingDate || "",
      rows: (selected?.d0_candidates || []).map((row) => candidateView(row, "d0", { formationDate: selectedDate, decisionDate: nextTradingDate })),
    },
    d2: {
      id: "d2",
      title: "D2+ 後續觀察",
      subtitle: "只保留仍有效的重返警示價觀察",
      formationDate: "",
      decisionDate: selectedDate,
      rows: (selected?.d2_watch || []).map((row) => candidateView(row, "d2", { decisionDate: selectedDate })),
    },
  };
};

export const isHistoricalMode = (selectedDate, latestDate) => Boolean(selectedDate && latestDate && selectedDate !== latestDate);

