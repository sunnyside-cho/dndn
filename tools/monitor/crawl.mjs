import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToText, newParagraphs, toParagraphs } from "./lib/text.mjs";
import { SOURCES } from "./sources.mjs";

const SNAP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "snapshots");

// 수집 + 스냅샷 diff. 실패는 던지지 않고 fetchErrors 로 모아 리포트에 노출한다 (fail-closed).
export async function crawl({ updateSnapshots = true } = {}) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const changed = [];
  const fetchErrors = [];

  for (const src of SOURCES) {
    const snapPath = path.join(SNAP_DIR, `${src.id}.txt`);
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "dndn-monitor/1.0 (+rule-change watch)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = htmlToText(await res.text());
      const paras = toParagraphs(text);
      if (paras.length === 0) throw new Error("본문 추출 0건 (렌더 방식 변경 의심)");

      const prev = fs.existsSync(snapPath)
        ? toParagraphs(fs.readFileSync(snapPath, "utf-8"))
        : null;

      if (prev === null) {
        // 최초 수집 — 기준 스냅샷만 만들고 diff 는 다음 회차부터
        changed.push({ source: src.name, sourceId: src.id, paragraph: `[최초 스냅샷 생성 — 문단 ${paras.length}건 기준선 확보]`, initial: true });
      } else {
        for (const p of newParagraphs(paras, prev)) {
          changed.push({ source: src.name, sourceId: src.id, paragraph: p });
        }
      }
      if (updateSnapshots) fs.writeFileSync(snapPath, paras.join("\n"), "utf-8");
    } catch (e) {
      fetchErrors.push({ source: src.name, error: String(e.message ?? e).slice(0, 200) });
    }
  }
  return { changed, fetchErrors };
}
