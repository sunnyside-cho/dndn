import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToText, newParagraphs, toParagraphs } from "../lib/text.mjs";
import { renderReport, triage, THRESHOLDS } from "../report.mjs";
import { buildAssumptions } from "../assumptions.mjs";
import { buildQuestions } from "../jev.mjs";

test("htmlToText: 태그·스크립트 제거, 블록 경계는 개행", () => {
  const t = htmlToText("<script>x()</script><p>선정기준액 2,470,000원</p><div>부부 3,952,000원</div>");
  assert.match(t, /선정기준액 2,470,000원\n부부 3,952,000원/);
});

test("newParagraphs: 신규 문단만 — 순서 변화는 무시", () => {
  const prev = ["가나다라마바사아자차카타파하 111111111111111111111111111", "동일문단 22222222222222222222222222222222222222"];
  const cur = [prev[1], prev[0], "새로 추가된 개정 문단입니다 3333333333333333333333333333"];
  const diff = newParagraphs(cur, prev);
  assert.equal(diff.length, 1);
  assert.match(diff[0], /새로 추가된/);
});

test("toParagraphs: 짧은 내비게이션 조각 제거", () => {
  assert.deepEqual(toParagraphs("홈\n로그인\n" + "충분히 긴 본문 문단입니다 ".repeat(4)), [
    ("충분히 긴 본문 문단입니다 ".repeat(4)).trim(),
  ]);
});

test("triage: 임계 밴딩 + 분류 실패는 unclassified (fail-closed)", () => {
  const mk = (max) => ({ affected: { a: max, b: 0.01 }, tool: { choice: "none", probabilities: {} }, relevant: 0.5 });
  assert.equal(triage(mk(THRESHOLDS.ALERT)).band, "alert");
  assert.equal(triage(mk(THRESHOLDS.REVIEW)).band, "review");
  assert.equal(triage(mk(0.01)).band, "low");
  assert.equal(triage(null).band, "unclassified");
});

test("renderReport: 낮음·미분류·수집실패까지 전 항목이 리포트에 실린다 (fail-closed 불변식)", () => {
  const items = [
    { source: "S1", paragraph: "저확률 문단", classification: { affected: { a: 0.01 }, tool: { choice: "none" } }, triage: triage({ affected: { a: 0.01 }, tool: { choice: "none" } }) },
    { source: "S2", paragraph: "분류 실패 문단", classification: null, triage: triage(null) },
  ];
  const md = renderReport({ date: "2026-09-22", items, fetchErrors: [{ source: "S3", error: "HTTP 500" }] });
  assert.match(md, /저확률 문단/);
  assert.match(md, /분류 실패 문단/);
  assert.match(md, /S3: HTTP 500/);
  assert.match(md, /실패는 통과가 아니다/);
});

test("assumptions: rules 값이 보간된다 (하드코딩 아님 — rules 교체 시 자동 갱신)", () => {
  const a = buildAssumptions();
  assert.match(a.bp_criteria, /2,470,000/);
  assert.match(a.bp_asset, /95%/);
  assert.match(a.dp_premium, /20,160/);
  assert.equal(Object.keys(a).length, 17);
});

test("buildQuestions: 가정별 Noul + relevant + tool Choice(none 포함)", () => {
  const q = buildQuestions(buildAssumptions());
  assert.equal(Object.keys(q).length, 17 + 2);
  assert.equal(q.relevant.type, "noul");
  assert.equal(q.tool.type, "choice");
  assert.ok("none" in q.tool.criteria);
  assert.equal(q.aff_bp_criteria.type, "noul");
});
