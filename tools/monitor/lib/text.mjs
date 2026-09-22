// HTML → 평문 → 문단 분해 (의존성 없음). 크롤 diff 의 최소 전처리만 한다.

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** 문단 분해 — 짧은 내비게이션 조각은 버린다 (분류 대상은 문장형 텍스트) */
export function toParagraphs(text, minLen = 40) {
  return text
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minLen);
}

/** 스냅샷 대비 신규 문단 (단순 집합 차 — 순서 변화에 둔감, fail-closed 방향으로 과탐지 허용) */
export function newParagraphs(current, previous) {
  const prev = new Set(previous);
  return current.filter((p) => !prev.has(p));
}
