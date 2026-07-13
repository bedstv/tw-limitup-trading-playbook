import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildHistoryByStock, csvForRows, filterAndSortRows, markdownForRows } from "../dashboard-core.js";

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
assert.match(await readFile(new URL("../index.html", import.meta.url), "utf8"), /看板欄位怎麼看/, "dashboard must include a glossary");
console.log(`dashboard_smoke=PASS dates=${documents.length} tracked_stocks=${history.size}`);
