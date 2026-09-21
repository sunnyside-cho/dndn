import Link from "next/link";
import { TOOLS } from "@/lib/site";

// GNB — 1뎁스 고정 (F-06). 모바일은 가로 스크롤 노출형(햄버거 없음 — 시니어 UX).
export function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-[var(--container)] px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="t-h3 no-underline text-[var(--text-primary)]">
            든든노후
          </Link>
          <span className="t-caption hidden sm:block">은퇴 전후 돈 계산, 올해 기준으로</span>
        </div>
        <nav aria-label="주 메뉴" className="-mx-6 overflow-x-auto px-6">
          <ul className="flex list-none gap-1 whitespace-nowrap p-0 m-0">
            {TOOLS.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.path}
                  className="inline-flex min-h-12 items-center rounded-t-lg px-4 text-[17px] font-medium text-[var(--text-secondary)] no-underline hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                >
                  {t.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/guide/"
                className="inline-flex min-h-12 items-center rounded-t-lg px-4 text-[17px] font-medium text-[var(--text-secondary)] no-underline hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              >
                가이드
              </Link>
            </li>
            <li>
              <Link
                href="/about/"
                className="inline-flex min-h-12 items-center rounded-t-lg px-4 text-[17px] font-medium text-[var(--text-secondary)] no-underline hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              >
                소개
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
