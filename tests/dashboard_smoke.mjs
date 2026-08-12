import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildHistoryByStock, csvForRows, filterAndSortRows, industrySummary, markdownForRows, paperProgress, paperRecords } from "../dashboard-core.js";
import { buildDecisionLanes, candidateView, reasonLabel, riskGeometry } from "../ux-core.js";

const index = JSON.parse(await readFile(new URL("../data/daily/index.json", import.meta.url)));
const documents = await Promise.all(index.available_dates.map(async (date) => JSON.parse(await readFile(new URL(`../data/daily/${date}.json`, import.meta.url)))));
assert.ok(documents.length > 0, "dashboard must include at least one daily artifact");
documents.forEach((data) => {
  assert.ok(data.as_of_date, "daily artifact must include as_of_date");
  ["d0_candidates", "d1_watch", "d2_watch"].forEach((key) => assert.ok(Array.isArray(data[key]), `${key} must be an array`));
});
const allRows = documents.flatMap((data) => data.d0_candidates);
const filtered = filterAndSortRows(allRows, { setup: "all", liquidity: "all", risk: "all", decision: "all", sort: "volume" });
assert.equal(filtered.length, allRows.length, "default filters must retain all D0 rows");
const history = buildHistoryByStock(documents);
assert.ok(history.size > 0, "history must include tracked stocks");
assert.match(csvForRows(filtered), /stock_id/, "CSV export must have headers");
assert.match(markdownForRows(filtered, index.latest), /台股候選匯出/, "Markdown export must have a title");
const marketPage = await readFile(new URL("../market.html", import.meta.url), "utf8");
assert.match(marketPage, /data-page="market"/, "daily market must have an independent page");
assert.match(marketPage, /今天開盤後怎麼做/, "daily market must show the D1 decision lane in plain language");
assert.match(marketPage, /下一交易日先看這些/, "daily market must keep D0 preparation separate in plain language");
assert.match(marketPage, /之後幾天等反彈/, "daily market must show a plain-language D2 lane");
assert.doesNotMatch(marketPage, /D0 次日可交易/, "daily market must not use a misleading YES or NO trade-ready tile");
assert.match(marketPage, /複製此畫面連結/, "daily market must offer a shareable filtered view");
assert.match(marketPage, /板塊共識/, "daily market must show industry consensus");
const marketScript = await readFile(new URL("../market-page.js", import.meta.url), "utf8");
assert.match(marketScript, /這不是「零候選」/, "daily market must distinguish loading failures from an empty candidate set");
assert.match(marketScript, /歷史模式不代表現在仍可交易/, "historical dates must not be presented as current advice");
assert.match(marketScript, /Promise\.allSettled/, "secondary health data and history must tolerate partial failures");
const sourceMissing = filterAndSortRows(
  [{ stock_id: "9999", risk_data_status: "OFFICIAL_SOURCE_MISSING" }],
  { setup: "all", liquidity: "all", risk: "flagged", decision: "all", sort: "risk" },
);
assert.equal(sourceMissing.length, 1, "official source gaps must be treated as a visible risk flag");
const uxCss = await readFile(new URL("../ux.css", import.meta.url), "utf8");
assert.match(uxCss, /\.mobile-nav/, "mobile users must retain the primary navigation");
assert.match(uxCss, /min-height: 44px/, "interactive controls must meet the minimum touch target");
const progress = paperProgress([{ paper_trading: { rule_version: "p2.11_v2", candidate_count: 1, watch_count: 1, executed_count: 0 }, paper_trading_records: [{ rule_version: "p2.11_v2", net_return: "0.012" }] }]);
assert.equal(progress.remaining_days, 19, "paper progress must count D1 decision days");
assert.equal(progress.settled_count, 1, "paper progress must count settled records");
assert.equal(progress.net_return_sum, 0.012, "paper progress must aggregate net returns");
const records = paperRecords([{ as_of_date: "2026-07-14", paper_trading_records: [{ rule_version: "p2.11_v1", stock_id: "1111" }, { rule_version: "p2.11_v2", stock_id: "2222", status: "not_traded" }] }]);
assert.equal(records.length, 1, "paper evidence must only show the fixed V2 rule");
assert.equal(records[0].decision_date, "2026-07-14", "paper evidence must retain a display date");
const industries = industrySummary([{ stock_id: "1111", industry: "半導體業" }, { stock_id: "2222", industry: "半導體業" }, { stock_id: "3333", industry: "電子零組件業" }]);
assert.equal(industries[0].count, 2, "industry consensus must group candidates by industry");
assert.match(await readFile(new URL("../validation.html", import.meta.url), "utf8"), /目前有證據顯示能賺錢嗎/, "validation must be a separate plain-language page");
assert.match(await readFile(new URL("../status.html", import.meta.url), "utf8"), /資料有沒有準時到/, "system health must be a separate page");
assert.match(await readFile(new URL("../rules.html", import.meta.url), "utf8"), /固定基準的一票否決條件/, "strategy rules must explain baseline blocking conditions");
assert.match(marketPage, /今天該做什麼/, "daily market must include a concise action summary");
assert.match(marketScript, /為什麼列入？資料完整嗎？/, "daily market must show per-stock data sources in plain language");
assert.match(marketScript, /現在怎麼做/, "every stock card must lead with an actionable plain-language instruction");
assert.match(await readFile(new URL("../ux-core.js", import.meta.url), "utf8"), /公司行動改變了價格基準/, "daily market must translate corporate-action exclusions");
const setupAResearch = JSON.parse(await readFile(new URL("../data/setup-a-research.json", import.meta.url)));
assert.equal(setupAResearch.production_impact, "none", "A setup research must not affect production selection");
assert.equal(setupAResearch.walk_forward.minimum_validation_trades, 10, "A setup research must keep the ten-trade promotion gate");
const validationScript = await readFile(new URL("../validation-page.js", import.meta.url), "utf8");
assert.match(validationScript, /不能說策略已證明可賺錢/, "validation conclusion must be plain and evidence-led");
assert.match(validationScript, /影子挑戰組｜不發買進通知/, "shadow strategy status must be explicit");
assert.match(validationScript, /日線歷史回測 vs\. 09:15 分鐘線驗證/, "daily and minute evidence must remain separate");

