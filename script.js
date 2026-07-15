import {
  buildHistoryByStock,
  csvForRows,
  decisionStatus,
  filterAndSortRows,
  markdownForRows,
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
  warning: document.querySelector("#dashboard-warning"), systemHealth: document.querySelector("#dashboard-system-health"), d0Table: document.querySelector("#d0-table"),
  provenance: document.querySelector("#dashboard-provenance"),
  d1Table: document.querySelector("#d1-table"), d2Table: document.querySelector("#d2-table"),
  setup: document.querySelector("#filter-setup"), liquidity: document.querySelector("#filter-liquidity"),
  risk: document.querySelector("#filter-risk"), decision: document.querySelector("#filter-decision"),
  sort: document.querySelector("#sort-by"), exportCsv: document.querySelector("#export-csv"),
  exportMarkdown: document.querySelector("#export-markdown"), historyStock: document.querySelector("#history-stock"),
  historyTimeline: document.querySelector("#history-timeline"),
  paperProgress: document.querySelector("#paper-progress"),
  tabs: [...document.querySelectorAll("[data-dashboard-tab]")],
  tabPanels: [...document.querySelectorAll(".dashboard-tab-panel")],
};
const state = { current: null, histories: new Map() };
const escapeHtml = (value) => text(value, "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const badge = (label, type = "") => `<span class="badge ${type ? `badge-${type}` : ""}">${escapeHtml(label)}</span>`;
const stockLabel = (row) => `${escapeHtml(text(row.stock_id))} ${escapeHtml(text(row.name, ""))}`.trim();
const setupLabel = (value) => ({ A: "A 型：盤整量縮漲停", B: "B 型：突破前高、帶量漲停" }[value] || text(value));
const decisionLabel = (value) => ({ WATCH: "可觀察（WATCH）", PULLBACK_ONLY: "等拉回（PULLBACK_ONLY）", DOWNRANK: "降權觀察（DOWNRANK）", REJECT: "不介入（REJECT）", PENDING: "等待 D1 判定" }[value] || value);
const nextStepChinese = (value) => ({
  "D1 open watch; avoid direct chase if D1 open gap >5%": "D1 開盤後觀察；若開盤跳空超過 5%，不可直接追價。",
  "Consider only after intraday confirmation; daily sequence still ambiguous": "待盤中條件確認後才考慮；日線無法判定先進場或先停損。",
  "Neutral market allows A/B setup; await actual entry trigger.": "09:15 大盤為中性；可保留 A／B 型，但須等待實際進場觸發。",
  "D1 opening gap exceeded 7%.": "D1 開盤跳空超過 7%，不介入。",
  "Stock was under disposition on D1.": "D1 已列處置股，不介入。",
  "No D2 reclaim setup; monitor only if relative strength confirmed": "尚未形成 D2 重返警示價條件；僅在相對強勢確認後持續追蹤。",
  "Add to D2 reclaim watch": "納入 D2+ 重返警示價觀察。",
}[text(value, "")] || text(value));
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
const filters = () => ({ setup: dashboard.setup.value, liquidity: dashboard.liquidity.value, risk: dashboard.risk.value, decision: dashboard.decision.value, sort: dashboard.sort.value });
const rows = (source) => filterAndSortRows(source || [], filters());
const bindDashboardTabs = () => {
  dashboard.tabs.forEach((tab) => tab.addEventListener("click", () => {
    const active = tab.dataset.dashboardTab;
    dashboard.tabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    dashboard.tabPanels.forEach((panel) => { panel.hidden = panel.id !== `dashboard-${active}`; });
  }));
};
const unique = (items) => [...new Set(items.filter(Boolean))];
const sourceName = (source) => ({
  "Fugle 1m completed 09:15 bar": "Fugle 1 分鐘線（已完成 09:15 K）",
  "TWSE MIS live quote": "TWSE 即時行情（09:15）",
  "Fugle:historical/candles:1m": "Fugle 1 分鐘線",
}[source] || source);
const renderProvenance = (data) => {
  const d1Sources = unique((data.d0_candidates || []).filter((row) => row.d1_decision_ready).map((row) => row.d1_quote_source));
  const minuteSources = unique((data.paper_trading_records || []).map((row) => row.minute_bar_source));
  const afterhours = data.afterhours_ready ? "可用" : "候選可顯示，但風險快照或公司行動資料尚未完整";
  const d1 = d1Sources.length ? `可用：${d1Sources.map(sourceName).join("、")}` : "尚未取得；不可據此做 D1 進場判斷";
  const paper = minuteSources.length ? `已封存：${minuteSources.map(sourceName).join("、")}` : "尚無已封存的分鐘線紙上交易紀錄";
  dashboard.provenance.innerHTML = `<strong>資料來源與可用性：</strong><span>盤後候選：TWSE／TPEx 官方日行情（${escapeHtml(afterhours)}）。09:15 判斷：${escapeHtml(d1)}。紙上交易分鐘線：${escapeHtml(paper)}。</span>`;
};

const renderHistory = () => {
  const history = state.histories.get(dashboard.historyStock.value);
  if (!history) { dashboard.historyTimeline.innerHTML = "<p>目前篩選資料沒有可追蹤的個股。</p>"; return; }
  dashboard.historyTimeline.innerHTML = history.events.map((event) => `<article class="history-event"><span>${escapeHtml(event.date)}</span><strong>${escapeHtml(event.stage)} · ${escapeHtml(event.status)}</strong><b>${escapeHtml(text(event.price))}</b><p>${escapeHtml(event.detail)}</p></article>`).join("");
};

const renderDashboard = (data) => {
  state.current = data;
  dashboard.source.textContent = `${data.source || "P2.1"} · 有效資料日 ${data.effective_date}`;
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
    return `${phase === "d1" ? "09:15" : "盤後"}：${check.status === "ok" ? "已確認" : check.status === "skipped" ? "跳過" : "異常"}${telegram}（${check.checked_at || "時間未知"}）`;
  }).join("；");
  dashboard.systemHealth.classList.toggle("is-ok", Object.values(checks).every((check) => check.status === "ok"));
  dashboard.systemHealth.innerHTML = `<strong>自動更新：</strong><span>${escapeHtml(healthText)}</span>`;
  renderProvenance(data);
  renderRows(dashboard.d0Table, rows(data.d0_candidates), 6, (row) => `<tr><td>${stockLabel(row)}<br>${industryBadges(row)}</td><td title="${escapeHtml(setupLabel(row.setup_type))}">${escapeHtml(setupLabel(row.setup_type))}${decisionBadge(row)}</td><td>${escapeHtml(text(row.close))}</td><td>${escapeHtml(text(row.volume_lots))}</td><td>${riskBadges(row)}</td><td>${escapeHtml(nextStepChinese(row.next_step))}</td></tr>`, "沒有符合目前篩選條件的 D0 候選。");
  renderRows(dashboard.d1Table, rows(data.d1_watch), 8, (row) => `<tr><td>${stockLabel(row)}<br>${industryBadges(row)}</td><td>${escapeHtml(text(row.d0_date))}</td><td title="D1 開盤價相對 D0 收盤價的變動百分比。正值為跳空開高，負值為跳空開低。">${escapeHtml(text(row.d1_open_gap_pct))}</td><td title="09:15 加權指數相對前一日收盤的變動；-0.00% 是極小負值四捨五入後的顯示。">${badge(regimeLabel(row), row.market_regime_0915 === "STRONG" ? "ok" : row.market_regime_0915 === "WEAK" ? "risk" : "warn")}</td><td>${row.corporate_action ? badge("公司行動", "risk") : row.abnormal_gap_check ? badge("需檢查", "warn") : badge("否", "ok")}</td><td>${escapeHtml(text(row.alert_reclaim_price))}</td><td>${escapeHtml(text(row.stop_loss_price))}</td><td>${escapeHtml(nextStepChinese(row.next_step))}</td></tr>`, "沒有符合目前篩選條件的 D1 觀察名單。");
  renderRows(dashboard.d2Table, rows(data.d2_watch), 7, (row) => `<tr><td>${stockLabel(row)}<br>${industryBadges(row)}</td><td>${escapeHtml(text(row.d0_date))}</td><td>${escapeHtml(text(row.d1_date))}</td><td>${escapeHtml(text(row.alert_reclaim_price))}</td><td>${escapeHtml(text(row.invalidation_price))}</td><td>${badge(text(row.status), row.status === "reclaimed" ? "ok" : "warn")}</td><td>${escapeHtml(nextStepChinese(row.next_step))}</td></tr>`, "沒有符合目前篩選條件的 D2+ 重返觀察。");
};

