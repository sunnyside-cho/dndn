import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { getGuide, listGuides } from "@/lib/guide";
import { SITE, toolMeta } from "@/lib/site";

export function generateStaticParams() {
  return listGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return { title: g.title, description: g.description };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const tool = g.toolId ? toolMeta(g.toolId) : null;

  // Article + BreadcrumbList 스키마만 (SEO_AEO_GEO §4 — FAQ·HowTo 마크업 금지)
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.title,
      description: g.description,
      datePublished: g.date,
      dateModified: g.updated ?? g.date,
      author: { "@type": "Organization", name: SITE.name },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${SITE.baseUrl}/` },
        { "@type": "ListItem", position: 2, name: "가이드", item: `${SITE.baseUrl}/guide/` },
        { "@type": "ListItem", position: 3, name: g.title },
      ],
    },
  ];

  return (
    <article className="mx-auto max-w-[var(--container-narrow)] py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="t-h1">{g.title}</h1>
      <p className="t-caption mt-3">
        발행 {g.date}
        {g.updated ? ` · 최종수정 ${g.updated}` : ""}
      </p>

      {/* 도구 링크 상단 배치 (CONTENT_PLAN 작성 규칙) */}
      {tool ? (
        <Link href={tool.path} className="btn mt-4 w-full justify-between no-underline">
          <span>{tool.name} 해보기</span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      <div
        className="guide-body mt-8 [&_h2]:t-h2 [&_h2]:mt-10 [&_h3]:t-h3 [&_h3]:mt-8 [&_p]:t-body-l [&_li]:t-body-l [&_table]:table [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: g.html }}
      />

      {g.sources && g.sources.length > 0 ? (
        <section className="mt-10">
          <h2 className="t-h3">출처</h2>
          <ul className="t-body mt-2">
            {g.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener" target="_blank" className="underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Disclaimer />
    </article>
  );
}
