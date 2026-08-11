import { escapeHtml, fetchJson, formatPercent } from "./ux-core.js";
import { setupSite } from "./site.js";

setupSite();
const content = document.querySelector("#validation-content");
const errorBox = document.querySelector("#validation-error");

const number = (value, digits = 2) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(digits);
const metric = (label, value) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
const progress = (current, target) => `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(current, target)}"><span style="width:${Math.min(100, current / target * 100)}%"></span></div><p>${current} / ${target} 個判斷日</p>`;
const strategyCard = (version, strategy) => {
  const stress = strategy.stress || {};
  const shadow = version !== "p2.11_v2";
  const historical = strategy.historical_daily_proxy?.stress_cost;
  const conclusion = !stress.settled_count ? "尚無已結算進場，不能判斷績效。" : Number(stress.average_net_return) > 0 && Number(stress.profit_factor) >= 1.2 ? "壓力成本後暫為正，但仍須通過樣本與回撤門檻。" : "壓力成本後未達升級門檻，目前不能證明有效。";
  return `<article class="content-card"><p class="eyebrow">${shadow ? "影子挑戰組｜不發買進通知" : "固定基準"}</p><h2>${escapeHtml(strategy.label || version)}</h2><p><strong>${escapeHtml(conclusion)}</strong></p><div class="metric-grid">${metric("候選", String(stress.candidate_count || 0))}${metric("已確認進場", String(stress.confirmed_entry_count || 0))}${metric("已結算", String(stress.settled_count || 0))}${metric("資料不足", String(stress.data_incomplete_count || 0))}${metric("30 bps 平均淨報酬", formatPercent(stress.average_net_return))}${metric("中位數淨報酬", formatPercent(stress.median_net_return))}${metric("勝率", formatPercent(stress.win_rate))}${metric("獲利因子", number(stress.profit_factor))}</div>${strategy.gate ? `<p><strong>升級狀態：</strong>${escapeHtml(strategy.gate.message || "持續收集樣本。")}</p>` : ""}${historical ? `<details><summary>查看 D2+ 日線研究代理</summary><p>${historical.signal_count || 0} 個訊號、${historical.settled_count || 0} 筆已結算；30 bps 平均 ${formatPercent(historical.average_net_return)}、獲利因子 ${number(historical.profit_factor)}。這只是研究假設，不是分鐘線正式證據。</p></details>` : ""}</article>`;
};

