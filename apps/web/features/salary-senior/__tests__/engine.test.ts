import { describe, expect, it } from "vitest";
import type {
  InsuranceRules,
  SalarySeniorInput,
  SimplifiedTaxTable,
} from "@contracts/shared-types";
import { insuranceRules, simplifiedTaxTable } from "@/data/rules";
import { computeSalarySenior } from "../engine";

// 기대값은 TOOL_SPEC_salary-senior.md 산식을 rules(2026) 값으로 수기 계산한 앵커 (구현과 독립).
// health = round(3,000,000×0.03595) = 107,850 · LTC = round(107,850×0.9448/7.19) = 14,172
// employment = round(3,000,000×0.009) = 27,000 · NP(60세 미만) = round(3,000,000×0.0475) = 142,500
// 소득세 74,350 = 국세청 간이세액표(2026.3.1 적용판) 월 300만·1인 칸 — 표 원본이 독립 출처.

const base: SalarySeniorInput = { age: 62, monthlySalary: 3_000_000, dependents: 1 };

describe("computeSalarySenior — 앵커 (수기 계산값 + 국세청 표 대조)", () => {
  it("① 62세·월 300만·부양 1: 국민연금 0, 소득세 74,350 → 공제 230,807, 실수령 2,769,193", () => {
    const r = computeSalarySenior(base, insuranceRules, simplifiedTaxTable);
    expect(r.gross).toBe(3_000_000);
    expect(r.nationalPension).toBe(0);
    expect(r.health).toBe(107_850);
    expect(r.longTermCare).toBe(14_172);
    expect(r.employment).toBe(27_000);
    expect(r.incomeTax).toBe(74_350);
    expect(r.localTax).toBe(7_435); // 74,350 × 0.1 (rules.incomeTax.localTaxRate)
    expect(r.totalDeduction).toBe(230_807);
    expect(r.net).toBe(2_769_193);
    const joined = r.notes.join(" | ");
    expect(joined).toContain("60세 이상은 국민연금을 떼지 않아요");
    expect(joined).toContain("재직자 노령연금");
    expect(joined).not.toContain("간이세액표 수록 전"); // 표 수록 완료 (2026-09-22)
  });

  it("② 58세·월 300만: 국민연금 142,500 포함 → 공제 373,307, 실수령 2,626,693", () => {
    const r = computeSalarySenior({ ...base, age: 58 }, insuranceRules, simplifiedTaxTable);
    expect(r.nationalPension).toBe(142_500);
    expect(r.totalDeduction).toBe(373_307);
    expect(r.net).toBe(2_626_693);
    const joined = r.notes.join(" | ");
    expect(joined).not.toContain("국민연금을 떼지 않아요");
    expect(joined).not.toContain("재직자 노령연금");
  });

  it("표 미수록(rows 빈 배열) 폴백: 소득세 0 + 안내 문구 — 숨기지 않는다", () => {
    const emptyTable: SimplifiedTaxTable = {
      _meta: structuredClone(simplifiedTaxTable._meta),
      rows: [],
    };
    const r = computeSalarySenior(base, insuranceRules, emptyTable);
    expect(r.incomeTax).toBe(0);
    expect(r.localTax).toBe(0);
    expect(r.totalDeduction).toBe(149_022);
    const joined = r.notes.join(" | ");
    expect(joined).toContain("간이세액표 수록 전");
    expect(joined).toContain("nts.go.kr");
  });

  it("표 구간 초과(월 1,200만): 소득세 0 으로 조용히 두지 않고 안내한다", () => {
    const r = computeSalarySenior(
      { age: 58, monthlySalary: 12_000_000, dependents: 1 },
      insuranceRules,
      simplifiedTaxTable,
    );
    expect(r.incomeTax).toBe(0);
    expect(r.notes.join(" | ")).toContain("간이세액표 구간을 벗어나");
  });

  it("③ 경계: 만 60세도 국민연금 공제 0 (60 포함)", () => {
    const r = computeSalarySenior({ ...base, age: 60 }, insuranceRules, simplifiedTaxTable);
    expect(r.nationalPension).toBe(0);
    expect(r.notes.join(" | ")).toContain("60세 이상은 국민연금을 떼지 않아요");
  });

  it("④ 58세·월 700만: 기준소득월액 상한(659만) 클램프 → 국민연금 313,025", () => {
    const r = computeSalarySenior(
      { age: 58, monthlySalary: 7_000_000, dependents: 1 },
      insuranceRules,
      simplifiedTaxTable,
    );
    expect(r.nationalPension).toBe(313_025);
  });
});

describe("DoD: rules·taxTable 교체만으로 결과가 바뀐다 (하드코딩 금지 검증)", () => {
  it("age60Exempt=false 로 바꾼 rules 를 주입하면 62세도 국민연금이 공제된다", () => {
    const noExempt: InsuranceRules = structuredClone(insuranceRules);
    noExempt.nationalPension.age60Exempt.value = false;

    const r = computeSalarySenior(base, noExempt, simplifiedTaxTable);
    expect(r.nationalPension).toBe(142_500);
    expect(r.totalDeduction).toBe(373_307);
    // 공제가 발생했으므로 "떼지 않아요" 안내는 나오면 안 된다
    expect(r.notes.join(" | ")).not.toContain("국민연금을 떼지 않아요");
  });

  const byDependents = [
    50_000, 45_000, 40_000, 35_000, 30_000, 25_000, 20_000, 15_000, 10_000, 5_000, 1_000,
  ];
  const fakeTable: SimplifiedTaxTable = {
    _meta: structuredClone(simplifiedTaxTable._meta),
    rows: [{ min: 0, max: null, byDependents }],
  };

  it("가짜 rows 주입 시 소득세 lookup + 지방세 10% + 합계·실수령 반영", () => {
    const r = computeSalarySenior(base, insuranceRules, fakeTable);
    expect(r.incomeTax).toBe(50_000);
    expect(r.localTax).toBe(5_000);
    // 62세: 4대보험 149,022 + 소득세 50,000 + 지방세 5,000
    expect(r.totalDeduction).toBe(204_022);
    expect(r.net).toBe(2_795_978);
    // 표가 있으면 "수록 전" 안내는 나오면 안 된다
    expect(r.notes.join(" | ")).not.toContain("간이세액표 수록 전");
  });

  it("부양가족 수 인덱스: 3명 → 3번째 열, 11명 초과는 11명 열로 클램프", () => {
    const r3 = computeSalarySenior({ ...base, dependents: 3 }, insuranceRules, fakeTable);
    expect(r3.incomeTax).toBe(40_000);
    // 스키마는 11명까지 허용하지만 엔진 클램프도 검증 (min(부양가족, 11) − 1)
    const r15 = computeSalarySenior({ ...base, dependents: 15 }, insuranceRules, fakeTable);
    expect(r15.incomeTax).toBe(1_000);
  });

  it("구간 경계 [min, max): 월급이 max 와 같으면 다음 구간에서 lookup", () => {
    const twoRows: SimplifiedTaxTable = {
      _meta: structuredClone(simplifiedTaxTable._meta),
      rows: [
        { min: 0, max: 3_000_000, byDependents: [10_000] },
        { min: 3_000_000, max: null, byDependents: [90_000] },
      ],
    };
    const r = computeSalarySenior(base, insuranceRules, twoRows);
    expect(r.incomeTax).toBe(90_000);
  });
});
