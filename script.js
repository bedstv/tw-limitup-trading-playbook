const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll("nav a")];

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      link.toggleAttribute(
        "aria-current",
        link.getAttribute("href") === `#${visible.target.id}`,
      );
    });
  },
  { rootMargin: "-25% 0px -60% 0px", threshold: [0.05, 0.2, 0.5] },
);

sections.forEach((section) => observer.observe(section));

const dashboard = {
  dateSelect: document.querySelector("#dashboard-date"),
  source: document.querySelector("#dashboard-source"),
  tradeReady: document.querySelector("#trade-ready"),
  d0Count: document.querySelector("#d0-count"),
  d1Count: document.querySelector("#d1-count"),
  d2Count: document.querySelector("#d2-count"),
  warning: document.querySelector("#dashboard-warning"),
  d0Table: document.querySelector("#d0-table"),
  d1Table: document.querySelector("#d1-table"),
  d2Table: document.querySelector("#d2-table"),
};

const text = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const boolText = (value) => (value ? "是" : "否");

const stockLabel = (row) =>
  `${text(row.stock_id)} ${text(row.name, "")}`.trim();

const badge = (label, type = "") =>
  `<span class="badge ${type ? `badge-${type}` : ""}">${label}</span>`;

const industryBadges = (row) => {
  const labels = [badge(text(row.industry, "未分類"), "industry")];
  if (row.industry_consensus) {
    labels.push(badge(`板塊共識 ×${row.industry_candidate_count}`, "consensus"));
  }
  return labels.join("");
};

const riskBadges = (row) => {
  const badges = [];
  if (row.eps_ytd_negative) badges.push(badge("EPS虧損", "risk"));
  if (row.currently_disposed_snapshot) badges.push(badge("處置中", "risk"));
  if (row.possible_disposition_next_day) badges.push(badge("可能處置", "risk"));
  if (!badges.length) badges.push(badge("未標示", "ok"));
  return badges.join("");
};

const corporateActionBadge = (row) =>
  row.corporate_action
    ? badge(`公司行動：${text(row.corporate_action_detail, row.corporate_action_type)}`, "risk")
    : "";

const regimeBadge = (row) => {
  const regime = text(row.market_regime_0915);
  const type = regime === "STRONG" ? "ok" : regime === "WEAK" ? "risk" : "warn";
  return badge(`${regime} ${text(row.taiex_return_0915, "")}`.trim(), type);
};

const emptyRow = (columns, message) =>
  `<tr><td class="dashboard-empty" colspan="${columns}">${message}</td></tr>`;

const renderRows = (target, rows, columns, renderer, emptyMessage) => {
  if (!target) return;
  target.innerHTML = rows.length
    ? rows.map(renderer).join("")
    : emptyRow(columns, emptyMessage);
};

const renderDashboard = (data) => {
  dashboard.source.textContent = `${data.source || "P2.1"} · 有效資料日 ${data.effective_date}`;
  dashboard.tradeReady.textContent = data.trade_ready ? "YES" : "NO";
  dashboard.d0Count.textContent = data.health?.d0_candidate_count ?? data.d0_candidates.length;
  dashboard.d1Count.textContent = data.health?.d1_watch_count ?? data.d1_watch.length;
  dashboard.d2Count.textContent = data.health?.d2_watch_count ?? data.d2_watch.length;

  const partialDates = Object.entries(data.health?.partial_market_dates || {})
    .map(([date, markets]) => `${date}: ${markets.join("/")}`)
    .join("；");
  const limitations = data.health?.limitations || [];
  const d1Text = data.d1_watch_ready
    ? `本頁 ${data.health?.regime_0915_date || data.effective_date} 的 09:15 大盤僅套用 D1 觀察名單。`
    : "D1 觀察名單尚未取得同日 09:15 大盤。";
  const statusText = data.trade_ready
    ? `D0 已取得次一交易日 09:15 資料。${d1Text}`
    : `${limitations.join(" ")} ${d1Text}${partialDates ? ` Partial market：${partialDates}。` : ""}`;

  dashboard.warning.classList.toggle("is-ok", Boolean(data.trade_ready));
  dashboard.warning.innerHTML = `<strong>資料狀態：</strong><span>${statusText}</span>`;

  renderRows(
    dashboard.d0Table,
    data.d0_candidates || [],
    6,
    (row) => `
      <tr>
        <td>${stockLabel(row)}<br>${industryBadges(row)}</td>
        <td>${text(row.setup_type)}</td>
        <td>${text(row.close)}</td>
        <td>${text(row.volume_lots)}</td>
        <td>${riskBadges(row)}</td>
        <td>${text(row.next_step)}</td>
      </tr>
    `,
    "本資料日沒有 D0 盤後候選。",
  );

  renderRows(
    dashboard.d1Table,
    data.d1_watch || [],
    8,
    (row) => `
      <tr>
        <td>${stockLabel(row)}<br>${industryBadges(row)}</td>
        <td>${text(row.d0_date)}</td>
        <td>${text(row.d1_open_gap_pct)}</td>
        <td>${regimeBadge(row)}</td>
        <td>${corporateActionBadge(row) || (row.abnormal_gap_check ? badge("需檢查", "warn") : badge("否", "ok"))}</td>
        <td>${text(row.alert_reclaim_price)}</td>
        <td>${text(row.stop_loss_price)}</td>
        <td>${text(row.next_step)}</td>
      </tr>
    `,
    "本資料日沒有 D1 觀察名單。",
  );

  renderRows(
    dashboard.d2Table,
    data.d2_watch || [],
    7,
    (row) => `
      <tr>
        <td>${stockLabel(row)}<br>${industryBadges(row)}</td>
        <td>${text(row.d0_date)}</td>
        <td>${text(row.d1_date)}</td>
        <td>${text(row.alert_reclaim_price)}</td>
        <td>${text(row.invalidation_price)}</td>
        <td>${corporateActionBadge(row) || (row.status === "reclaimed" ? badge("已重返", "ok") : badge(text(row.status), "warn"))}</td>
        <td>${text(row.next_step)}</td>
      </tr>
    `,
    "本資料日沒有 D2+ 重返觀察。",
  );
};

const loadDashboardDate = async (date) => {
  dashboard.source.textContent = "載入中…";
  const response = await fetch(`data/daily/${date}.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`無法載入 ${date} dashboard data`);
  renderDashboard(await response.json());
};

const initDashboard = async () => {
  if (!dashboard.dateSelect) return;
  try {
    const response = await fetch("data/daily/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error("無法載入 dashboard 日期索引");
    const index = await response.json();
    const dates = index.available_dates || [];
    dashboard.dateSelect.innerHTML = dates
      .map((date) => `<option value="${date}">${date}</option>`)
      .join("");
    dashboard.dateSelect.value = index.latest || dates.at(-1);
    dashboard.dateSelect.addEventListener("change", (event) => {
      loadDashboardDate(event.target.value).catch(showDashboardError);
    });
    await loadDashboardDate(dashboard.dateSelect.value);
  } catch (error) {
    showDashboardError(error);
  }
};

const showDashboardError = (error) => {
  dashboard.source.textContent = "載入失敗";
  dashboard.warning.classList.remove("is-ok");
  dashboard.warning.innerHTML = `<strong>資料狀態：</strong><span>${error.message}</span>`;
  renderRows(dashboard.d0Table, [], 6, () => "", "Dashboard data 載入失敗。");
  renderRows(dashboard.d1Table, [], 8, () => "", "Dashboard data 載入失敗。");
  renderRows(dashboard.d2Table, [], 7, () => "", "Dashboard data 載入失敗。");
};

initDashboard();
