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
  A: "盤整後量縮漲停（A 型）",
  B: "突破前高、成交量放大（B 型）",
}[value] || "型態未分類");

export const regimeLabel = (value) => ({
  STRONG: "大盤偏強",
  NEUTRAL: "大盤漲跌不明顯",
  WEAK: "大盤偏弱",
}[value] || "大盤資料尚未取得");

export const decisionLabel = (value) => ({
  WATCH: "先不要買，等待價格確認",
  PULLBACK_ONLY: "開太高，不要追；等拉回",
  DOWNRANK: "優先度較低，今天先不考慮",
  REJECT: "今天不考慮",
  DATA_INCOMPLETE: "資料不完整，今天不考慮",
  PENDING: "還沒到判斷時間，先不要買",
}[value] || "條件還沒確認，先不要買");

export const d2StatusLabel = (value) => ({
  reclaimed: "價格已反彈，仍要等量價確認",
  watching: "還沒反彈到目標價，繼續等",
  watch: "還沒反彈到目標價，繼續等",
  invalidated: "已跌破放棄價，停止觀察",
  expired: "觀察期限已到，停止觀察",
}[String(value || "").toLowerCase()] || "條件還沒完成，繼續等");

const reasonCodeLabels = {
  NEUTRAL_CONFIRM: "大盤漲跌不明顯；個股還要同時符合股價站穩與成交量放大，才繼續考慮。",
  GAP_OVER_5: "開盤比前一日收盤高超過 5%，現在追價風險太高。",
  GAP_OVER_7: "開盤比前一日收盤高超過 7%，今天不考慮。",
  STRONG_B_DOWNRANK: "大盤偏強時容易有人追漲；這種放量突破股先降低優先度。",
  WEAK_B_PASSED: "大盤偏弱，但這檔股票相對較強；仍要等價格與成交量確認，現在先不要買。",
  WEAK_B_FAILED: "大盤偏弱，而且這檔股票不夠強，今天不考慮。",
  CORPORATE_ACTION: "除權息等公司行動改變了價格基準，今天不使用一般買進與停損判斷。",
  DISPOSITION: "這檔股票目前為處置股，今天不考慮。",
  POSSIBLE_DISPOSITION: "這檔股票下一交易日可能遭處置，今天不考慮。",
  QUOTE_MISSING: "09:15 個股報價不完整，今天無法安全判斷。",
  STOP_NOT_BELOW_TRIGGER: "停損價沒有低於等待確認的價格，風險設定不合理，今天不考慮。",
  RISK_OVER_5: "等待確認的價格到停損價相差超過 5%，可能損失過大，今天不考慮。",
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
  if (lower.includes("no d2 reclaim")) return "價格尚未反彈回關鍵價位，目前只能繼續等待。";
  if (lower.includes("add to d2 reclaim")) return "價格可能正在反彈，但必須等站穩且成交量放大後才重新考慮。";
  if (lower.includes("next trading day") || lower.includes("d1 open watch")) return "現在先不要買；等下一交易日 09:15 看完大盤與個股表現再判斷。";
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
  const ruleVersion = text(row?.strategy_version || row?.rule_version || row?.paper_trade_rule_version, "");
  const enforceFivePercent = row?.enforce_max_risk_pct === true || ruleVersion.startsWith("p2.30_");
  if (enforceFivePercent && distance > 0.05) return { available: true, valid: false, distance, reasonCode: "RISK_OVER_5" };
  return { available: true, valid: true, distance, reasonCode: "" };
};

