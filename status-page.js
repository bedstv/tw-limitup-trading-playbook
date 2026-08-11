import { escapeHtml, fetchJson } from "./ux-core.js";
import { setupSite } from "./site.js";

setupSite();
const content = document.querySelector("#status-content");
const errorBox = document.querySelector("#status-error");
const refresh = document.querySelector("#refresh-status");

const statusLabel = (value) => ({ ok: "正常", sent: "已送達", published: "已發布", trading: "交易日", closed: "休市", skipped: "已跳過", skipped_duplicate: "已送過，不重複" }[String(value || "").toLowerCase()] || "需要檢查");
const statusChip = (value) => `<span class="chip ${["ok", "sent", "published", "trading"].includes(String(value || "").toLowerCase()) ? "confirm" : "warn"}">${escapeHtml(statusLabel(value))}</span>`;
const timeLabel = (value) => value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(new Date(value)) : "未記錄";
const phaseCard = (title, phase) => {
  if (!phase) return `<article class="content-card"><h2>${title}</h2><p>尚未取得這個排程的健康資料。</p></article>`;
  const steps = Object.entries(phase.steps || {});
  return `<article class="content-card"><p class="eyebrow">${escapeHtml(phase.date || "日期未記錄")}</p><h2>${escapeHtml(title)} ${statusChip(phase.status)}</h2><p>預定：${escapeHtml(timeLabel(phase.scheduled_at))}<br>完成：${escapeHtml(timeLabel(phase.actual_finished_at))}<br>健康檢查：${escapeHtml(timeLabel(phase.checked_at))}</p><div class="status-list">${steps.map(([name, step]) => `<div class="status-row"><p><strong>${escapeHtml({ dashboard_data: "資料產生", regime_evidence: "09:15 證據", retry: "重試", freshness: "新鮮度", pages_git: "版本同步", public_dashboard: "公開頁面", telegram: "Telegram 通知" }[name] || name)}</strong><br>${escapeHtml(step.detail || "沒有補充說明")}</p>${statusChip(step.status)}</div>`).join("")}</div></article>`;
};

const render = ({ health, freshness, runtime }, failures) => {
  const d1 = health?.checks?.d1;
  const after = health?.checks?.afterhours;
  const stale = freshness?.is_stale;
  const runtimeOk = runtime?.status === "ok";
  content.innerHTML = `
    ${failures.length ? `<article class="content-card wide notice notice-danger"><strong>部分狀態資料讀取失敗：</strong>${escapeHtml(failures.join("、"))}。</article>` : ""}
    <article class="content-card wide"><p class="eyebrow">目前結論</p><h2>${stale ? "最新資料落後，請先不要依看板判斷。" : d1?.status === "ok" && after?.status === "ok" ? "09:15 與盤後排程最近一次皆正常。" : "有排程需要檢查，請閱讀下方失敗步驟。"}</h2><div class="metric-grid"><div class="metric"><strong>${escapeHtml(freshness?.latest_data_date || "—")}</strong><span>最新資料日</span></div><div class="metric"><strong>${escapeHtml(freshness?.expected_latest_data_date || "—")}</strong><span>應有資料日</span></div><div class="metric"><strong>${statusLabel(freshness?.market_day?.status)}</strong><span>市場日狀態</span></div><div class="metric"><strong>${stale ? "落後" : "正常"}</strong><span>新鮮度</span></div></div></article>
    ${phaseCard("09:15 判斷排程", d1)}
    ${phaseCard("盤後候選排程", after)}
    <article class="content-card"><h2>執行環境</h2><div class="status-list"><div class="status-row"><p><strong>執行前檢查</strong><br>${runtimeOk ? "資料程式與發布頁版本可使用" : "版本或執行環境需要檢查"}</p>${statusChip(runtime?.status)}</div><div class="status-row"><p><strong>檢查時間</strong><br>${escapeHtml(timeLabel(runtime?.checked_at))}</p></div><div class="status-row"><p><strong>目前階段</strong><br>${escapeHtml(runtime?.phase === "afterhours" ? "盤後" : runtime?.phase === "d1" ? "09:15" : "未記錄")}</p></div></div></article>
    <article class="content-card"><h2>資料來源優先順序</h2><ol><li>上市櫃官方公開資料：交易日、盤後行情、EPS、處置與警示。</li><li>Fugle：近期一分鐘行情與 09:15 完整 K 棒。</li><li>FinMind：授權可用時作歷史 K 棒與部分資料備援。</li><li>公開頁面只呈現已封存結果，不自行猜測缺值。</li></ol><p>Telegram 發送失敗與行情資料失敗會分開顯示；其中一項失敗不會被誤寫成另一項失敗。</p></article>
    <article class="content-card wide"><h2>何時算異常？</h2><div class="risk-row"><span class="chip warn">應有資料日大於最新資料日</span><span class="chip warn">排程狀態非正常</span><span class="chip warn">公開頁面未同步</span><span class="chip warn">Telegram 未送達</span><span class="chip warn">個股或風險來源缺漏</span></div><p>休市日正常跳過不算失敗；零候選也不等於載入失敗。</p></article>`;
  content.setAttribute("aria-busy", "false");
};

const load = async () => {
  refresh.disabled = true;
  errorBox.hidden = true;
  const sources = [["排程健康", "data/system-health.json", "health"], ["資料新鮮度", "data/market-freshness.json", "freshness"], ["執行環境", "data/runtime-readiness.json", "runtime"]];
  const results = await Promise.allSettled(sources.map(([, path]) => fetchJson(path)));
  const data = {}; const failures = [];
  results.forEach((result, index) => result.status === "fulfilled" ? data[sources[index][2]] = result.value : failures.push(sources[index][0]));
  if (!data.health && !data.freshness) { errorBox.hidden = false; errorBox.textContent = "系統狀態資料目前無法讀取。"; }
  render(data, failures);
  refresh.disabled = false;
};
refresh.addEventListener("click", load);
load();