const invalidGeometry = riskGeometry({ paper_entry_trigger_price: 11.45, stop_loss_price: 11.7 });
assert.equal(invalidGeometry.valid, false, "stop at or above trigger must be blocked by the UX safety model");
assert.equal(invalidGeometry.reasonCode, "STOP_NOT_BELOW_TRIGGER", "invalid stop geometry must have a stable reason code");
const baselineWideStop = riskGeometry({ paper_trade_rule_version: "p2.11_v2", paper_entry_trigger_price: 112, stop_loss_price: 105 });
assert.equal(baselineWideStop.valid, true, "the fixed baseline must not inherit the shadow strategy five-percent gate");
assert.ok(baselineWideStop.distance > 0.05, "baseline risk distance remains visible even when it is not a display blocker");
const shadowWideStop = riskGeometry({ paper_trade_rule_version: "p2.30_d1_confirmed_v1", paper_entry_trigger_price: 112, stop_loss_price: 105 });
assert.equal(shadowWideStop.reasonCode, "RISK_OVER_5", "the shadow strategy must retain its five-percent gate");
const blockedCandidate = candidateView({ d1_decision_status: "WATCH", d1_decision_ready: true, paper_entry_trigger_price: 143.5, stop_loss_price: 147.5 }, "d1", { formationDate: "2026-08-10", decisionDate: "2026-08-11" });
assert.equal(blockedCandidate.action, "停損價不合理，今天不考慮", "unsafe WATCH rows must explain the stop contradiction instead of using a generic label");
assert.match(blockedCandidate.instruction, /今天不要考慮這檔/, "a blocked row must provide a full plain-language instruction");
const lanes = buildDecisionLanes({
  selected: { effective_date: "2026-08-11", d0_candidates: [{ stock_id: "6446" }], d2_watch: [] },
  previous: { effective_date: "2026-08-10", d0_decision_date: "2026-08-11", d0_candidates: [{ stock_id: "3022", d1_decision_status: "WATCH" }] },
  selectedDate: "2026-08-11",
  nextTradingDate: "2026-08-12",
});
assert.equal(lanes.d1.rows[0].formationDate, "2026-08-11", "the current D1 lane must use the latest after-hours candidate, not yesterday's completed decision");
assert.equal(lanes.d1.rows[0].decisionDate, "2026-08-12", "a pending latest candidate must show the next trading-day decision date");
assert.equal(lanes.d1.rows[0].action, "還沒到 09:15，先不要買", "a pre-open candidate must be shown as pending rather than invalid");
assert.match(lanes.d1.rows[0].instruction, /2026-08-12 09:15/, "a pending candidate must name the exact decision time");
assert.equal(lanes.d0.rows[0].decisionDate, "2026-08-12", "D0 lane must show the next decision date");
const completedLanes = buildDecisionLanes({ selected: { effective_date: "2026-08-11", d0_decision_date: "2026-08-12", d0_decision_ready: true, d0_candidates: [{ stock_id: "6446", d1_decision_status: "WATCH", d1_decision_ready: true, paper_entry_trigger_price: 1510, stop_loss_price: 1330 }] }, selectedDate: "2026-08-11", nextTradingDate: "2026-08-12" });
assert.equal(completedLanes.d1.rows[0].action, "先不要買，等待價格確認", "the completed D1 result must state the action in plain language");
assert.doesNotMatch(completedLanes.d1.rows[0].action, /保留監看|尚未觸發/, "the main action must not expose system jargon");
assert.match(completedLanes.d1.rows[0].instruction, /1,510 元.*1,330 元/, "a WATCH row must explain the price to wait for and the stop in one sentence");
const noPrevious = buildDecisionLanes({ selected: { d0_candidates: [], d2_watch: [] }, previous: null, selectedDate: "2026-08-11", nextTradingDate: "2026-08-12" });
assert.equal(noPrevious.d1.rows.length, 0, "a missing prior document must be an empty D1 lane, never a fabricated decision");
assert.equal(candidateView({ d1_decision_status: "WATCH", d1_decision_ready: false }, "d1").state, "blocked", "missing 09:15 quote evidence must block the row");
assert.equal(candidateView({ d1_decision_status: "WATCH", risk_data_status: "OFFICIAL_SOURCE_MISSING", risk_flags_trade_ready: false }, "d1").state, "blocked", "missing official risk evidence must block the row");
assert.equal(candidateView({ d1_decision_status: "WATCH", possible_disposition_next_day: true }, "d1").state, "blocked", "possible next-day disposition must block the row");
assert.equal(candidateView({ d1_decision_status: "WATCH", corporate_action: true }, "d1").state, "blocked", "corporate actions must block an ordinary price-basis decision");
assert.equal(candidateView({ status: "invalidated" }, "d2").state, "blocked", "an invalidated D2 row must not remain actionable");
assert.doesNotMatch(reasonLabel({ next_step: "No D2 reclaim setup; monitor only if relative strength confirmed" }), /No D2|reclaim|monitor/i, "known next-step text must render in Chinese");
console.log(`dashboard_smoke=PASS dates=${documents.length} tracked_stocks=${history.size}`);
