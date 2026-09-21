// "기준일 YYYY-MM-DD · 출처 [기관명]" — rules _meta 에서 자동 (수기 금지, design-guide)
export function SourceBadge({ asOf, source }: { asOf: string; source: string }) {
  return (
    <p className="t-caption mt-6 mb-0 border-t border-[var(--divider)] pt-3">
      기준일 {asOf} · 출처 {source}
    </p>
  );
}
