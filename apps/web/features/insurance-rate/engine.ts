import type {
  InsuranceRateInput,
  InsuranceRateResult,
  InsuranceRateRow,
  InsuranceRules,
  NextYearRates,
} from "@contracts/shared-types";
import {
  employmentPremium,
  healthPremium,
  longTermCarePremium,
  nationalPensionPremium,
} from "@/lib/insurance-calc";

// F-04 4대보험 인상분 엔진 — TOOL_SPEC_insurance-rate.md.
// 순수함수: 같은 (input, current, next) → 같은 result. 요율·상하한은 전부 rules 인자에서
// 온다 (제도 숫자 하드코딩 금지 — 도메인 규칙 1). 계산 자체는 lib/insurance-calc 공용
// 헬퍼를 사용한다 (재구현 금지 — salary-senior 와 로직 공유).
//
// 미발표(null) 항목은 nextMonthly=null 로 두고 "12월 발표 예정" 으로만 표시한다 —
// 값 추측 금지 (도메인 규칙 12).
//
// 근사 1건: 내년(2027) 국민연금 기준소득월액 상·하한은 매년 7월 별도 고시라 아직 없다.
// 내년 요율 계산에도 올해(from_2026_07) 상·하한을 그대로 사용한다 — 상·하한 부근
// 월급에서는 실제 내년 보험료와 차이가 날 수 있는 근사값이다 (고시 시 rules 교체).

const PENDING_NOTE = "12월 발표 예정";
const AGE60_NOTE = "60세 이상은 국민연금 공제가 없어요";

export function computeInsuranceDiff(
  input: InsuranceRateInput,
  current: InsuranceRules,
  next: NextYearRates,
): InsuranceRateResult {
  const { monthlySalary, age60Plus } = input;

  // ---- 국민연금 (상하한 클램프·60세 면제는 헬퍼가 수행) ----
  const npExempt = age60Plus && current.nationalPension.age60Exempt.value;
  let npRow: InsuranceRateRow;
  if (npExempt) {
    // 60세 이상 사업장가입 제외 — 내년 요율 발표값이 있어도 공제 자체가 없으므로 0.
    npRow = {
      item: "nationalPension",
      currentMonthly: 0,
      nextMonthly: 0,
      diffMonthly: 0,
      note: AGE60_NOTE,
    };
  } else {
    const npCurrent = nationalPensionPremium(monthlySalary, age60Plus, current);
    if (next.nationalPensionEmployee === null) {
      npRow = {
        item: "nationalPension",
        currentMonthly: npCurrent,
        nextMonthly: null,
        diffMonthly: null,
        note: PENDING_NOTE,
      };
    } else {
      const npNext = nationalPensionPremium(
        monthlySalary,
        age60Plus,
        current,
        next.nationalPensionEmployee,
      );
      npRow = {
        item: "nationalPension",
        currentMonthly: npCurrent,
        nextMonthly: npNext,
        diffMonthly: npNext - npCurrent,
      };
    }
  }

  // ---- 건강보험 ----
  const healthCurrent = healthPremium(monthlySalary, current);
  const healthNext =
    next.healthEmployee === null
      ? null
      : healthPremium(monthlySalary, current, next.healthEmployee);
  const healthRow: InsuranceRateRow =
    healthNext === null
      ? {
          item: "health",
          currentMonthly: healthCurrent,
          nextMonthly: null,
          diffMonthly: null,
          note: PENDING_NOTE,
        }
      : {
          item: "health",
          currentMonthly: healthCurrent,
          nextMonthly: healthNext,
          diffMonthly: healthNext - healthCurrent,
        };

  // ---- 장기요양 (건보료 기반) ----
  const ltcCurrent = longTermCarePremium(healthCurrent, current);
  let ltcRow: InsuranceRateRow;
  if (next.longTermCareFormula === null) {
    ltcRow = {
      item: "longTermCare",
      currentMonthly: ltcCurrent,
      nextMonthly: null,
      diffMonthly: null,
      note: PENDING_NOTE,
    };
  } else {
    // 같은 파서(longTermCarePremium)를 재사용하기 위해 formula 만 내년 것으로 바꾼
    // rules 뷰를 구성한다 (원본 불변 — 얕은 복사).
    const nextLtcRules: InsuranceRules = {
      ...current,
      healthInsurance: {
        ...current.healthInsurance,
        longTermCare: {
          ...current.healthInsurance.longTermCare,
          formula: next.longTermCareFormula,
        },
      },
    };
    // 장기요양은 내년 건보료 기준 — 건보 요율이 미발표면 올해 건보료로 계산한다.
    const ltcNext = longTermCarePremium(healthNext ?? healthCurrent, nextLtcRules);
    ltcRow = {
      item: "longTermCare",
      currentMonthly: ltcCurrent,
      nextMonthly: ltcNext,
      diffMonthly: ltcNext - ltcCurrent,
    };
  }

  // ---- 고용보험 ----
  const empCurrent = employmentPremium(monthlySalary, current);
  const empNext =
    next.employmentEmployee === null
      ? null
      : employmentPremium(monthlySalary, current, next.employmentEmployee);
  const empRow: InsuranceRateRow =
    empNext === null
      ? {
          item: "employment",
          currentMonthly: empCurrent,
          nextMonthly: null,
          diffMonthly: null,
          note: PENDING_NOTE,
        }
      : {
          item: "employment",
          currentMonthly: empCurrent,
          nextMonthly: empNext,
          diffMonthly: empNext - empCurrent,
        };

  // ---- 합산 (InsuranceItem 순서 고정) ----
  const rows: InsuranceRateRow[] = [npRow, healthRow, ltcRow, empRow];
  const totalCurrent = rows.reduce((sum, r) => sum + r.currentMonthly, 0);
  // 미발표 항목은 올해 값으로 대체해 합산 — partial 로 "확정분 기준"임을 표시한다.
  const totalNext = rows.reduce((sum, r) => sum + (r.nextMonthly ?? r.currentMonthly), 0);
  const partial = rows.some((r) => r.nextMonthly === null);
  const totalDiffMonthly = totalNext - totalCurrent;

  return {
    rows,
    totalCurrent,
    totalNext,
    totalDiffMonthly,
    totalDiffAnnual: totalDiffMonthly * 12,
    partial,
  };
}