const download = (content, name, type) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
const exportRows = () => [ ...rows(state.current.d0_candidates).map((row) => ({ ...row, stage: "D0" })), ...rows(state.current.d1_watch).map((row) => ({ ...row, stage: "D1" })), ...rows(state.current.d2_watch).map((row) => ({ ...row, stage: "D2+" })) ];
const bindControls = () => {
  [dashboard.setup, dashboard.liquidity, dashboard.risk, dashboard.decision, dashboard.sort].forEach((control) => control.addEventListener("change", () => renderDashboard(state.current)));
  dashboard.historyStock.addEventListener("change", renderHistory);
  dashboard.exportCsv.addEventListener("click", () => download(csvForRows(exportRows()), `tw-candidates-${state.current.as_of_date}.csv`, "text/csv;charset=utf-8"));
  dashboard.exportMarkdown.addEventListener("click", () => download(markdownForRows(exportRows(), state.current.as_of_date), `tw-candidates-${state.current.as_of_date}.md`, "text/markdown;charset=utf-8"));
};
const showDashboardError = (error) => { dashboard.source.textContent = "載入失敗"; dashboard.warning.innerHTML = `<strong>資料狀態：</strong><span>${escapeHtml(error.message)}</span>`; dashboard.provenance.innerHTML = "<strong>資料來源與可用性：</strong><span>無法載入。</span>"; [dashboard.d0Table, dashboard.d1Table, dashboard.d2Table].forEach((table, index) => renderRows(table, [], [6, 8, 7][index], () => "", "Dashboard data 載入失敗。")); };
const initDashboard = async () => {
  bindDashboardTabs();
  try {
    const index = await (await fetch("data/daily/index.json", { cache: "no-store" })).json();
    const dates = index.available_dates || [];
    dashboard.dateSelect.innerHTML = dates.map((date) => `<option value="${date}">${date}</option>`).join("");
    const documents = await Promise.all(dates.map(async (date) => (await fetch(`data/daily/${date}.json`, { cache: "no-store" })).json()));
    state.systemHealth = await (await fetch("data/system-health.json", { cache: "no-store" })).json().catch(() => ({ checks: {} }));
    state.paperEvaluation = await (await fetch("data/paper-evaluation.json", { cache: "no-store" })).json().catch(() => null);
    state.documents = new Map(documents.map((document) => [document.as_of_date, document]));
    state.histories = buildHistoryByStock(documents);
    dashboard.historyStock.innerHTML = [...state.histories.values()].sort((a, b) => a.stock_id.localeCompare(b.stock_id)).map((item) => `<option value="${item.stock_id}">${item.stock_id} ${escapeHtml(item.name)}</option>`).join("");
    dashboard.dateSelect.value = index.latest || dates.at(-1);
    dashboard.dateSelect.addEventListener("change", async (event) => renderDashboard(documents[dates.indexOf(event.target.value)]));
    bindControls();
    renderDashboard(documents[dates.indexOf(dashboard.dateSelect.value)]);
    renderHistory();
  } catch (error) { showDashboardError(error); }
};
initDashboard();
