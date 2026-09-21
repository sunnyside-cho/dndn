// Prisma 7 CLI 설정 — v7 부터 CLI 가 .env 를 자동 로드하지 않고, datasource url 도
// schema.prisma 가 아닌 이 파일이 정본이다.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Supabase: 마이그레이션은 트랜잭션 풀러(6543)로 불가 — CLI 는 DIRECT_URL(5432) 우선,
    // 없으면 DATABASE_URL. 1단계(DB 휴면)에서는 둘 다 없어도 generate 가 돌아야 하므로
    // 마지막으로 더미 URL 폴백 (연결은 하지 않음 — migrate 시점엔 실제 env 필수).
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    // v7 은 마이그레이션 재생(migrate diff --from-migrations 등)에 shadow DB 가 필수.
    // CI 드리프트 게이트가 서비스 컨테이너를 이 변수로 주입한다 — 미설정이면 생략.
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
