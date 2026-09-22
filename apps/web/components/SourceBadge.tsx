import type { RulesMeta } from "@contracts/shared-types";

// "기준일 YYYY-MM-DD · 출처 [기관명]" — 전 도구·글 하단 (design-guide 고정 컴포넌트).
// 출처 문자열은 데이터(rules _meta / guide 프론트매터)에서 와야 한다 — 호출부 수기 금지.
export function SourceBadge({ asOf, source }: { asOf: string; source: string }) {
  return (
    <p className="t-caption mt-6 mb-0 border-t border-[var(--divider)] pt-3">
      기준일 {asOf} · 출처 {source}
    </p>
  );
}

/** 도구 페이지용 — rules `_meta` 에서 자동 파생 (sourceLabel → source → law 순).
 *  두 rules 를 쓰는 도구는 asOf 로 더 최신 기준일을 넘길 수 있다. */
export function SourceBadgeFromMeta({ meta, asOf }: { meta: RulesMeta; asOf?: string }) {
  const source = meta.sourceLabel ?? meta.source ?? meta.law;
  if (!source) throw new Error("rules _meta 에 sourceLabel/source/law 가 없습니다 (출처 표기 불가)");
  return <SourceBadge asOf={asOf ?? meta.asOf} source={source} />;
}
