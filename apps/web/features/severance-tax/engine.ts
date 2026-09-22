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

/** IrpOption.label — rows 의 yearsMax 로 조립 ("10년 이하"/"10~20년"/"20년 초과"). 리터럴 금지. */
function irpLabelFor(
  rows: SeveranceRules["irp"]["pensionDiscount"]["rows"],
  i: number,
): string {
  const cur = rows[i];
  const prevMax = i > 0 ? rows[i - 1].yearsMax : null;
  if (cur.yearsMax === null) {
    if (prevMax === null)
      throw new Error("IRP 감면 구간 순서가 잘못되었습니다 (yearsMax=null 은 마지막 구간이어야 함)");
    return `${prevMax}년 초과`;
  }
  return prevMax === null ? `${cur.yearsMax}년 이하` : `${prevMax}~${cur.yearsMax}년`;
}

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

  // 7) IRP 연금 수령 — 이연 세액(소득세+지방세) × payRate 부담 (rules.irp.pensionDiscount)
  const discountRows = rules.irp.pensionDiscount.rows;
  const irpOptions: IrpOption[] = discountRows.map((r, i) => {
    const totalTax = Math.round(totalTaxLump * r.payRate);
    return {
      label: irpLabelFor(discountRows, i),
      payRate: r.payRate,
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
