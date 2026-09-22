import Link from "next/link";
import { listGuides } from "@/lib/guide";
import { SITE, TOOLS } from "@/lib/site";
import { ACTIVE_YEAR } from "@/data/rules";

export default function HomePage() {
  const guides = listGuides().slice(0, 6);
  return (
    <>
      {/* 히어로 — 한 줄 정의 + 신뢰 포인트 */}
      <section className="py-14 sm:py-20">
        <p className="t-label m-0">{ACTIVE_YEAR}년 기준 반영</p>
        <h1 className="t-display mt-3 max-w-[720px]">
          은퇴 전후 돈 계산,
          <br />
          올해 기준으로 정확하게
        </h1>
        <p className="t-body-l mt-5 max-w-[640px]">
          기초연금·퇴직금 세금·건강보험 피부양자 — 헷갈리는 제도를 공식 기준으로 계산해
          드립니다. 가입도 로그인도 없고, 입력한 소득·재산은 서버로 전송되지 않습니다.
        </p>
      </section>

      {/* 도구 목록 */}
      <section aria-label="계산 도구" className="pb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.id}
              href={t.path}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6 no-underline transition-colors hover:border-[var(--border-strong)]"
            >
              <h2 className="t-h3 m-0">{t.name}</h2>
              <p className="t-body mt-2 mb-0">{t.short}</p>
              <span className="t-h4 mt-4 inline-block">계산해보기 →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 신뢰 밴드 */}
      <section className="mt-12 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)] p-6 sm:p-8">
        <h2 className="t-h3 mt-0">모든 숫자에 기준일과 출처를 답니다</h2>
        <p className="t-body-l mb-0 max-w-[720px]">
          법령·고시 원문 확인을 원칙으로 하고, 원문 대조가 끝나지 않은 값은 화면에 &ldquo;재확인
          중&rdquo;으로 표시합니다. 페이지마다 기준일을 표기하며, 제도가 바뀌면 기준 데이터를
          갱신합니다 — 12월~1월 개정 시즌에는 발표 즉시 반영합니다.
        </p>
      </section>

      {/* 최신 가이드 */}
      {guides.length > 0 ? (
        <section className="mt-12">
          <h2 className="t-h2">가이드</h2>
          <ul className="mt-4 list-none p-0">
            {guides.map((g) => (
              <li key={g.slug} className="border-b border-[var(--divider)]">
                <Link href={`/guide/${g.slug}/`} className="block py-4 no-underline">
                  <span className="t-h4">{g.title}</span>
                  <p className="t-body mt-1 mb-0">{g.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
