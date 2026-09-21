// Prisma 7 은 드라이버 어댑터가 필수 — PostgreSQL(Supabase) 은 @prisma/adapter-pg.
// Vercel 서버리스에서는 Supabase Transaction pooler(6543, pgbouncer) URL 을 DATABASE_URL 로 쓴다.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
  });

// dev 핫리로드마다 새 커넥션 풀이 생기지 않도록 globalThis 에 싱글턴을 유지한다.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
