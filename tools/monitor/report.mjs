// 임계값·집계·리포트 — 제어 흐름은 전부 코드가 소유한다 (Jev 는 확률만 공급).
//
// ★ fail-closed 불변식: 분류는 diff 에 걸린 문단의 **순서와 라벨만** 정한다. 어떤 문단도
//   분류 결과 때문에 리포트에서 빠지지 않으며, 분류 실패 문단은 "미분류(전건 확인)"로 실린다.
//   rules 갱신은 이 파이프라인이 절대 하지 않는다 — 사람이 원문 대조 후 수행 (W1 절대 규칙).

// 임계값은 2026-09-22 백테스트(24케이스, jev-1.13.0)로 튜닝 — 모델 버전 변경 시 재백테스트.
// 백테스트: 탐지 recall 100%(REVIEW=0.15), 음성 최고치 0.24 → ALERT=0.35(여유 0.11), 알림 오탐 0%.
export const THRESHOLDS = {
  /** max(affected) ≥ ALERT → 즉시 확인 섹션 (12~1월 daily 운용 시 알림 대상) */
  ALERT: 0.35,
  /** max(affected) ≥ REVIEW → 확인 권장 섹션 (이 밑이어도 다이제스트에는 실림 — fail-closed) */
  REVIEW: 0.15,
};

export function triage(classification) {
  if (!classification) return { band: "unclassified", top: null, max: null };
  const entries = Object.entries(classification.affected).sort((a, b) => b[1] - a[1]);
  const [topId, max] = entries[0];
  const band = max >= THRESHOLDS.ALERT ? "alert" : max >= THRESHOLDS.REVIEW ? "review" : "low";
  return { band, top: topId, max, top3: entries.slice(0, 3) };
}

export function renderReport({ date, items, fetchErrors }) {
  const bands = { alert: [], review: [], low: [], unclassified: [] };
  for (const it of items) bands[it.triage.band].push(it);

  const fmt = (it) => {
    const t = it.triage;
    const head =
      it.classification == null
        ? t.band === "unclassified"
          ? "미분류 — 전건 확인 필요"
          : "분류 생략"
        : `${t.top} ${(t.max * 100).toFixed(0)}%` +
          (it.classification.tool.choice !== "none" ? ` · 도구 ${it.classification.tool.choice}` : "");
    return `- **[${it.source}]** ${head}\n  > ${it.paragraph.slice(0, 300)}${it.paragraph.length > 300 ? "…" : ""}`;
  };

  const lines = [
    `# 제도 개정 모니터링 리포트 — ${date}`,
    "",
    "> W1 파이프라인 산출물. 분류는 우선순위 안내일 뿐이며, **rules 반영은 반드시 원문 대조 후",
    "> 사람이 수행**한다 (VERIFICATION.md 절차). 낮음 구간 포함 전 항목이 여기 실린다 (fail-closed).",
    "",
  ];
  if (fetchErrors.length) {
    lines.push("## ⚠ 수집 실패 (수동 확인 필요 — 실패는 통과가 아니다)", "");
    for (const e of fetchErrors) lines.push(`- ${e.source}: ${e.error}`);
    lines.push("");
  }
  const section = (title, arr) => {
    lines.push(`## ${title} (${arr.length}건)`, "");
    if (!arr.length) lines.push("- 없음", "");
    else lines.push(...arr.map(fmt), "");
  };
  section("🔴 즉시 확인", bands.alert);
  section("🟡 확인 권장", bands.review);
  section("⚠ 미분류 (분류기 실패 — 전건 확인)", bands.unclassified);
  section("⚪ 낮음 (다이제스트)", bands.low);
  return lines.join("\n");
}
