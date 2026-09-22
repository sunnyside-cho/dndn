import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssumptions } from "./assumptions.mjs";
import { crawl } from "./crawl.mjs";
import { classifyParagraph } from "./jev.mjs";
import { renderReport, triage } from "./report.mjs";
import { jevApiKey } from "./lib/env.mjs";

// W1 모니터 실행: 수집 → (가능하면) 분류 → 리포트. rules 는 절대 건드리지 않는다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const date = new Date().toISOString().slice(0, 10);

const { changed, fetchErrors } = await crawl();
const assumptions = buildAssumptions();

const items = [];
for (const item of changed) {
  if (item.initial) {
    items.push({ ...item, classification: null, triage: { band: "low", top: null, max: null } });
    continue;
  }
  let classification = null;
  if (jevApiKey()) {
    try {
      classification = await classifyParagraph(item.paragraph, assumptions);
    } catch (e) {
      console.error(`분류 실패 (${item.sourceId}): ${e.message}`); // 실패 → 미분류로 리포트에 노출
    }
  }
  items.push({ ...item, classification, triage: triage(classification) });
}

const report = renderReport({ date, items, fetchErrors });
const outDir = path.join(HERE, "reports");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${date}.md`);
fs.writeFileSync(outPath, report, "utf-8");
console.log(report);
console.log(`\n[monitor] 변경 ${changed.length}건 · 수집실패 ${fetchErrors.length}건 → ${outPath}`);

// 즉시 확인 항목이 있으면 종료코드 2 (CI 에서 알림 트리거로 사용)
if (items.some((i) => i.triage.band === "alert" || i.triage.band === "unclassified")) process.exitCode = 2;
