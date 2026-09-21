import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

// robots 정책 (BUILD_BRIEF·SEO_AEO_GEO): 검색·답변봇 + 학습봇 전부 허용 (분기별 재검토).
// 도메인 연결 전(indexable=false)에는 전체 차단.
export default function robots(): MetadataRoute.Robots {
  if (!SITE.indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE.baseUrl}/sitemap.xml`,
  };
}
