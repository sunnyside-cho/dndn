import type { Metadata } from "next";
import Link from "next/link";
import { listGuides } from "@/lib/guide";

export const metadata: Metadata = {
  title: "가이드",
  description: "기초연금·퇴직금 세금·건보 피부양자 — 은퇴 전후 돈 문제 해설 글 모음",
};

export default function GuideListPage() {
  const guides = listGuides();
  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-12">
      <h1 className="t-h1">가이드</h1>
      {guides.length === 0 ? (
        <p className="t-body-l mt-6">
          해설 글을 준비하고 있습니다. 먼저 계산 도구를 이용해 보세요.
        </p>
      ) : (
        <ul className="mt-6 list-none p-0">
          {guides.map((g) => (
            <li key={g.slug} className="border-b border-[var(--divider)]">
              <Link href={`/guide/${g.slug}/`} className="block py-5 no-underline">
                <h2 className="t-h3 m-0">{g.title}</h2>
                <p className="t-body mt-2 mb-0">{g.description}</p>
                <p className="t-caption mt-2 mb-0">{g.updated ?? g.date}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
