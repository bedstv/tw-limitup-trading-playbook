import {
  buildHistoryByStock,
  csvForRows,
  decisionStatus,
  filterAndSortRows,
  industrySummary,
  markdownForRows,
  paperRecords,
  paperProgress,
  text,
} from "./dashboard-core.js";

const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll("nav a")];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navLinks.forEach((link) => link.toggleAttribute("aria-current", link.getAttribute("href") === `#${visible.target.id}`));
}, { rootMargin: "-25% 0px -60% 0px", threshold: [0.05, 0.2, 0.5] });
sections.forEach((section) => observer.observe(section));

const dashboard = {
  dateSelect: document.querySelector("#dashboard-date"), source: document.querySelector("#dashboard-source"),
  tradeReady: document.querySelector("#trade-ready"), d0Count: document.querySelector("#d0-count"),
  d1Count: document.querySelector("#d1-count"), d2Count: document.querySelector("#d2-count"),
  warning: document.querySelector("#dashboard-warning"), systemHealth: document.querySelector("#dashboard-system-health"), freshness: document.querySelector("#dashboard-freshness"), d0Table: document.querySelector("#d0-table"),
  updateLedger: document.querySelector("#update-ledger"), updateLedgerItems: document.querySelector("#update-ledger-items"),
  industryConsensusSummary: document.querySelector("#industry-consensus-summary"), industryConsensusItems: document.querySelector("#industry-consensus-items"),
  provenance: document.querySelector("#dashboard-provenance"),
  d1Table: document.querySelector("#d1-table"), d2Table: document.querySelector("#d2-table"),
  setup: document.querySelector("#filter-setup"), liquidity: document.querySelector("#filter-liquidity"),
  risk: document.querySelector("#filter-risk"), decision: document.querySelector("#filter-decision"),
  sort: document.querySelector("#sort-by"), exportCsv: document.querySelector("#export-csv"),
  exportMarkdown: document.querySelector("#export-markdown"), copyViewLink: document.querySelector("#copy-view-link"), historyStock: document.querySelector("#history-stock"),
  historyTimeline: document.querySelector("#history-timeline"),
  paperProgress: document.querySelector("#paper-progress"),
  strategyEvaluationSummary: document.querySelector("#strategy-evaluation-summary"), strategyEvaluationSplits: document.querySelector("#strategy-evaluation-splits"),
  intradayCoverageSummary: document.querySelector("#intraday-coverage-summary"),
  setupAResearchSummary: document.querySelector("#setup-a-research-summary"), setupAResearchDetails: document.querySelector("#setup-a-research-details"),
  paperEvidenceSummary: document.querySelector("#paper-evidence-summary"), paperEvidenceTable: document.querySelector("#paper-evidence-table"),
  backtestPeriod: document.querySelector("#backtest-period"), backtestConclusion: document.querySelector("#backtest-conclusion"),
  backtestMethod: document.querySelector("#backtest-method"), backtestSignals: document.querySelector("#backtest-signals"),
  backtestAverage: document.querySelector("#backtest-average"), backtestMedian: document.querySelector("#backtest-median"),
  backtestOosMedian: document.querySelector("#backtest-oos-median"), backtestNote: document.querySelector("#backtest-note"),
  tabs: [...document.querySelectorAll("[data-dashboard-tab]")],
  tabPanels: [...document.querySelectorAll(".dashboard-tab-panel")],
};
const state = { current: null, histories: new Map() };
const fetchJson = async (path, fallback) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`讀取 ${path} 時收到 ${response.status}`);
    return await response.json();
  } catch (error) {
    if (fallback !== undefined) return fallback;
    const reason = error.name === "AbortError" ? "讀取逾時" : error.message;
    throw new Error(`${path}：${reason}`);
  } finally {
    clearTimeout(timer);
  }
};
const escapeHtml = (value) => text(value, "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const badge = (label, type = "") => `<span class="badge ${type ? `badge-${type}` : ""}">${escapeHtml(label)}</span>`;
const stockLabel = (row) => `${escapeHtml(text(row.stock_id))} ${escapeHtml(text(row.name, ""))}`.trim();
const setupLabel = (value) => ({ A: "A 型：盤整量縮漲停", B: "B 型：突破前高、帶量漲停" }[value] || text(value));
const decisionLabel = (value) => ({ WATCH: "可觀察（WATCH）", PULLBACK_ONLY: "等拉回（PULLBACK_ONLY）", DOWNRANK: "降權觀察（DOWNRANK）", REJECT: "不介入（REJECT）", PENDING: "等待 D1 判定" }[value] || value);
const nextStepChinese = (value) => {
  if (text(value, "").startsWith("09:15 個股報價不足")) return "09:15 個股報價資料不足，已排除此檔；不以缺失資料產生交易判斷。";
  return ({
  "Wait for next trading day 09:15 market regime; D1 open watch; avoid direct chase if D1 open gap >5%": "等待下一交易日 09:15 的大盤強弱判斷；開盤後再觀察。若跳空開高超過 5%，不可直接追價。",
  "D1 open watch; avoid direct chase if D1 open gap >5%": "D1 開盤後觀察；若開盤跳空超過 5%，不可直接追價。",
  "Consider only after intraday confirmation; daily sequence still ambiguous": "待盤中條件確認後才考慮；日線無法判定先進場或先停損。",
  "Neutral market allows A/B setup; await actual entry trigger.": "09:15 大盤為中性；可保留 A／B 型，但須等待實際進場觸發。",
  "D1 opening gap exceeded 5%; direct chase prohibited.": "D1 開盤跳空超過 5%，不可直接追價；等待拉回後再確認。",
  "D1 opening gap exceeded 7%.": "D1 開盤跳空超過 7%，不介入。",
  "Stock was under disposition on D1.": "D1 已列處置股，不介入。",
  "No D2 reclaim setup; monitor only if relative strength confirmed": "尚未形成 D2 重返警示價條件；僅在相對強勢確認後持續追蹤。",
  "Add to D2 reclaim watch": "納入 D2+ 重返警示價觀察。",
  "Weak market B setup failed a required strength check.": "弱勢大盤下，B 型未通過強勢條件，不介入。",
  "Strong market downranks volume-breakout B setups in V1.": "強勢大盤下，B 型帶量突破容易出現追價風險；依固定 V1 規則降權觀察，不主動追價。",
  }[text(value, "")] || text(value));
};
const regimeLabel = (row) => {
  const regime = text(row.market_regime_0915);
  const returnText = text(row.taiex_return_0915, "");
  const name = ({ STRONG: "強勢盤", NEUTRAL: "中性盤", WEAK: "弱勢盤" }[regime] || regime);
  return `${name}${returnText ? ` ${returnText}` : ""}`;
};
const industryBadges = (row) => [badge(text(row.industry, "未分類"), "industry"), row.industry_consensus ? badge(`板塊共識 ×${row.industry_candidate_count}`, "consensus") : ""].join("");
const riskBadges = (row) => {
  const labels = [];
  if (row.eps_ytd_negative) labels.push(badge("EPS虧損", "risk"));
  if (row.currently_disposed_snapshot) labels.push(badge("處置中", "risk"));
  if (row.possible_disposition_next_day) labels.push(badge("可能處置", "risk"));
  return labels.length ? labels.join("") : badge("未標示", "ok");
};
const decisionBadge = (row) => row.d1_decision_ready ? `<br>${badge(decisionLabel(decisionStatus(row)), decisionStatus(row) === "WATCH" ? "ok" : decisionStatus(row) === "PULLBACK_ONLY" ? "warn" : "risk")}` : "";
const emptyRow = (columns, message) => `<tr><td class="dashboard-empty" colspan="${columns}">${message}</td></tr>`;
const renderRows = (target, rows, columns, renderer, emptyMessage) => { target.innerHTML = rows.length ? rows.map(renderer).join("") : emptyRow(columns, emptyMessage); };
const cell = (label, content) => `<td data-label="${escapeHtml(label)}">${content}</td>`;
const filters = () => ({ setup: dashboard.setup.value, liquidity: dashboard.liquidity.value, risk: dashboard.risk.value, decision: dashboard.decision.value, sort: dashboard.sort.value });
const rows = (source) => filterAndSortRows(source || [], filters());
const restoreMarketView = (dates) => {
  const params = new URLSearchParams(window.location.search);
  const requestedDate = params.get("date");
  dashboard.dateSelect.value = dates.includes(requestedDate) ? requestedDate : (dates.at(-1) || "");
  [[dashboard.setup, "setup"], [dashboard.liquidity, "liquidity"], [dashboard.risk, "risk"], [dashboard.decision, "decision"], [dashboard.sort, "sort"]].forEach(([control, key]) => {
    const requested = params.get(key);
    if ([...control.options].some((option) => option.value === requested)) control.value = requested;
  });
};
const saveMarketView = () => {
  if (document.body.dataset.page !== "market") return;
  const params = new URLSearchParams(window.location.search);
  params.set("date", dashboard.dateSelect.value);
  Object.entries(filters()).forEach(([key, value]) => params.set(key, value));
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
};
const bindDashboardTabs = () => {
  dashboard.tabs.forEach((tab) => tab.addEventListener("click", () => {
    const active = tab.dataset.dashboardTab;
    dashboard.tabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    dashboard.tabPanels.forEach((panel) => { panel.hidden = panel.id !== `dashboard-${active}`; });
  }));
};
const unique = (items) => [...new Set(items.filter(Boolean))];
const percent = (value) => value === null || value === undefined || value === "" ? "—" : `${Number(value * 100).toFixed(2)}%`;
const paperDecisionLabel = (value) => ({ WATCH: "可觀察", PULLBACK_ONLY: "等拉回", REJECT: "不介入", DOWNRANK: "降權觀察" }[value] || text(value));
const paperOutcomeLabel = (value) => ({
  executed: "已完成當日模擬", hold_overnight_review: "留倉覆核", no_entry_after_0915: "未觸發進場",
  invalidated_before_entry: "進場前失效", ambiguous_entry_and_stop_same_minute: "同分鐘順序不明，保守不交易",
  data_incomplete: "分鐘資料不足", not_traded: "條件不符合，未模擬",
}[value] || text(value));
const paperSourceLabel = (value) => ({ "Fugle:historical/candles:1m": "Fugle 1 分鐘線", not_captured: "尚未封存" }[value] || text(value));
const paperPrice = (value) => value === null || value === undefined || value === "" ? "—" : Number(value).toFixed(2);
const renderPaperEvidence = () => {
  if (!dashboard.paperEvidenceSummary || !dashboard.paperEvidenceTable) return;
  const records = paperRecords([...state.documents.values()]);
  const progress = paperProgress([...state.documents.values()]);
  dashboard.paperEvidenceSummary.textContent = progress.recorded_count
    ? `固定規則 ${progress.rule_version}：已封存 ${progress.recorded_count} 筆紀錄；以下顯示最近 20 筆。這是模擬驗證，並非真實下單紀錄。`
    : `固定規則 ${progress.rule_version} 正在收集樣本。目前尚無可顯示的個股模擬紀錄；D1 09:15 判斷後會自動加入。`;
  renderRows(dashboard.paperEvidenceTable, records.slice(0, 20), 7, (row) => `<tr><td>${escapeHtml(text(row.decision_date))}</td><td>${escapeHtml(text(row.stock_id))} ${escapeHtml(text(row.name, ""))}</td><td>${escapeHtml(paperDecisionLabel(row.d1_decision_status))}</td><td>${escapeHtml(paperOutcomeLabel(row.status))}</td><td>進場 ${paperPrice(row.entry_price)}<br>停損 ${paperPrice(row.stop_loss_price)}</td><td>${escapeHtml(paperSourceLabel(row.minute_bar_source))}</td><td>${percent(row.net_return)}</td></tr>`, "目前尚無固定規則 V2 的紙上交易紀錄。");
};
const renderStrategyEvaluation = () => {
  if (!dashboard.strategyEvaluationSummary || !dashboard.strategyEvaluationSplits) return;
  const evaluation = state.strategyEvaluation;
  if (!evaluation) { dashboard.strategyEvaluationSummary.textContent = "目前尚未載入固定規則評估。"; return; }
  const overall = evaluation.overall || {};
  const collecting = evaluation.status !== "ready_for_review";
  dashboard.strategyEvaluationSummary.textContent = collecting
    ? `樣本收集中：${evaluation.decision_day_count}/${evaluation.minimum_decision_days} 個 D1 判斷日；已結算 ${overall.settled_count || 0} 筆，待補證據／留倉覆核 ${evaluation.unsettled_count || 0} 筆。尚不可判定策略成效。${evaluation.p1_daily_backtest_reference?.note ? ` ${evaluation.p1_daily_backtest_reference.note}` : ""}`
    : `樣本已達門檻：平均淨報酬 ${percent(overall.avg_net_return)}、中位數 ${percent(overall.median_net_return)}、勝率 ${percent(overall.win_rate)}。`;
  const labels = { setup_type: "A／B 型", market_regime_0915: "09:15 大盤", liquidity_tier: "流動性", industry_consensus: "板塊共識", d1_decision_status: "D1 決策" };
  dashboard.strategyEvaluationSplits.innerHTML = Object.entries(evaluation.splits || {}).map(([key, groups]) => {
    const textGroups = Object.entries(groups).map(([name, value]) => `${name}：${value.candidate_count} 筆／已結算 ${value.settled_count} 筆`).join("；");
    return `<p><strong>${escapeHtml(labels[key] || key)}</strong>：${escapeHtml(textGroups || "尚無資料")}</p>`;
  }).join("");
};
const renderIntradayCoverage = () => {
  if (!dashboard.intradayCoverageSummary) return;
  const coverage = state.intradayCoverage;
  if (!coverage) { dashboard.intradayCoverageSummary.textContent = "目前尚無分鐘線覆蓋檢查。"; return; }
  dashboard.intradayCoverageSummary.textContent = coverage.historical_backtest_allowed
    ? `分鐘線覆蓋已達 ${coverage.available_decision_days} 個判斷日，可進行保守歷史回放。`
    : `尚不可進行歷史分鐘線回測：已完整封存 ${coverage.available_decision_days}/${coverage.minimum_decision_days} 個 D1 判斷日，資料不足 ${coverage.data_incomplete_count} 筆。${coverage.reason}`;
};
const renderSetupAResearch = () => {
  if (!dashboard.setupAResearchSummary || !dashboard.setupAResearchDetails) return;
  const research = state.setupAResearch;
  if (!research) {
    dashboard.setupAResearchSummary.textContent = "目前尚未載入 A 型研究結果。";
    dashboard.setupAResearchDetails.innerHTML = "";
    return;
  }
  const validation = research.walk_forward || {};
  const pool = research.historical_pool || {};
  const collecting = research.status === "research_only_insufficient_validation_trades";
  dashboard.setupAResearchSummary.textContent = collecting
    ? `研究中，尚未上線：驗證期僅 ${validation.validation_trade_count || 0}/${validation.minimum_validation_trades || "—"} 筆實際成交，未達門檻。本研究不會影響每日候選、09:15 判斷或 Telegram 通知。`
    : "驗證樣本已達研究審查門檻，但仍須獨立核准後才可能調整正式規則。";
  dashboard.setupAResearchDetails.innerHTML = [
    `<p><strong>候選樣本</strong>：嚴格定義 ${pool.strict_candidate_count || 0} 筆；放寬研究池 ${pool.relaxed_candidate_count || 0} 筆（新增 ${pool.relaxed_incremental_count || 0} 筆）。</p>`,
    `<p><strong>保守日線模擬</strong>：${research.conservative_daily_study?.signal_count || 0} 個訊號，${research.conservative_daily_study?.executed_count || 0} 筆可成交，${research.conservative_daily_study?.invalidated_before_entry_count || 0} 筆進場前失效。</p>`,
    `<p><strong>研究定義</strong>：${escapeHtml(research.definition?.relaxed || "—")}</p>`,
  ].join("");
};
const renderBacktestSummary = (summary) => {
  if (!dashboard.backtestConclusion) return;
  if (!summary) {
    dashboard.backtestConclusion.textContent = "目前尚未載入回測摘要";
    return;
  }
  const baseline = summary.baseline || {};
  const validation = summary.walk_forward?.baseline || {};
  const primary = summary.walk_forward?.primary_liquidity || {};
  dashboard.backtestPeriod.textContent = `2016–2026 · 保守日線回測（資料截止 ${summary.data_through}）`;
  dashboard.backtestConclusion.textContent = "目前結論：平均為正，但尚未證實穩定優勢";
  dashboard.backtestMethod.textContent = `模擬 ${summary.methodology?.signal || "策略訊號"}；等待 ${summary.methodology?.watch_days ?? "—"} 日、最多持有 ${summary.methodology?.hold_days ?? "—"} 日，單邊成本 ${summary.methodology?.cost_bps_one_way ?? "—"} bps。`;
  dashboard.backtestSignals.textContent = `${baseline.signal_count ?? "—"}／${baseline.executed_count ?? "—"}`;
  dashboard.backtestAverage.textContent = percent(baseline.avg_net_return);
  dashboard.backtestMedian.textContent = percent(baseline.median_net_return);
  dashboard.backtestOosMedian.textContent = percent(validation.median_net_return);
  dashboard.backtestNote.textContent = `5,000 張以上在樣本外平均為 ${percent(primary.validate_avg)}，但中位數仍為 ${percent(primary.validate_median)}；目前只作優先觀察，不升級為正式交易規則。完整當沖績效仍須靠 09:15 後的分鐘線紙上交易驗證。`;
};
const sourceName = (source) => ({
  "Fugle 1m completed 09:15 bar": "Fugle 1 分鐘線（已完成 09:15 K）",
  "TWSE MIS live quote": "TWSE 即時行情（09:15）",
  "Fugle:historical/candles:1m": "Fugle 1 分鐘線",
}[source] || source);
const timestampLabel = (value) => {
  if (!value) return "尚無紀錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
};
const updateStatusLabel = (status) => ({ ok: "已確認", skipped: "依休市／條件跳過", failed: "更新異常" }[status] || "尚無紀錄");
const renderUpdateLedger = (data) => {
  if (!dashboard.updateLedger || !dashboard.updateLedgerItems) return;
  const checks = state.systemHealth?.checks || {};
  const rows = [
    ["09:15 開盤判斷", checks.d1],
    ["盤後候選與通知", checks.afterhours],
  ];
  dashboard.updateLedgerItems.innerHTML = rows.map(([label, check]) => {
    const status = check?.status || "unknown";
    const reason = check?.reasons?.length ? `：${check.reasons.join("、")}` : "";
    return `<article class="update-ledger-item"><span>${escapeHtml(label)}</span><strong class="update-${escapeHtml(status)}">${escapeHtml(updateStatusLabel(status))}</strong><small>${escapeHtml(check ? `${check.date || "日期未知"} · ${timestampLabel(check.checked_at)}${reason}` : "尚未取得健康檢查紀錄")}</small></article>`;
  }).join("");
  const d0State = data.trade_ready ? "已完成下一交易日 09:15 判定" : "尚待下一交易日 09:15 判定";
  dashboard.updateLedger.querySelector("p:not(.panel-kicker)").textContent = `最新資料日為 ${data.effective_date}；${d0State}。休市或開盤前未更新不代表系統故障，請以上方兩項健康檢查為準。`;
};
const renderIndustryConsensus = (data) => {
  if (!dashboard.industryConsensusSummary || !dashboard.industryConsensusItems) return;
  const groups = industrySummary(rows(data.d0_candidates));
  const consensusCount = groups.filter((group) => group.count >= 2).length;
  dashboard.industryConsensusSummary.textContent = groups.length
    ? `目前篩選結果有 ${groups.length} 個板塊，其中 ${consensusCount} 個板塊同時出現兩檔以上候選。板塊群聚只代表市場關注較集中，不會取代個股的風險與進場條件。`
    : "目前篩選結果沒有候選股，因此無板塊共識可判讀。";
  dashboard.industryConsensusItems.innerHTML = groups.length
    ? groups.map((group) => `<article class="industry-consensus-item ${group.count >= 2 ? "has-consensus" : ""}"><strong>${escapeHtml(group.industry)}</strong><span>${group.count >= 2 ? `板塊共識 ×${group.count}` : "單一候選"}</span><small>${group.rows.map((row) => `${escapeHtml(text(row.stock_id))} ${escapeHtml(text(row.name, ""))}`).join("、")}</small></article>`).join("")
    : "<p class=\"industry-consensus-empty\">沒有符合目前篩選條件的板塊資料。</p>";
};
const renderProvenance = (data) => {
  const d1Sources = unique((data.d0_candidates || []).filter((row) => row.d1_decision_ready).map((row) => row.d1_quote_source));
  const minuteSources = unique((data.paper_trading_records || []).map((row) => row.minute_bar_source));
  const afterhours = data.afterhours_ready ? "可用" : "候選可顯示，但風險快照或公司行動資料尚未完整";
  const d1 = d1Sources.length ? `可用：${d1Sources.map(sourceName).join("、")}` : "尚未取得；不可據此做 D1 進場判斷";
  const paper = minuteSources.length ? `已封存：${minuteSources.map(sourceName).join("、")}` : "尚無已封存的分鐘線紙上交易紀錄";
  const coverage = data.d1_quote_coverage || data.health?.d1_quote_coverage;
  const coverageText = coverage ? `09:15 個股覆蓋 ${coverage.covered_count}/${coverage.candidate_count}（${coverage.coverage_pct}%）；缺資料 ${coverage.missing_stock_ids?.length || 0} 檔。` : "09:15 個股覆蓋尚待下一次 D1 更新。";
  dashboard.provenance.innerHTML = `<strong>資料來源與可用性：</strong><span>盤後候選：TWSE／TPEx 官方日行情（${escapeHtml(afterhours)}）。09:15 判斷：${escapeHtml(d1)}。${escapeHtml(coverageText)} 紙上交易分鐘線：${escapeHtml(paper)}。</span>`;
};

const renderHistory = () => {
  const history = state.histories.get(dashboard.historyStock.value);
  if (!history) { dashboard.historyTimeline.innerHTML = "<p>目前篩選資料沒有可追蹤的個股。</p>"; return; }
  dashboard.historyTimeline.innerHTML = history.events.map((event) => `<article class="history-event"><span>${escapeHtml(event.date)}</span><strong>${escapeHtml(event.stage)} · ${escapeHtml(event.status)}</strong><b>${escapeHtml(text(event.price))}</b><p>${escapeHtml(event.detail)}</p></article>`).join("");
};

const renderDashboard = (data) => {
  state.current = data;
  dashboard.source.textContent = `資料流程 P2.1 · 有效資料日 ${data.effective_date}`;
  dashboard.tradeReady.textContent = data.trade_ready ? "YES" : "NO";
  dashboard.d0Count.textContent = data.health?.d0_candidate_count ?? data.d0_candidates.length;
  dashboard.d1Count.textContent = data.health?.d1_watch_count ?? data.d1_watch.length;
  dashboard.d2Count.textContent = data.health?.d2_watch_count ?? data.d2_watch.length;
  const progress = paperProgress([...state.documents.values()]);
  const measured = progress.recorded_count ? ` 已封存 ${progress.recorded_count} 筆分鐘線結果，已結算 ${progress.settled_count} 筆${progress.settled_count ? `，累計淨報酬 ${(progress.net_return_sum * 100).toFixed(2)}%` : ""}。` : " 分鐘線結果會隨後續 D1 自動累積。";
  const evaluation = state.paperEvaluation;
  const evaluationText = evaluation ? ` 評估狀態：${evaluation.status === "ready_for_review" ? "樣本已達門檻，可人工檢視" : "固定規則樣本收集中"}（${evaluation.decision_day_count}/${evaluation.minimum_decision_days} 日）。` : "";
  dashboard.paperProgress.innerHTML = `<strong>P2.11 紙上交易進度</strong><span>${escapeHtml(progress.rule_version)}：已累積 ${progress.decision_days}／20 個 D1 判斷日；尚差 ${progress.remaining_days} 日。候選 ${progress.candidate_count}、可交易 ${progress.watch_count}、實際觸發 ${progress.executed_count}、留倉覆核 ${progress.hold_review_count}、資料不足 ${progress.data_incomplete_count}。${escapeHtml(measured + evaluationText)}</span>`;
  const partialDates = Object.entries(data.health?.partial_market_dates || {}).map(([date, markets]) => `${date}: ${markets.join("/")}`).join("；");
  const d0Text = data.d0_decision_ready ? `D0 已完成 ${data.d0_decision_date} 09:15 判定，可觀察 ${data.health?.d0_eligible_count ?? 0} 檔。` : (data.health?.limitations || []).join(" ");
  const d1Text = data.d1_watch_ready ? `本頁 ${data.health?.regime_0915_date || data.effective_date} 的 09:15 大盤僅套用 D1 觀察名單。` : "D1 觀察名單尚未取得同日 09:15 大盤。";
  dashboard.warning.classList.toggle("is-ok", Boolean(data.trade_ready));
  dashboard.warning.innerHTML = `<strong>資料狀態：</strong><span>${escapeHtml(`${d0Text} ${d1Text}${partialDates ? ` 部分市場資料：${partialDates}。` : ""}`)}</span>`;
  const checks = state.systemHealth?.checks || {};
  const healthText = ["d1", "afterhours"].map((phase) => {
    const check = checks[phase];
    if (!check) return `${phase === "d1" ? "09:15" : "盤後"}：尚無健康紀錄`;
    const telegram = check.telegram_delivery_status ? `，Telegram ${check.telegram_delivery_status === "sent" ? "已送出" : check.telegram_delivery_status}` : "";
    const completed = check.actual_finished_at ? `，完成 ${check.actual_finished_at}` : "";
    const version = check.versions?.data_runtime_commit ? `，版本 ${check.versions.data_runtime_commit.slice(0, 7)}` : "";
    const failure = check.status === "failed" ? `，失敗步驟：${check.failed_step || "未分類"}${check.reasons?.length ? `（${check.reasons[0]}）` : ""}` : "";
    return `${phase === "d1" ? "09:15" : "盤後"}：${check.status === "ok" ? "已確認" : check.status === "skipped" ? "休市／跳過" : "異常"}${telegram}${completed}${version}${failure}（檢查 ${check.checked_at || "時間未知"}）`;
  }).join("；");
  const healthChecks = Object.values(checks);
  dashboard.systemHealth.classList.toggle("is-ok", healthChecks.length > 0 && healthChecks.every((check) => check.status === "ok"));
  dashboard.systemHealth.innerHTML = `<strong>自動更新：</strong><span>${escapeHtml(healthText)}</span>`;
  const freshness = state.marketFreshness;
  if (dashboard.freshness) {
    if (!freshness) {
      dashboard.freshness.innerHTML = "<strong>交易日與資料新鮮度：</strong><span>尚無檢查紀錄。</span>";
    } else {
      const market = freshness.market_day || {};
      const expectation = freshness.is_stale ? "資料已過期，系統會告警。" : market.status === "closed" ? `今日休市（${market.reason || "市場公告"}），不要求產生當日盤後資料。` : "資料日期符合目前交易時段的預期。";
      dashboard.freshness.classList.toggle("is-ok", !freshness.is_stale && market.status === "trading");
      dashboard.freshness.innerHTML = `<strong>交易日與資料新鮮度：</strong><span>${escapeHtml(`最新資料日 ${freshness.latest_data_date || "尚無"}；預期資料日 ${freshness.expected_latest_data_date || "尚無"}。${expectation}`)}</span>`;
    }
  }
  renderUpdateLedger(data);
  renderIndustryConsensus(data);
  renderProvenance(data);
  const nextStep = (value) => `<span class="next-step">${escapeHtml(nextStepChinese(value))}</span>`;
  renderRows(dashboard.d0Table, rows(data.d0_candidates), 6, (row) => `<tr>${cell("股票", `${stockLabel(row)}<br>${industryBadges(row)}`)}${cell("型態", `${escapeHtml(setupLabel(row.setup_type))}${decisionBadge(row)}`)}${cell("收盤", escapeHtml(text(row.close)))}${cell("成交量", escapeHtml(text(row.volume_lots)))}${cell("風險", riskBadges(row))}${cell("下一步", nextStep(row.next_step))}</tr>`, "沒有符合目前篩選條件的 D0 候選。");
  renderRows(dashboard.d1Table, rows(data.d1_watch), 8, (row) => `<tr>${cell("股票", `${stockLabel(row)}<br>${industryBadges(row)}`)}${cell("D0", escapeHtml(text(row.d0_date)))}${cell("開盤跳空 GAP", escapeHtml(text(row.d1_open_gap_pct)))}${cell("09:15 大盤", badge(regimeLabel(row), row.market_regime_0915 === "STRONG" ? "ok" : row.market_regime_0915 === "WEAK" ? "risk" : "warn"))}${cell("異常", row.corporate_action ? badge("公司行動", "risk") : row.abnormal_gap_check ? badge("需檢查", "warn") : badge("否", "ok"))}${cell("警示價", escapeHtml(text(row.alert_reclaim_price)))}${cell("停損", escapeHtml(text(row.stop_loss_price)))}${cell("下一步", nextStep(row.next_step))}</tr>`, "沒有符合目前篩選條件的 D1 觀察名單。");
  renderRows(dashboard.d2Table, rows(data.d2_watch), 7, (row) => `<tr>${cell("股票", `${stockLabel(row)}<br>${industryBadges(row)}`)}${cell("D0", escapeHtml(text(row.d0_date)))}${cell("D1", escapeHtml(text(row.d1_date)))}${cell("警示價", escapeHtml(text(row.alert_reclaim_price)))}${cell("失效價", escapeHtml(text(row.invalidation_price)))}${cell("狀態", badge(text(row.status), row.status === "reclaimed" ? "ok" : "warn"))}${cell("下一步", nextStep(row.next_step))}</tr>`, "沒有符合目前篩選條件的 D2+ 重返觀察。");
  saveMarketView();
};

const download = (content, name, type) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
const exportRows = () => [ ...rows(state.current.d0_candidates).map((row) => ({ ...row, stage: "D0" })), ...rows(state.current.d1_watch).map((row) => ({ ...row, stage: "D1" })), ...rows(state.current.d2_watch).map((row) => ({ ...row, stage: "D2+" })) ];
const bindControls = () => {
  [dashboard.setup, dashboard.liquidity, dashboard.risk, dashboard.decision, dashboard.sort].forEach((control) => control.addEventListener("change", () => renderDashboard(state.current)));
  dashboard.historyStock.addEventListener("change", renderHistory);
  dashboard.exportCsv.addEventListener("click", () => download(csvForRows(exportRows()), `tw-candidates-${state.current.as_of_date}.csv`, "text/csv;charset=utf-8"));
  dashboard.exportMarkdown.addEventListener("click", () => download(markdownForRows(exportRows(), state.current.as_of_date), `tw-candidates-${state.current.as_of_date}.md`, "text/markdown;charset=utf-8"));
  dashboard.copyViewLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      dashboard.copyViewLink.textContent = "已複製連結";
    } catch {
      dashboard.copyViewLink.textContent = "請從網址列複製";
    }
    setTimeout(() => { dashboard.copyViewLink.textContent = "複製目前連結"; }, 1800);
  });
};
const showDashboardError = (error) => {
  dashboard.source.textContent = "載入失敗";
  [dashboard.tradeReady, dashboard.d0Count, dashboard.d1Count, dashboard.d2Count].forEach((target) => { target.textContent = "資料異常"; });
  dashboard.warning.innerHTML = `<strong>資料載入失敗：</strong><span>${escapeHtml(error.message)}</span><button type="button" id="retry-dashboard">重新整理資料</button>`;
  dashboard.warning.querySelector("#retry-dashboard")?.addEventListener("click", () => window.location.reload());
  dashboard.provenance.innerHTML = "<strong>資料來源與可用性：</strong><span>目前無法載入，請重新整理；若持續失敗，代表資料檔或網路連線需要檢查。</span>";
  [dashboard.d0Table, dashboard.d1Table, dashboard.d2Table].forEach((table, index) => renderRows(table, [], [6, 8, 7][index], () => "", "資料尚未載入，無法顯示候選。"));
};
const initDashboard = async () => {
  bindDashboardTabs();
  try {
    const index = await fetchJson("data/daily/index.json");
    const dates = index.available_dates || [];
    if (!dates.length) throw new Error("資料索引沒有可用日期");
    dashboard.dateSelect.innerHTML = dates.map((date) => `<option value="${date}">${date}</option>`).join("");
    const documents = await Promise.all(dates.map((date) => fetchJson(`data/daily/${date}.json`)));
    state.systemHealth = await fetchJson("data/system-health.json", { checks: {} });
    state.marketFreshness = await fetchJson("data/market-freshness.json", null);
    state.paperEvaluation = await fetchJson("data/paper-evaluation.json", null);
    state.strategyEvaluation = await fetchJson("data/strategy-evaluation.json", null);
    state.intradayCoverage = await fetchJson("data/intraday-backtest-coverage.json", null);
    state.setupAResearch = await fetchJson("data/setup-a-research.json", null);
    state.backtestSummary = await fetchJson("data/backtest-summary.json", null);
    state.documents = new Map(documents.map((document) => [document.as_of_date, document]));
    state.histories = buildHistoryByStock(documents);
    dashboard.historyStock.innerHTML = [...state.histories.values()].sort((a, b) => a.stock_id.localeCompare(b.stock_id)).map((item) => `<option value="${item.stock_id}">${item.stock_id} ${escapeHtml(item.name)}</option>`).join("");
    restoreMarketView(dates);
    dashboard.dateSelect.addEventListener("change", async (event) => renderDashboard(documents[dates.indexOf(event.target.value)]));
    bindControls();
    renderBacktestSummary(state.backtestSummary);
    renderPaperEvidence();
    renderStrategyEvaluation();
    renderIntradayCoverage();
    renderSetupAResearch();
    renderDashboard(documents[dates.indexOf(dashboard.dateSelect.value)]);
    renderHistory();
  } catch (error) { showDashboardError(error); }
};
const initStrategy = async () => {
  try {
    state.backtestSummary = await fetchJson("data/backtest-summary.json", null);
    state.strategyEvaluation = await fetchJson("data/strategy-evaluation.json", null);
    state.intradayCoverage = await fetchJson("data/intraday-backtest-coverage.json", null);
    state.setupAResearch = await fetchJson("data/setup-a-research.json", null);
    const index = await fetchJson("data/daily/index.json");
    const documents = await Promise.all((index.available_dates || []).map((date) => fetchJson(`data/daily/${date}.json`)));
    state.documents = new Map(documents.map((document) => [document.as_of_date, document]));
    renderBacktestSummary(state.backtestSummary);
    renderPaperEvidence();
    renderStrategyEvaluation();
    renderIntradayCoverage();
    renderSetupAResearch();
  } catch (error) {
    if (dashboard.backtestConclusion) dashboard.backtestConclusion.textContent = "目前無法載入最新驗證資料";
  }
};

if (document.body.dataset.page === "market") initDashboard();
else initStrategy();
