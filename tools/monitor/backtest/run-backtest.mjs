import { buildAssumptions } from "../assumptions.mjs";
import { classifyParagraph } from "../jev.mjs";
import { THRESHOLDS, triage } from "../report.mjs";
import { DATASET } from "./dataset.mjs";

// Jev 한국어 법령 텍스트 백테스트 — 채택 판정 기준:
//   ① 탐지 recall(양성이 REVIEW 이상에 걸림) ≈ 100% 이어야 함 (놓침 = 제품 훼손)
//   ② ALERT 임계의 hard-음성 오탐률이 낮을수록 좋음 (오탐 = 사람이 문단 하나 읽는 비용)
//   ③ top-1 가정 적중은 참고 지표 (라우팅 편의일 뿐 판정엔 비필수)
const assumptions = buildAssumptions();

let inputTokens = 0;
const rows = [];
for (const item of DATASET) {
  const c = await classifyParagraph(item.text, assumptions);
  inputTokens += c.usage?.input_tokens ?? 0;
  const t = triage(c);
  const isPositive = item.labels.length > 0;
  const detected = t.max >= THRESHOLDS.REVIEW;
  const alerted = t.max >= THRESHOLDS.ALERT;
  const topHit = isPositive ? item.labels.includes(t.top) : null;
  rows.push({
    id: item.id, positive: isPositive, hard: !!item.hard,
    max: t.max, top: t.top, topHit, detected, alerted,
    relevant: c.relevant, tool: c.tool.choice,
    labels: item.labels.join(","),
  });
  console.log(
    `${item.id} ${isPositive ? "양성" : item.hard ? "음성(hard)" : "음성"}  max=${t.max.toFixed(2)} top=${t.top}${topHit === false ? " (라벨=" + item.labels + ")" : ""}  relevant=${c.relevant.toFixed(2)} tool=${c.tool.choice}  → ${alerted ? "ALERT" : detected ? "REVIEW" : "low"}`,
  );
}

const pos = rows.filter((r) => r.positive);
const neg = rows.filter((r) => !r.positive);
const hardNeg = neg.filter((r) => r.hard);
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) + "%" : "-");

console.log("\n===== 백테스트 요약 =====");
console.log(`탐지 recall (양성 max ≥ ${THRESHOLDS.REVIEW}):      ${pct(pos.filter((r) => r.detected).length, pos.length)} (${pos.filter((r) => r.detected).length}/${pos.length})`);
console.log(`ALERT recall (양성 max ≥ ${THRESHOLDS.ALERT}):      ${pct(pos.filter((r) => r.alerted).length, pos.length)} (${pos.filter((r) => r.alerted).length}/${pos.length})`);
console.log(`top-1 가정 적중 (양성):                ${pct(pos.filter((r) => r.topHit).length, pos.length)}`);
console.log(`음성 ALERT 오탐:                       ${pct(neg.filter((r) => r.alerted).length, neg.length)} (${neg.filter((r) => r.alerted).length}/${neg.length})`);
console.log(`음성 REVIEW 이상 (다이제스트 소음):     ${pct(neg.filter((r) => r.detected).length, neg.length)} (${neg.filter((r) => r.detected).length}/${neg.length})`);
console.log(`  └ hard 음성만:                       ALERT ${pct(hardNeg.filter((r) => r.alerted).length, hardNeg.length)} · REVIEW+ ${pct(hardNeg.filter((r) => r.detected).length, hardNeg.length)}`);
console.log(`입력 토큰 합계: ${inputTokens.toLocaleString()} (≈ $${((inputTokens / 1e6) * 0.042).toFixed(4)})`);

const missed = pos.filter((r) => !r.detected);
if (missed.length) {
  console.log(`\n⚠ 놓친 양성: ${missed.map((r) => r.id).join(", ")} — 채택 보류 기준에 해당`);
  process.exitCode = 1;
}