const render = ({ evaluation, shadow, coverage, backtest, paper }, failures) => {
  const overall = evaluation?.overall || {};
  const forwardNegative = Number(overall.avg_net_return) < 0;
  const conclusion = forwardNegative
    ? `目前不能說策略已證明可賺錢。09:15 固定基準已結算 ${overall.settled_count || 0} 筆，平均淨報酬為 ${formatPercent(overall.avg_net_return)}，仍是負值。`
    : `目前樣本仍不足。09:15 固定基準已結算 ${overall.settled_count || 0} 筆，平均淨報酬為 ${formatPercent(overall.avg_net_return)}，尚未達正式審查日數。`;
  const dayCount = evaluation?.decision_day_count || paper?.decision_day_count || 0;
  const middleTarget = evaluation?.minimum_decision_days || 20;
  const formalTarget = evaluation?.formal_review?.formal_review_decision_days || 60;
  const daily = backtest?.walk_forward?.baseline || {};
  content.innerHTML = `
    ${failures.length ? `<article class="content-card wide notice notice-danger"><strong>部分資料讀取失敗：</strong>${escapeHtml(failures.join("、"))}。其他區塊仍可閱讀。</article>` : ""}
    <article class="content-card wide"><p class="eyebrow">先看結論</p><h2>${escapeHtml(conclusion)}</h2><p>目前應繼續紙上驗證，不應因少量交易或單筆大賺就改成實際下單策略。</p></article>
    <article class="content-card"><h2>09:15 固定規則樣本進度</h2>${progress(dayCount, formalTarget)}<p>第 ${middleTarget} 日只做中期人工檢查；第 ${formalTarget} 日才可進入正式評估。尚有 ${Math.max(0, formalTarget - dayCount)} 個判斷日。</p><div class="metric-grid">${metric("候選", String(overall.candidate_count || 0))}${metric("已結算", String(overall.settled_count || 0))}${metric("平均淨報酬", formatPercent(overall.avg_net_return))}${metric("勝率", formatPercent(overall.win_rate))}${metric("停損率", formatPercent(overall.stop_loss_rate))}${metric("最大回撤", formatPercent(overall.max_drawdown_equal_weight))}</div></article>
    <article class="content-card"><h2>分鐘線覆蓋</h2>${progress(coverage?.available_decision_days || 0, coverage?.minimum_decision_days || 60)}<p>${escapeHtml(coverage?.reason || "分鐘線資料仍在收集中。")}</p><div class="metric-grid">${metric("完整判斷日", String(coverage?.available_decision_days || 0))}${metric("候選紀錄", String(coverage?.candidate_count || 0))}${metric("資料不足", String(coverage?.data_incomplete_count || 0))}</div></article>
    <article class="content-card wide"><p class="eyebrow">不同證據，不可混算</p><h2>日線歷史回測 vs. 09:15 分鐘線驗證</h2><div class="metric-grid">${metric("日線驗證期訊號", String(daily.signal_count || 0))}${metric("日線已執行", String(daily.executed_count || 0))}${metric("日線平均淨報酬", formatPercent(daily.avg_net_return))}${metric("日線中位數", formatPercent(daily.median_net_return))}</div><p>日線回測涵蓋 2022–2026 驗證期，但無法確認盤中先觸發或先停損；09:15 紙上交易才是目前主線的前瞻證據，因此不能把兩者合併成一個報酬數字。</p></article>
    <article class="content-card wide"><p class="eyebrow">基準與挑戰組</p><h2>同一成本口徑比較</h2><p>以下一律顯示單邊 30 bps 壓力成本。影子策略只做模擬，不發出實際買進通知，也不會自動取代固定基準。</p></article>
    ${Object.entries(shadow?.strategies || {}).map(([version, strategy]) => strategyCard(version, strategy)).join("") || `<article class="content-card"><h2>尚無挑戰組資料</h2><p>不影響固定基準的每日候選。</p></article>`}
    <article class="content-card wide"><h2>正式升級需要什麼？</h2><ul><li>D1：至少 60 個判斷日、30 筆已結算進場，30 bps 成本後平均為正，獲利因子至少 1.2。</li><li>D1：最大回撤至少比基準低 20%，停損率不得高於基準，單筆交易不得貢獻超過總獲利 25%。</li><li>D2：歷史滾動測試至少 30 筆，另有至少 20 筆 forward 影子交易，壓力成本後仍為正。</li><li>達門檻只通知人工審查，不會自動升級或下單。</li></ul></article>`;
  content.setAttribute("aria-busy", "false");
};

const init = async () => {
  const sources = [
    ["固定規則", "data/strategy-evaluation.json", "evaluation"], ["影子策略", "data/p230-shadow-evaluation.json", "shadow"],
    ["分鐘線覆蓋", "data/intraday-backtest-coverage.json", "coverage"], ["日線回測", "data/backtest-summary.json", "backtest"], ["紙上交易", "data/paper-evaluation.json", "paper"],
  ];
  const results = await Promise.allSettled(sources.map(([, path]) => fetchJson(path)));
  const data = {};
  const failures = [];
  results.forEach((result, index) => result.status === "fulfilled" ? data[sources[index][2]] = result.value : failures.push(sources[index][0]));
  if (!data.evaluation && !data.shadow && !data.backtest) {
    errorBox.hidden = false; errorBox.textContent = "策略驗證資料目前全部無法讀取，請稍後重新整理。";
  }
  render(data, failures);
};

init();
