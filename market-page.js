import {
  buildDecisionLanes,
  escapeHtml,
  fetchJson,
  formatLots,
  formatPercent,
  formatPrice,
  isHistoricalMode,
  regimeLabel,
  riskStatusLabel,
  setupLabel,
} from "./ux-core.js?v=20260812-statusfix";
import { downloadText, setupSite } from "./site.js";

setupSite();

const $ = (selector) => document.querySelector(selector);
const elements = {
  date: $("#decision-date"), overview: $("#decision-overview"), historical: $("#historical-banner"), error: $("#load-error"),
  tabs: [...document.querySelectorAll("[data-stage]")], title: $("#stage-title"), subtitle: $("#stage-subtitle"), list: $("#candidate-list"),
  filters: $("#filters"), filterToggle: $("#toggle-filters"), clear: $("#clear-filters"), setup: $("#filter-setup"),
  liquidity: $("#filter-liquidity"), risk: $("#filter-risk"), sort: $("#sort-by"), industry: $("#industry-content"),
  history: $("#history-content"), loadHistory: $("#load-history"), exportCsv: $("#export-csv"), copyLink: $("#copy-view-link"),
};

const state = {
  dates: [], latestDate: "", selectedDate: "", activeStage: "d1", lanes: null, documentCache: new Map(),
  freshness: null, health: null, currentRows: [], historyLoaded: false,
};
const isAfterHours = () => {
  const now = new Date();
  return now.getHours() > 13 || (now.getHours() === 13 && now.getMinutes() >= 30);
};
const taipeiDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const value = (row, ...keys) => keys.map((key) => row?.[key]).find((item) => item !== undefined && item !== null && item !== "");
const sourceLabel = (row) => {
  if (row.d1_quote_source) return "Fugle 一分鐘線（09:15 完整 K 棒）";
  if (row.eps_source || row.disposition_sources?.length) return "官方風險資料快照";
  return "盤後行情與策略封存資料";
};
const companyActionLabel = (row) => row.corporate_action ? `有公司行動${row.corporate_action_type ? `：${row.corporate_action_type}` : ""}` : "未標示公司行動";
const dispositionLabel = (row) => row.currently_disposed_snapshot ? "目前為處置股" : row.possible_disposition_next_day ? "下一交易日可能遭處置" : "未見處置警示";
const epsLabel = (row) => row.eps_ytd_negative ? `當年累積 EPS 虧損（${row.eps_ytd || "未提供數值"}）` : row.eps_ytd !== "" && row.eps_ytd !== undefined ? `當年累積 EPS ${row.eps_ytd}` : "EPS 尚未公告或未取得";

