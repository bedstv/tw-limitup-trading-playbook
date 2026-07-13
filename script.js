import {
  buildHistoryByStock,
  csvForRows,
  decisionStatus,
  filterAndSortRows,
  markdownForRows,
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
  warning: document.querySelector("#dashboard-warning"), d0Table: document.querySelector("#d0-table"),
  d1Table: document.querySelector("#d1-table"), d2Table: document.querySelector("#d2-table"),
  setup: document.querySelector("#filter-setup"), liquidity: document.querySelector("#filter-liquidity"),
  risk: document.querySelector("#filter-risk"), decision: document.querySelector("#filter-decision"),
  sort: document.querySelector("#sort-by"), exportCsv: document.querySelector("#export-csv"),
  exportMarkdown: document.querySelector("#export-markdown"), historyStock: document.querySelector("#history-stock"),
  historyTimeline: document.querySelector("#history-timeline"),
};
const state = { current: null, histories: new Map() };
const escapeHtml = (value) => text(value, "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const badge = (label, type = "") => `<span class="badge ${type ? `badge-${type}` : ""}">${escapeHtml(label)}</span>`;
const stockLabel = (row) => `${escapeHtml(text(row.stock_id))} ${escapeHtml(text(row.name, ""))}`.trim();
const industryBadges = (row) => [badge(text(row.industry, "未分類"), "industry"), row.industry_consensus ? badge(`板塊共識 ×${row.industry_candidate_count}`, "consensus") : ""].join("");
const riskBadges = (row) => {
  const labels = [];
  if (row.eps_ytd_negative) labels.push(badge("EPS虧損", "risk"));
  if (row.currently_disposed_snapshot) labels.push(badge("處置中", "risk"));
  if (row.possible_disposition_next_day) labels.push(badge("可能處置", "risk"));
  return labels.length ? labels.join("") : badge("未標示", "ok");
};
const decisionBadge = (row) => row.d1_decision_ready ? `<br>${badge(decisionStatus(row), decisionStatus(row) === "WATCH" ? "ok" : decisionStatus(row) === "PULLBACK_ONLY" ? "warn" : "risk")}` : "";
const emptyRow = (columns, message) => `<tr><td class="dashboard-empty" colspan="${columns}">${message}</td></tr>`;
const renderRows = (target, rows, columns, renderer, emptyMessage) => { target.innerHTML = rows.length ? rows.map(renderer).join("") : emptyRow(columns, emptyMessage); };
const filters = () => ({ setup: dashboard.setup.value, liquidity: dashboard.liquidity.value, risk: dashboard.risk.value, decision: dashboard.decision.value, sort: dashboard.sort.value });
const rows = (source) => filterAndSortRows(source || [], filters());

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
  const partialDates = Object.entries(data.health?.partial_market_dates || {}).map(([date, markets]) => `${date}: ${markets.join("/")}`).join("；");
  const d0Text = data.d0_decision_ready ? `D0 已完成 ${data.d0_decision_date} 09:15 判定，可觀察 ${data.health?.d0_eligible_count ?? 0} 檔。` : (data.health?.limitations || []).join(" ");
  const d1Text = data.d1_watch_ready ? `本頁 ${data.health?.regime_0915_date || data.effective_date} 的 09:15 大盤僅套用 D1 觀察名單。` : "D1 觀察名單尚未取得同日 09:15 大盤。";
  dashboard.warning.classList.toggle("is-ok", Boolean(data.trade_ready));
  dashboard.warning.innerHTML = `<strong>資料狀態：</strong><span>${escapeHtml(`${d0Text} ${d1Text}${partialDates ? ` Partial market：${partialDates}。` : ""}`)}</span>`;
  renderRows(dashboard.d0Table, rows(data.d0_candidates), 6, (row) => `<tr><td>${stockLabel(row)}<br>${industryBadges(row)}</td><td>${escapeHtml(text(row.setup_type))}${decisionBadge(row)}</td><td>${escapeHtml(text(row.close))}</td><td>${escapeHtml(text(row.volume_lots))}</td><td>${riskBadges(row)}</td><td>${escapeHtml(text(row.next_step))}</td></tr>`, "沒有符合目前篩選條件的 D0 候選。");
  renderRows(dashboard.d1Table, rows(data.d1_watch), 8, (row) => `<tr><td>${stockLabel(row)}<br>${industryBadges(row)}</td><td>${escapeHtml(text(row.d0_date))}</td><td>${escapeHtml(text(row.d1_open_gap_pct))}</td><td>${badge(`${text(row.market_regime_0915)} ${text(row.taiex_return_0915, "")}`.trim(), row.market_regime_0915 === "STRONG" ? "ok" : row.market_regime_0915 === "WEAK" ? "risk" : "warn")}</td><td>${row.corporate_action ? badge("公司行動", "risk") : row.abnormal_gap_check ? badge("需檢查", "warn") : badge("否", "ok")}</td><td>${escapeHtml(text(row.alert_reclaim_price))}</td><td>${escapeHtml(text(row.stop_loss_price))}</td><td>${escapeHtml(text(row.next_step))}</td></tr>`, "沒有符合目前篩選條件的 D1 觀察名單。");
  renderRows(dashboard.d2Table, rows(data.d2_watch), 7, (row) => `<tr><td>${stockLabel(row)}<br>${industryBadges(row)}</td><td>${escapeHtml(text(row.d0_date))}</td><td>${escapeHtml(text(row.d1_date))}</td><td>${escapeHtml(text(row.alert_reclaim_price))}</td><td>${escapeHtml(text(row.invalidation_price))}</td><td>${badge(text(row.status), row.status === "reclaimed" ? "ok" : "warn")}</td><td>${escapeHtml(text(row.next_step))}</td></tr>`, "沒有符合目前篩選條件的 D2+ 重返觀察。");
};

const download = (content, name, type) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
const exportRows = () => [ ...rows(state.current.d0_candidates).map((row) => ({ ...row, stage: "D0" })), ...rows(state.current.d1_watch).map((row) => ({ ...row, stage: "D1" })), ...rows(state.current.d2_watch).map((row) => ({ ...row, stage: "D2+" })) ];
const bindControls = () => {
  [dashboard.setup, dashboard.liquidity, dashboard.risk, dashboard.decision, dashboard.sort].forEach((control) => control.addEventListener("change", () => renderDashboard(state.current)));
  dashboard.historyStock.addEventListener("change", renderHistory);
  dashboard.exportCsv.addEventListener("click", () => download(csvForRows(exportRows()), `tw-candidates-${state.current.as_of_date}.csv`, "text/csv;charset=utf-8"));
  dashboard.exportMarkdown.addEventListener("click", () => download(markdownForRows(exportRows(), state.current.as_of_date), `tw-candidates-${state.current.as_of_date}.md`, "text/markdown;charset=utf-8"));
};
const showDashboardError = (error) => { dashboard.source.textContent = "載入失敗"; dashboard.warning.innerHTML = `<strong>資料狀態：</strong><span>${escapeHtml(error.message)}</span>`; [dashboard.d0Table, dashboard.d1Table, dashboard.d2Table].forEach((table, index) => renderRows(table, [], [6, 8, 7][index], () => "", "Dashboard data 載入失敗。")); };
const initDashboard = async () => {
  try {
    const index = await (await fetch("data/daily/index.json", { cache: "no-store" })).json();
    const dates = index.available_dates || [];
    dashboard.dateSelect.innerHTML = dates.map((date) => `<option value="${date}">${date}</option>`).join("");
    const documents = await Promise.all(dates.map(async (date) => (await fetch(`data/daily/${date}.json`, { cache: "no-store" })).json()));
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
