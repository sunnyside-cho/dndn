import type { MetadataRoute } from "next";
import { listGuides } from "@/lib/guide";
import { SITE, TOOLS } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE.baseUrl}/`, lastModified: now, priority: 1 },
    ...TOOLS.map((t) => ({ url: `${SITE.baseUrl}${t.path}`, lastModified: now, priority: 0.9 })),
    { url: `${SITE.baseUrl}/guide/`, lastModified: now, priority: 0.6 },
    { url: `${SITE.baseUrl}/about/`, lastModified: now, priority: 0.3 },
  ];
  for (const g of listGuides()) {
    pages.push({
      url: `${SITE.baseUrl}/guide/${g.slug}/`,
      lastModified: new Date(g.updated ?? g.date),
      priority: 0.7,
    });
  }
  return pages;
}