const metric = (label, content) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(content)}</dd></div>`;
const riskChip = (row) => {
  const label = riskStatusLabel(row);
  const flagged = row.issues.length || row.eps_ytd_negative || row.possible_disposition_next_day || row.currently_disposed_snapshot || !row.risk_flags_trade_ready || (row.risk_data_status && row.risk_data_status !== "VERIFIED_CLEAR");
  return `<span class="chip ${flagged ? (row.issues.length ? "block" : "warn") : "confirm"}">${escapeHtml(label)}</span>`;
};

const cardMetrics = (row) => {
  if (row.stage === "d0" || row.decisionPending) return [
    metric("盤後收盤", formatPrice(row.close)), metric("成交量", formatLots(row.volume_lots)), metric("量比", value(row, "volume_ratio_median20") ? `${Number(row.volume_ratio_median20).toFixed(2)} 倍` : "—"),
  ];
  if (row.stage === "d1") return [
    metric("觸發參考", formatPrice(row.paper_entry_trigger_price)), metric("停損參考", formatPrice(row.stop_loss_price)), metric("開盤跳空", formatPercent(value(row, "d1_open_gap_pct", "open_gap_pct"))),
    metric("09:15 大盤", regimeLabel(row.market_regime_0915)), metric("相對大盤", value(row, "stock_minus_taiex_return_pp") !== undefined ? `${Number(row.stock_minus_taiex_return_pp).toFixed(2)} 個百分點` : "—"), metric("風險距離", row.geometry.distance !== null ? formatPercent(row.geometry.distance) : "—"),
  ];
  return [
    metric("重返警示價", formatPrice(row.alert_reclaim_price)), metric("失效價", formatPrice(value(row, "invalidation_price", "stop_loss_price"))), metric("觀察至", value(row, "expires_on", "expiry_date") || "依規則最長 5 日"),
  ];
};

const candidateCard = (row) => {
  const stockName = value(row, "name", "stock_name") || "名稱未取得";
  const dateText = row.stage === "d0"
    ? `形成日 ${row.formationDate} · 預定判斷 ${row.decisionDate || "下一交易日"}`
    : row.stage === "d1" ? `候選形成 ${row.formationDate} · ${row.decisionPending ? "預定判斷" : "09:15 判斷"} ${row.decisionDate}` : `D2+ 觀察 · 本頁狀態日 ${row.decisionDate}`;
  const issueList = row.issues.length > 1 ? `<ul>${row.issues.slice(1).map((issue) => `<li>${escapeHtml(issue.label)}</li>`).join("")}</ul>` : "";
  const sector = row.industry || "板塊未分類";
  return `<article class="candidate-card" data-state="${escapeHtml(row.state)}">
    <div class="candidate-head"><div><h3>${escapeHtml(row.stock_id)} ${escapeHtml(stockName)}</h3><p>${escapeHtml(sector)}</p></div><span class="action-badge">${escapeHtml(row.action)}</span></div>
    <p class="candidate-dates">${escapeHtml(dateText)}</p>
    <dl class="candidate-metrics">${cardMetrics(row).join("")}</dl>
    <p class="candidate-reason">${escapeHtml(row.reason)}</p>${issueList}
    <div class="risk-row"><span class="chip">${escapeHtml(setupLabel(row.setup_type))}</span>${row.industry_consensus ? `<span class="chip confirm">同板塊候選達 2 檔以上</span>` : ""}${riskChip(row)}</div>
    <details><summary>查看風險與資料來源</summary><div class="detail-list">
      <span><strong>EPS：</strong>${escapeHtml(epsLabel(row))}</span>
      <span><strong>處置：</strong>${escapeHtml(dispositionLabel(row))}</span>
      <span><strong>公司行動：</strong>${escapeHtml(companyActionLabel(row))}</span>
      <span><strong>資料狀態：</strong>${escapeHtml(row.risk_data_status_label || riskStatusLabel(row))}</span>
      <span><strong>行情來源：</strong>${escapeHtml(sourceLabel(row))}</span>
      <span><strong>策略版本：</strong>${escapeHtml(row.paper_trade_rule_version || "固定規則封存")}</span>
    </div></details>
  </article>`;
};

const filteredRows = () => {
  const rows = [...(state.lanes?.[state.activeStage]?.rows || [])].filter((row) => {
    if (elements.setup.value !== "all" && row.setup_type !== elements.setup.value) return false;
    if (elements.liquidity.value !== "all" && row.liquidity_bucket !== elements.liquidity.value) return false;
    const flagged = row.issues.length || row.eps_ytd_negative || row.possible_disposition_next_day || row.currently_disposed_snapshot || row.risk_flags_trade_ready === false;
    if (elements.risk.value === "clear" && flagged) return false;
    if (elements.risk.value === "flagged" && !flagged) return false;
    return true;
  });
  if (elements.sort.value === "volume") rows.sort((a, b) => Number(b.volume_lots || 0) - Number(a.volume_lots || 0));
  else if (elements.sort.value === "stock") rows.sort((a, b) => String(a.stock_id).localeCompare(String(b.stock_id)));
  else rows.sort((a, b) => Number(Boolean(b.industry_consensus)) - Number(Boolean(a.industry_consensus)) || Number(b.volume_lots || 0) - Number(a.volume_lots || 0));
  return rows;
};

const renderRows = () => {
  const lane = state.lanes[state.activeStage];
  const rows = filteredRows();
  state.currentRows = rows;
  elements.title.textContent = lane.title;
  elements.subtitle.textContent = lane.subtitle;
  elements.list.setAttribute("aria-busy", "false");
  if (!lane.rows.length) {
    const explanation = state.activeStage === "d1" ? "這個形成日沒有盤後候選，因此下一交易日沒有需要判斷的股票。" : state.activeStage === "d0" ? "當天沒有符合固定規則的盤後候選，這是正常結果。" : "目前沒有仍有效的 D2+ 觀察股。";
    elements.list.innerHTML = `<div class="empty-state"><h3>此階段沒有名單</h3><p>${explanation}</p></div>`;
  } else if (!rows.length) {
    elements.list.innerHTML = `<div class="empty-state"><h3>篩選後沒有股票</h3><p>原始名單有 ${lane.rows.length} 檔；請清除篩選後再查看。</p></div>`;
  } else elements.list.innerHTML = rows.map(candidateCard).join("");
  elements.clear.hidden = [elements.setup, elements.liquidity, elements.risk].every((item) => item.value === "all") && elements.sort.value === "priority";
};

const renderIndustry = () => {
  const allRows = Object.values(state.lanes).flatMap((lane) => lane.rows);
  const groups = new Map();
  allRows.forEach((row) => {
    const name = row.industry || "板塊未分類";
    if (!groups.has(name)) groups.set(name, new Set());
    groups.get(name).add(row.stock_id);
  });
  const ranked = [...groups.entries()].sort((a, b) => b[1].size - a[1].size);
  elements.industry.innerHTML = ranked.length ? `<p>同一板塊出現多檔只作排序加分，不是買進保證。</p><div class="risk-row">${ranked.map(([name, stocks]) => `<span class="chip ${stocks.size >= 2 ? "confirm" : ""}">${escapeHtml(name)} ${stocks.size} 檔</span>`).join("")}</div>` : "<p>目前沒有可統計的候選股。</p>";
};

const renderOverview = () => {
  const lanes = state.lanes;
  const d1Watch = lanes.d1.rows.filter((row) => row.state === "watching" || row.state === "caution").length;
  const blocked = lanes.d1.rows.filter((row) => row.state === "blocked").length;
  const historical = isHistoricalMode(state.selectedDate, state.latestDate);
  const decisionIsToday = lanes.d1.decisionDate === taipeiDate();
  const headline = historical ? `正在查看 ${state.selectedDate} 的歷史封存` : decisionIsToday && !lanes.d1.decisionReady ? `等待今天 ${lanes.d1.decisionDate} 09:15 判斷` : decisionIsToday ? `今天 ${lanes.d1.decisionDate} 的 09:15 判斷已完成` : `盤後先準備 ${lanes.d0.decisionDate || "下一交易日"} 的名單`;
  const note = historical ? "歷史模式不代表現在仍可交易；請以每張卡片的形成日、判斷日與失效條件為準。" : !lanes.d1.decisionReady ? `${lanes.d1.rows.length} 檔盤後候選等待 ${lanes.d1.decisionDate || "下一交易日"} 09:15 判斷，目前尚無任何股票可標示為保留監看。` : `${d1Watch} 檔保留監看、${blocked} 檔已被安全條件阻擋。`;
  const dayWord = historical ? "當日" : "今日";
  elements.overview.innerHTML = `<div><h2>${escapeHtml(headline)}</h2><p>${escapeHtml(note)}</p></div><div class="overview-stats"><div class="overview-stat"><strong>${d1Watch}</strong><span>${dayWord}保留監看</span></div><div class="overview-stat"><strong>${blocked}</strong><span>${dayWord}禁止介入</span></div><div class="overview-stat"><strong>${lanes.d1.decisionReady ? 0 : lanes.d1.rows.length}</strong><span>等待 09:15</span></div></div>`;
  elements.overview.setAttribute("aria-busy", "false");
  elements.historical.hidden = !historical;
  if (historical) elements.historical.textContent = `歷史模式：這是 ${state.selectedDate} 的封存資料，不是今天的即時建議。最新可用資料日為 ${state.latestDate}。`;
  $("#page-title").textContent = historical ? `查看 ${state.selectedDate} 的封存紀錄` : "今天該做什麼？";
  $("#page-intro").textContent = historical ? "這個日期只供回顧，不代表現在仍可交易。" : "先確認日期與階段，再閱讀個股條件。本頁只提供研究與紙上觀察，不會自動下單。";
};

const setActiveStage = (stage, { updateUrl = true } = {}) => {
  state.activeStage = state.lanes?.[stage] ? stage : "d1";
  elements.tabs.forEach((tab) => {
    const active = tab.dataset.stage === state.activeStage;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  elements.list.setAttribute("aria-labelledby", `tab-${state.activeStage}`);
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set("date", state.selectedDate);
    url.searchParams.set("stage", state.activeStage);
    history.replaceState(null, "", url);
  }
  renderRows();
};

const loadDocument = async (date) => {
  if (!date) return null;
  if (!state.documentCache.has(date)) state.documentCache.set(date, fetchJson(`data/daily/${date}.json`).catch((error) => { state.documentCache.delete(date); throw error; }));
  return state.documentCache.get(date);
};

const renderDate = async (date) => {
  elements.date.disabled = true;
  elements.list.setAttribute("aria-busy", "true");
  elements.error.hidden = true;
  try {
    const index = state.dates.indexOf(date);
    const previousDate = index > 0 ? state.dates[index - 1] : "";
    const nextIndexedDate = index >= 0 && index < state.dates.length - 1 ? state.dates[index + 1] : "";
    const [selected, previous] = await Promise.all([loadDocument(date), loadDocument(previousDate)]);
    state.selectedDate = date;
    const nextTradingDate = nextIndexedDate || state.freshness?.next_trading_date || "";
    state.lanes = buildDecisionLanes({ selected, previous, selectedDate: date, nextTradingDate });
    elements.tabs.forEach((tab) => { const lane = state.lanes[tab.dataset.stage]; tab.disabled = false; tab.firstChild.nodeValue = `${lane.tabLabel} `; tab.querySelector("span").textContent = lane.rows.length; });
    elements.filterToggle.disabled = false;
    renderOverview();
    renderIndustry();
    const requestedStage = new URL(location.href).searchParams.get("stage");
    const defaultStage = state.lanes.d1.decisionDate === taipeiDate() || isHistoricalMode(date, state.latestDate) ? "d1" : isAfterHours() ? "d0" : "d1";
    setActiveStage(requestedStage || defaultStage, { updateUrl: true });
  } catch (error) {
    elements.error.hidden = false;
    elements.error.innerHTML = `資料載入失敗：${escapeHtml(error.message)} <button id="retry-date" type="button">重新載入</button>`;
    $("#retry-date")?.addEventListener("click", () => renderDate(date));
    elements.list.innerHTML = `<div class="empty-state"><h3>無法載入這個日期</h3><p>這不是「零候選」，而是資料檔或網路讀取失敗。</p></div>`;
  } finally { elements.date.disabled = false; elements.list.setAttribute("aria-busy", "false"); }
};

const loadHistory = async () => {
  elements.history.innerHTML = "<p>正在載入歷史資料…</p>";
  const outcomes = await Promise.allSettled(state.dates.map(loadDocument));
  const docs = outcomes.filter((item) => item.status === "fulfilled").map((item) => item.value);
  const failed = outcomes.length - docs.length;
  const stockMap = new Map();
  docs.forEach((doc) => [
    ...(doc.d0_candidates || []).map((row) => ({ ...row, life: "形成盤後候選", date: doc.effective_date })),
    ...(doc.d1_watch || []).map((row) => ({ ...row, life: "完成 D1 觀察", date: row.d1_date || doc.effective_date })),
    ...(doc.d2_watch || []).map((row) => ({ ...row, life: "進入 D2+ 觀察", date: doc.effective_date })),
  ].forEach((row) => {
    if (!stockMap.has(row.stock_id)) stockMap.set(row.stock_id, { name: row.name, events: [] });
    stockMap.get(row.stock_id).events.push(row);
  }));
  const options = [...stockMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  elements.history.innerHTML = `${failed ? `<p class="notice notice-danger">有 ${failed} 個日期載入失敗，其餘歷程仍可查看。</p>` : ""}<label>選擇股票 <select id="history-stock">${options.map(([id, item]) => `<option value="${escapeHtml(id)}">${escapeHtml(id)} ${escapeHtml(item.name || "")}</option>`).join("")}</select></label><div id="timeline"></div>`;
  const render = () => {
    const id = $("#history-stock").value;
    const item = stockMap.get(id);
    $("#timeline").innerHTML = `<div class="status-list">${item.events.sort((a, b) => String(a.date).localeCompare(String(b.date))).map((event) => `<div class="status-row"><p><strong>${escapeHtml(event.date)}</strong><br>${escapeHtml(event.life)}</p><span class="chip">${escapeHtml(event.industry || "板塊未分類")}</span></div>`).join("")}</div>`;
  };
  $("#history-stock").addEventListener("change", render);
  render();
  state.historyLoaded = true;
};

const bindEvents = () => {
  elements.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveStage(tab.dataset.stage)));
  elements.tabs.forEach((tab, index) => tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + elements.tabs.length) % elements.tabs.length;
    elements.tabs[next].focus(); elements.tabs[next].click();
  }));
  elements.date.addEventListener("change", () => renderDate(elements.date.value));
  elements.filterToggle.addEventListener("click", () => {
    const opening = elements.filters.hidden;
    elements.filters.hidden = !opening;
    elements.filterToggle.setAttribute("aria-expanded", String(opening));
  });
  [elements.setup, elements.liquidity, elements.risk, elements.sort].forEach((control) => control.addEventListener("change", renderRows));
  elements.clear.addEventListener("click", () => { elements.setup.value = elements.liquidity.value = elements.risk.value = "all"; elements.sort.value = "priority"; renderRows(); });
  elements.loadHistory.addEventListener("click", loadHistory);
  elements.exportCsv.addEventListener("click", () => {
    const rows = state.currentRows;
    const csv = [["股票代號", "名稱", "板塊", "階段", "動作", "形成日", "判斷日", "觸發參考", "停損參考", "原因"], ...rows.map((row) => [row.stock_id, row.name, row.industry, state.lanes[state.activeStage].title, row.action, row.formationDate, row.decisionDate, row.paper_entry_trigger_price || "", row.stop_loss_price || "", row.reason])].map((cells) => cells.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadText(`${state.selectedDate}-${state.activeStage}-候選.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
  });
  elements.copyLink.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); elements.copyLink.textContent = "已複製"; }
    catch { elements.copyLink.textContent = "請從網址列複製"; }
    setTimeout(() => { elements.copyLink.textContent = "複製此畫面連結"; }, 1600);
  });
};

