// 금액 표기 유틸 — 5060 대상: "349,700원", "1억 2,000만원" 두 급을 혼용한다.

/** 1234567 → "1,234,567원" */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 123456789 → "1억 2,345만원" (만원 미만 절사) — 입력 안내·큰 금액 표시용 */
export function wonKorean(n: number): string {
  const v = Math.round(n);
  if (v === 0) return "0원";
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만원`);
  if (parts.length === 0) return won(v);
  if (eok > 0 && man === 0) parts[parts.length - 1] += "원";
  return parts.join(" ");
}

/** 월 금액 차이 표기: +3,500원 / −1,200원 */
export function wonDiff(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("ko-KR")}원`;
}
