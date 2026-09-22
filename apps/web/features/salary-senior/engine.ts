import type {
  InsuranceRules,
  SalarySeniorInput,
  SalarySeniorResult,
  SimplifiedTaxTable,
} from "@contracts/shared-types";
import {
  employmentPremium,
  healthPremium,
  longTermCarePremium,
  nationalPensionPremium,
} from "@/lib/insurance-calc";

// F-07 재취업 연봉 실수령 엔진 — TOOL_SPEC_salary-senior.md 의 산식을 rules 값으로 구현.
// 순수함수: 같은 (input, rules, taxTable) → 같은 result. 제도 숫자 하드코딩 금지 (도메인 규칙 1).
//
// - 차별 로직: 60세 이상(input.age >= 60, 경계 포함)은 국민연금 사업장가입 제외 → 공제 0.
//   실제 면제 여부는 rules.nationalPension.age60Exempt 가 제어한다 (rules 교체 테스트가 DoD).
// - 소득세: 간이세액표(taxTable.rows) 의 [min, max) 구간(max=null 은 무한)에서
//   byDependents[min(부양가족 수, 11) − 1] 을 lookup. 지방소득세 = 소득세 × rules.incomeTax
//   .localTaxRate. rows 가 비어 있으면(미수록) 소득세·지방세 0 + notes 로 명시 — 숨기지 않는다.
// - totalDeduction 은 지방소득세까지 포함한 전체 공제액이다. 표 미수록 상태(소득세 0)에서는
//   4대보험 4항목 합과 같고, 표 수록 후에도 net = gross − totalDeduction 이 실수령액이 되도록
//   localTax 를 합계에 포함한다 (지시서의 "5개 항목"과의 해석 차이는 완료 보고에 명시).
export function computeSalarySenior(
  input: SalarySeniorInput,
  rules: InsuranceRules,
  taxTable: SimplifiedTaxTable,
): SalarySeniorResult {
  const gross = input.monthlySalary;
  const age60Plus = input.age >= 60;

  const nationalPension = nationalPensionPremium(gross, age60Plus, rules);
  const health = healthPremium(gross, rules);
  const longTermCare = longTermCarePremium(health, rules);
  const employment = employmentPremium(gross, rules);

  const notes: string[] = [];

  if (age60Plus && rules.nationalPension.age60Exempt.value) {
    notes.push("60세 이상은 국민연금을 떼지 않아요 (사업장가입 제외)");
  }
  if (age60Plus) {
    notes.push(
      "국민연금을 받으면서 일하시면 소득에 따라 연금이 일부 감액될 수 있어요 (재직자 노령연금)",
    );
  }

  let incomeTax = 0;
  let localTax = 0;
  if (taxTable.rows.length === 0) {
    const hometax =
      rules.incomeTax?.tableSource ??
      "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6583&cntntsId=7862";
    notes.push(
      `소득세·지방소득세는 근로소득 간이세액표 수록 전이라 계산에서 제외했어요 — 홈택스 조견표(${hometax})에서 확인할 수 있어요`,
    );
  } else {
    const localTaxRate = rules.incomeTax?.localTaxRate.value;
    if (localTaxRate === undefined)
      throw new Error("insurance rules: incomeTax.localTaxRate 누락 (지방소득세율)");
    const depIdx = Math.min(input.dependents, 11) - 1;
    const row = taxTable.rows.find(
      (r) => gross >= r.min && (r.max === null || gross < r.max),
    );
    const o = taxTable.overflow;
    if (row) {
      incomeTax = row.byDependents[depIdx] ?? 0;
    } else if (o && gross >= o.baseAt) {
      // 표 상단 초과 — 국세청 표 하단 산식 (tiers 는 "min 초과 ~ max 이하" 규약)
      const base = o.baseByDependents[depIdx] ?? 0;
      if (gross === o.baseAt) {
        incomeTax = base;
      } else {
        const tier = o.tiers.find((t) => gross > t.min && (t.max === null || gross <= t.max));
        if (!tier) throw new Error(`간이세액표 초과 구간을 찾을 수 없습니다 (월급 ${gross})`);
        const excess = gross - tier.min;
        incomeTax =
          base + tier.fixed + Math.round(excess * (tier.applyRate98 ? 0.98 : 1) * tier.rate);
      }
    } else {
      // 표 범위 밖인데 초과 산식 데이터도 없다 — 0 으로 조용히 두지 않는다.
      notes.push(
        "월급이 간이세액표 구간을 벗어나 소득세를 계산하지 못했어요 — 홈택스 조견표에서 확인해 주세요",
      );
    }
    localTax = Math.round(incomeTax * localTaxRate);
  }

  const totalDeduction =
    nationalPension + health + longTermCare + employment + incomeTax + localTax;

  return {
    gross,
    nationalPension,
    health,
    longTermCare,
    employment,
    incomeTax,
    localTax,
    totalDeduction,
    net: gross - totalDeduction,
    notes,
  };
}