const init = async () => {
  bindEvents();
  try {
    const [indexResult, freshnessResult, healthResult] = await Promise.allSettled([
      fetchJson("data/daily/index.json"), fetchJson("data/market-freshness.json"), fetchJson("data/system-health.json"),
    ]);
    if (indexResult.status !== "fulfilled") throw indexResult.reason;
    state.freshness = freshnessResult.status === "fulfilled" ? freshnessResult.value : null;
    state.health = healthResult.status === "fulfilled" ? healthResult.value : null;
    state.dates = indexResult.value.available_dates || [];
    if (!state.dates.length) throw new Error("日期索引目前沒有可用資料");
    state.latestDate = state.dates.at(-1);
    const requested = new URL(location.href).searchParams.get("date");
    const selected = state.dates.includes(requested) ? requested : state.latestDate;
    elements.date.innerHTML = [...state.dates].reverse().map((date) => `<option value="${date}" ${date === selected ? "selected" : ""}>${date}${date === state.latestDate ? "（最新）" : ""}</option>`).join("");
    await renderDate(selected);
  } catch (error) {
    elements.error.hidden = false;
    elements.error.innerHTML = `無法啟動每日決策中心：${escapeHtml(error.message)} <button type="button" onclick="location.reload()">重新整理</button>`;
    elements.overview.innerHTML = "<div><h2>資料目前無法讀取</h2><p>這是載入失敗，不代表今天沒有候選股。</p></div>";
  }
};

init();