export const safetyIssues = (row, stage) => {
  const issues = [];
  if (stage === "d1" && row?.d1_decision_ready === false) issues.push({ code: "QUOTE_MISSING", label: reasonCodeLabels.QUOTE_MISSING });
  if (row?.risk_data_status === "OFFICIAL_SOURCE_MISSING" || row?.risk_flags_trade_ready === false) issues.push({ code: "RISK_SOURCE_MISSING", label: "EPS 或處置資料不完整，今天無法安全判斷。" });
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
  let action = stage === "d0" ? "明天 09:15 前先不要買" : decisionLabel(rawDecision);
  if (stage === "d2") {
    action = d2StatusLabel(row?.status);
    state = ["invalidated", "expired"].includes(String(row?.status || "").toLowerCase()) ? "blocked" : "watching";
  } else if (issues.length) {
    const primaryCode = issues[0].code;
    action = primaryCode === "STOP_NOT_BELOW_TRIGGER" ? "停損價不合理，今天不考慮"
      : primaryCode === "QUOTE_MISSING" || primaryCode === "RISK_SOURCE_MISSING" ? "資料不完整，今天不考慮"
        : primaryCode === "DISPOSITION" || primaryCode === "POSSIBLE_DISPOSITION" ? "有處置風險，今天不考慮"
          : primaryCode === "CORPORATE_ACTION" ? "價格基準改變，今天不考慮"
            : "風險太高，今天不考慮";
    state = "blocked";
  } else if (stage === "d1" && context.decisionReady === false) {
    action = "還沒到 09:15，先不要買";
    state = "waiting";
  } else if (stage === "d1") {
    state = rawDecision === "REJECT" ? "blocked" : rawDecision === "WATCH" ? "watching" : rawDecision === "PULLBACK_ONLY" ? "caution" : "waiting";
  }
  const geometry = riskGeometry(row);
  const trigger = formatPrice(row?.paper_entry_trigger_price);
  const stop = formatPrice(row?.stop_loss_price);
  const decisionDate = context.decisionDate || row?.d1_trade_date || row?.d1_date || "下一交易日";
  let instruction = "現在先不要買，等待系統把條件說明完整。";
  if (issues.length) instruction = `今天不要考慮這檔。原因：${issues[0].label}`;
  else if (stage === "d0" || (stage === "d1" && context.decisionReady === false)) instruction = `現在不要買。等到 ${decisionDate} 09:15 取得大盤與個股資料後，系統才會告訴你是否繼續觀察。`;
  else if (stage === "d1" && rawDecision === "WATCH") {
    const triggerStep = trigger === "—" ? "先等價格與成交量完成確認" : `先等股價到 ${trigger} 元，再確認成交量與走勢`;
    const stopStep = stop === "—" ? "停損價尚未取得前，不要進入下一步" : `若之後買進，跌破 ${stop} 元就停損`;
    instruction = `現在不要買。${triggerStep}；兩者都符合才考慮下一步。${stopStep}。`;
  }
  else if (stage === "d1" && rawDecision === "PULLBACK_ONLY") instruction = `開盤漲太多，現在不要追。等股價拉回後重新確認成交量與走勢；沒有重新轉強就不交易。`;
  else if (stage === "d1" && rawDecision === "DOWNRANK") instruction = "今天優先度較低，先看其他候選；沒有額外轉強證據就不交易。";
  else if (stage === "d1" && ["REJECT", "DATA_INCOMPLETE"].includes(rawDecision)) instruction = `今天不要考慮這檔。原因：${reasonLabel(row)}`;
  else if (stage === "d2") {
    const status = String(row?.status || "").toLowerCase();
    const reclaim = formatPrice(row?.alert_reclaim_price);
    const invalidation = formatPrice(row?.invalidation_price ?? row?.stop_loss_price);
    instruction = ["invalidated", "expired"].includes(status)
      ? "停止觀察這檔，不要再等待買進條件。"
      : `現在不要買。等股價由下往上回到 ${reclaim} 元並連續站穩，成交量也放大後才重新考慮；跌破 ${invalidation} 元就放棄。`;
  }
  return {
    ...row,
    stage,
    formationDate: context.formationDate || row?.date || row?.d0_date || "",
    decisionDate: context.decisionDate || row?.d1_trade_date || row?.d1_date || "",
    action,
    state,
    issues,
    reason: issues[0]?.label || reasonLabel(row),
    instruction,
    geometry,
    decisionPending: stage === "d1" && context.decisionReady === false,
  };
};

export const buildDecisionLanes = ({ selected, previous, selectedDate, nextTradingDate }) => {
  const formationDate = selected?.effective_date || selectedDate;
  const decisionDate = selected?.d0_decision_date || nextTradingDate || "";
  const decisionReady = Boolean(selected?.d0_decision_ready && selected?.d0_decision_date);
  const d1Rows = selected?.d0_candidates || [];
  return {
    d1: {
      id: "d1",
      tabLabel: decisionReady ? "今天開盤後怎麼做" : "等待 09:15 判斷",
      title: decisionReady ? "今天開盤後怎麼做" : `${decisionDate || "下一交易日"} 09:15 才能判斷`,
      subtitle: `${formationDate} 盤後選出 → ${decisionDate || "下一交易日"} 09:15 ${decisionReady ? "已完成判斷" : "再看大盤與個股表現"}`,
      formationDate,
      decisionDate,
      decisionReady,
      rows: d1Rows.map((row) => candidateView(row, "d1", { formationDate, decisionDate, decisionReady })),
    },
    d0: {
      id: "d0",
      tabLabel: "下一交易日先看這些",
      title: "下一交易日先看這些",
      subtitle: `${formationDate} 盤後選出 → ${decisionDate || "下一交易日"} 09:15 再判斷，現在不要買`,
      formationDate,
      decisionDate,
      rows: (selected?.d0_candidates || []).map((row) => candidateView(row, "d0", { formationDate, decisionDate })),
    },
    d2: {
      id: "d2",
      tabLabel: "之後幾天等反彈",
      title: "之後幾天等反彈",
      subtitle: "只有價格反彈到目標、站穩且成交量放大，才重新考慮",
      formationDate: "",
      decisionDate: formationDate,
      rows: (selected?.d2_watch || []).map((row) => candidateView(row, "d2", { decisionDate: formationDate })),
    },
  };
};

export const isHistoricalMode = (selectedDate, latestDate) => Boolean(selectedDate && latestDate && selectedDate !== latestDate);
