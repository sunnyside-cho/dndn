import type {
  IrpOption,
  SeveranceInput,
  SeveranceResult,
  SeveranceRules,
} from "@contracts/shared-types";

// F-02 퇴직소득세·IRP 절세 엔진 — TOOL_SPEC_severance-tax.md 산식을 rules 값으로 구현.
// 순수함수: 같은 (input, rules) → 같은 result. 제도 숫자 하드코딩 금지 (도메인 규칙 1) —
// 공제 구간·산식은 rules 의 formula/deduction 문자열을 정규식으로 파싱해 계산한다 (rules 가
// SSOT). 지원하지 않는 포맷이면 throw — 조용한 오계산보다 실패가 낫다.
//
// 검증 대조(DoD): 홈택스 세금모의계산 > 퇴직소득. 각 단계 금액은 원 단위 반올림(Math.round,
// api-spec) — 홈택스는 일부 단계에서 절사를 쓰므로 수원 단위 오차가 날 수 있다.

// ---------------------------------------------------------------------------
// 근속연수 — 입사일~퇴직일, 1년 미만은 1년으로 올림 (rules.serviceYearDeduction.yearRounding)
// ---------------------------------------------------------------------------

function parseIsoDate(s: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`날짜 형식이 잘못되었습니다 (YYYY-MM-DD): "${s}"`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** 만 연수 + 하루라도 남으면 올림. 예: 만 19년 + 1일 → 20년, 6개월 → 1년. */
export function serviceYearsBetween(joinDate: string, leaveDate: string): number {
  const j = parseIsoDate(joinDate);
  const l = parseIsoDate(leaveDate);
  let full = l.y - j.y;
  const beforeAnniversary = l.m < j.m || (l.m === j.m && l.d < j.d);
  if (beforeAnniversary) full -= 1;
  const exactAnniversary = l.m === j.m && l.d === j.d;
  return Math.max(exactAnniversary ? full : full + 1, 1);
}

// ---------------------------------------------------------------------------
// rules 산식 파서 (포맷은 db-schema/rules 계약 — 정확히 두 가지씩만 허용)
// ---------------------------------------------------------------------------

/** "1000000 * n" | "5000000 + 2000000 * (n - 5)" → 공제액 = base + per × (n − offset) */
export function parseServiceYearFormula(formula: string): {
  base: number;
  per: number;
  offset: number;
} {
  const linear = /^\s*(\d+)\s*\*\s*n\s*$/.exec(formula);
  if (linear) return { base: 0, per: Number(linear[1]), offset: 0 };
  const affine = /^\s*(\d+)\s*\+\s*(\d+)\s*\*\s*\(\s*n\s*-\s*(\d+)\s*\)\s*$/.exec(formula);
  if (affine) return { base: Number(affine[1]), per: Number(affine[2]), offset: Number(affine[3]) };
  throw new Error(`근속연수공제 산식을 해석할 수 없습니다: "${formula}"`);
}

/** "100%"(전액 공제) | "8000000 + 초과분*60%" (초과분 = 환산급여 − 직전 구간 max) */
export function parseConvertedSalaryDeduction(
  deduction: string,
): { full: true } | { full: false; base: number; ratePct: number } {
  if (/^\s*100%\s*$/.test(deduction)) return { full: true };
  const m = /^\s*(\d+)\s*\+\s*초과분\s*\*\s*(\d+)\s*%\s*$/.exec(deduction);
  if (m) return { full: false, base: Number(m[1]), ratePct: Number(m[2]) };
  throw new Error(`환산급여공제 산식을 해석할 수 없습니다: "${deduction}"`);
}

// ---------------------------------------------------------------------------
// 단계별 계산
// ---------------------------------------------------------------------------

function serviceYearDeductionFor(years: number, rules: SeveranceRules): number {
  const bracket = rules.serviceYearDeduction.brackets.find(
    (b) => b.maxYears === null || years <= b.maxYears,
  );
  if (!bracket) throw new Error(`근속연수 ${years}년에 해당하는 공제 구간이 없습니다`);
  const f = parseServiceYearFormula(bracket.formula);
  return f.base + f.per * (years - f.offset);
}

function convertedSalaryDeductionFor(convertedSalary: number, rules: SeveranceRules): number {
  const brackets = rules.convertedSalaryDeduction.brackets;
  const i = brackets.findIndex((b) => b.max === null || convertedSalary <= b.max);
  if (i < 0) throw new Error(`환산급여 ${convertedSalary}에 해당하는 공제 구간이 없습니다`);
  const parsed = parseConvertedSalaryDeduction(brackets[i].deduction);
  if (parsed.full) return convertedSalary;
  const prevMax = i > 0 ? brackets[i - 1].max : 0;
  if (prevMax === null)
    throw new Error("환산급여공제 구간 순서가 잘못되었습니다 (max=null 은 마지막 구간이어야 함)");
  return parsed.base + ((convertedSalary - prevMax) * parsed.ratePct) / 100;
}

/**
 * 기본세율 세액 — rules.taxBrackets 의 quick 은 **구간 시작점까지의 누적세액**이다
 * (누진공제액이 아님 — REVIEW_2026-09-22 C-1). 세액 = quick + (과세표준 − 직전 구간 max) × rate.
 * 경계 정합성(각 구간 상한 세액 = 다음 quick)은 엔진 테스트가 rules 값으로 검증한다.
 */
export function convertedTaxFor(taxBase: number, rules: SeveranceRules): number {
  const rows = rules.taxBrackets.rows;
  const i = rows.findIndex((r) => r.max === null || taxBase <= r.max);
  if (i < 0) throw new Error(`과세표준 ${taxBase}에 해당하는 세율 구간이 없습니다`);
  const prevMax = i > 0 ? rows[i - 1].max : 0;
  if (prevMax === null)
    throw new Error("세율 구간 순서가 잘못되었습니다 (max=null 은 마지막 구간이어야 함)");
  return Math.round(rows[i].quick + (taxBase - prevMax) * rows[i].rate);
}

/**
 * IRP 실효 부담률 — 감면율은 "수령 기간 전체"가 아니라 **각 연차의 수령분**에 적용된다
 * (소득세법 §129: 1~10년차 70% · 11~20년차 60% · 21년차~ 50% 부담 — codex 리뷰 #3).
 * 균등 수령 가정으로 연차별 부담률을 가중평균한다. 예: 21년 수령 = (10×0.7+10×0.6+1×0.5)/21.
 */
export function irpEffectivePayRate(
  years: number,
  rows: SeveranceRules["irp"]["pensionDiscount"]["rows"],
): number {
  if (years < 1) throw new Error(`수령 기간이 잘못되었습니다: ${years}년`);
  let covered = 0;
  let weighted = 0;
  for (const row of rows) {
    if (covered >= years) break;
    const upper = row.yearsMax ?? years;
    const span = Math.min(upper, years) - covered;
    if (span > 0) {
      weighted += span * row.payRate;
      covered += span;
    }
  }
  if (covered < years)
    throw new Error("IRP 감면 구간이 수령 기간을 덮지 못합니다 (yearsMax=null 구간 필요)");
  return weighted / years;
}

/** 비교표에 보여줄 수령 기간 시나리오 (제도 숫자 아님 — 균등 수령 가정의 대표 기간) */
export const IRP_SCENARIO_YEARS = [10, 15, 25] as const;

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

export function computeSeverance(input: SeveranceInput, rules: SeveranceRules): SeveranceResult {
  const serviceYears = serviceYearsBetween(input.joinDate, input.leaveDate);

  // 1) 근속연수공제 → 2) 환산급여 = (퇴직금 − 공제) ÷ 근속연수 × 12 (음수는 0 처리)
  const serviceYearDeduction = Math.round(serviceYearDeductionFor(serviceYears, rules));
  const convertedSalary = Math.round(
    (Math.max(input.severancePay - serviceYearDeduction, 0) / serviceYears) * 12,
  );

  // 3) 환산급여공제 → 4) 과세표준
  const convertedSalaryDeduction = Math.round(
    convertedSalaryDeductionFor(convertedSalary, rules),
  );
  const taxBase = Math.max(convertedSalary - convertedSalaryDeduction, 0);

  // 5) 기본세율 → 환산산출세액 (quick = 구간 시작점 누적세액 — convertedTaxFor 참조)
  const convertedTax = convertedTaxFor(taxBase, rules);

  // 6) 퇴직소득세 = 환산산출세액 ÷ 12 × 근속연수 (finalStep) · 지방소득세 = × localTaxRate
  const incomeTax = Math.round((convertedTax / 12) * serviceYears);
  const localTax = Math.round(incomeTax * rules.localTaxRate.value);
  const totalTaxLump = incomeTax + localTax;
  const netLump = input.severancePay - totalTaxLump;

  // 7) IRP 연금 수령 — 연차별 감면율의 균등 수령 가중평균(실효 부담률) × 이연 세액
  const discountRows = rules.irp.pensionDiscount.rows;
  const irpOptions: IrpOption[] = IRP_SCENARIO_YEARS.map((years) => {
    const payRate = irpEffectivePayRate(years, discountRows);
    const totalTax = Math.round(totalTaxLump * payRate);
    return {
      label: `${years}년 수령`,
      payRate,
      totalTax,
      net: input.severancePay - totalTax,
      saving: totalTaxLump - totalTax,
    };
  });

  return {
    serviceYears,
    serviceYearDeduction,
    convertedSalary,
    convertedSalaryDeduction,
    taxBase,
    convertedTax,
    incomeTax,
    localTax,
    totalTaxLump,
    netLump,
    irpOptions,
  };
}
