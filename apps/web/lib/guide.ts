import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { GuideFrontmatter } from "@contracts/shared-types";

// 해설 글(W2) — content/guide/*.md, 프론트매터는 GuideFrontmatter (typed SSOT).
// draft:true 는 빌드에서 제외한다 (무검수 자동 발행 금지 — 도메인 규칙 16).
const GUIDE_DIR = path.join(process.cwd(), "content", "guide");

export interface Guide extends GuideFrontmatter {
  /** 렌더된 본문 HTML (서버 전용) */
  html: string;
}

function readGuideFile(file: string): Guide {
  const raw = fs.readFileSync(path.join(GUIDE_DIR, file), "utf-8");
  const { data, content } = matter(raw);
  const fm = data as GuideFrontmatter;
  return { ...fm, html: marked.parse(content, { async: false }) };
}

export function listGuides(): Guide[] {
  if (!fs.existsSync(GUIDE_DIR)) return [];
  return fs
    .readdirSync(GUIDE_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(readGuideFile)
    .filter((g) => !g.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getGuide(slug: string): Guide | null {
  return listGuides().find((g) => g.slug === slug) ?? null;
}
