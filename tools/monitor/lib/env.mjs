import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 의존성 없는 .env 로더 — apps/web/.env 와 리포 루트 .env 를 읽는다 (값은 로그 금지).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function parseEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = {
  ...parseEnvFile(path.join(ROOT, ".env")),
  ...parseEnvFile(path.join(ROOT, "apps/web/.env")),
};

export function env(name) {
  return process.env[name] ?? fileEnv[name];
}

/** Jev(TypeSafe) API 키 — 표준명 우선, 사용자 .env 의 오타 변형(JEV_API_LEY)도 허용 */
export function jevApiKey() {
  return env("TYPESAFE_API_KEY") ?? env("JEV_API_KEY") ?? env("JEV_API_LEY") ?? null;
}

export { ROOT };
