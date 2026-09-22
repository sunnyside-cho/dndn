import type { InsuranceRules } from "@contracts/shared-types";

// 4대보험 공제 공통 계산 — insurance-rate(F-04)·salary-senior(F-07) 두 feature 가 공유한다.
// 모든 수치는 rules 에서 온다 (하드코딩 금지 — 도메인 규칙 1).

/**
 * 장기요양 비율(건보료 대비) — rules 의 formula 문자열("건강보험료 본인부담분 × 0.9448/7.19")
 * 에서 분자/분모를 파싱한다. 요율 개정 시 rules 문자열만 바뀌면 된다.
 */
export function longTermCareRatio(rules: InsuranceRules): number {
  const m = rules.healthInsurance.longTermCare.formula.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (!m) throw new Error("insurance rules: longTermCare.formula 에서 비율을 찾을 수 없음");
  return Number(m[1]) / Number(m[2]);
}

/** 국민연금 기준소득월액 상하한 적용 (baseMonthly.applied — 현재 적용 구간) */
export function clampPensionBase(monthlySalary: number, rules: InsuranceRules): number {
  const range = rules.nationalPension.baseMonthly.applied;
  return Math.min(Math.max(monthlySalary, range.min), range.max);
}

/** 국민연금 근로자 부담 (60세 이상 사업장가입 제외 → 0) */
export function nationalPensionPremium(
  monthlySalary: number,
  age60Plus: boolean,
  rules: InsuranceRules,
  /** 요율 오버라이드(내년 비교용) — 미지정 시 현행 근로자 요율 */
  employeeRate?: number,
): number {
  if (age60Plus && rules.nationalPension.age60Exempt.value) return 0;
  const rate = employeeRate ?? rules.nationalPension.rateEmployee.value;
  return Math.round(clampPensionBase(monthlySalary, rules) * rate);
}

/**
 * 건강보험 근로자 부담 — 보수월액 상한(초고소득 예외)은 미적용 근사 (REVIEW_2026-09-22 M-3:
 * 타겟(재취업 5060)상 영향 미미 판정. 상한 고시값을 rules 에 수록하면 여기서 클램프 추가).
 */
export function healthPremium(
  monthlySalary: number,
  rules: InsuranceRules,
  employeeRate?: number,
): number {
  return Math.round(monthlySalary * (employeeRate ?? rules.healthInsurance.rateEmployee.value));
}

/** 장기요양보험료 (건보료 기반) */
export function longTermCarePremium(healthMonthly: number, rules: InsuranceRules): number {
  return Math.round(healthMonthly * longTermCareRatio(rules));
}

/** 고용보험 근로자 부담 */
export function employmentPremium(
  monthlySalary: number,
  rules: InsuranceRules,
  employeeRate?: number,
): number {
  return Math.round(monthlySalary * (employeeRate ?? rules.employmentInsurance.rateEmployee.value));
}
