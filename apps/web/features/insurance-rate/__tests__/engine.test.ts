import { describe, expect, it } from "vitest";
import type { InsuranceRules, NextYearRates } from "@contracts/shared-types";
import { insuranceRules, nextYearRates } from "@/data/rules";
import { computeInsuranceDiff } from "../engine";

// 기대값은 TOOL_SPEC_insurance-rate.md 산식(월급×요율, 상하한 클램프)을 수기 계산한 값
// (구현과 독립). 2026 rules: 국민연금 근로자 4.75%(내년 5.0% 확정), 건강보험 3.595%(동결),
// 장기요양 = 건보료×0.9448/7.19, 고용 0.9% — 장기요양·고용의 내년 값은 미발표(null).

describe("computeInsuranceDiff — 월급 300만·60세 미만 (앵커)", () => {
  const r = computeInsuranceDiff(
    { monthlySalary: 3_000_000, age60Plus: false },
    insuranceRules,
    nextYearRates,
  );
  const [np, health, ltc, emp] = r.rows;

  it("rows 는 InsuranceItem 순서 4개", () => {
    expect(r.rows.map((row) => row.item)).toEqual([
      "nationalPension",
      "health",
      "longTermCare",
      "employment",
    ]);
  });

  it("국민연금 142,500 → 내년 150,000 (diff +7,500)", () => {
    expect(np.currentMonthly).toBe(142_500);
    expect(np.nextMonthly).toBe(150_000);
    expect(np.diffMonthly).toBe(7_500);
  });

  it("건강보험 107,850 → 동결 107,850 (diff 0)", () => {
    expect(health.currentMonthly).toBe(107_850);
    expect(health.nextMonthly).toBe(107_850);
    expect(health.diffMonthly).toBe(0);
  });

  it("장기요양 14,172 → 미발표 null + '12월 발표 예정'", () => {
    expect(ltc.currentMonthly).toBe(14_172);
    expect(ltc.nextMonthly).toBeNull();
    expect(ltc.diffMonthly).toBeNull();
    expect(ltc.note).toBe("12월 발표 예정");
  });

  it("고용보험 27,000 → 미발표 null + '12월 발표 예정'", () => {
    expect(emp.currentMonthly).toBe(27_000);
    expect(emp.nextMonthly).toBeNull();
    expect(emp.diffMonthly).toBeNull();
    expect(emp.note).toBe("12월 발표 예정");
  });

  it("합계: 올해 291,522 · 미발표는 올해 값 대체 합산 → partial, +7,500/월 · +90,000/연", () => {
    expect(r.totalCurrent).toBe(291_522);
    expect(r.totalNext).toBe(299_022);
    expect(r.partial).toBe(true);
    expect(r.totalDiffMonthly).toBe(7_500);
    expect(r.totalDiffAnnual).toBe(90_000);
  });
});

describe("computeInsuranceDiff — 국민연금 상하한 클램프", () => {
  it("월급 700만: 기준소득월액 상한 659만 클램프 → 313,025", () => {
    const r = computeInsuranceDiff(
      { monthlySalary: 7_000_000, age60Plus: false },
      insuranceRules,
      nextYearRates,
    );
    expect(r.rows[0].currentMonthly).toBe(313_025);
    // 내년 상하한 미고시 — 올해 상한으로 근사: 6,590,000 × 5.0% = 329,500
    expect(r.rows[0].nextMonthly).toBe(329_500);
  });

  it("월급 30만: 하한 41만 클램프 → 19,475", () => {
    const r = computeInsuranceDiff(
      { monthlySalary: 300_000, age60Plus: false },
      insuranceRules,
      nextYearRates,
    );
    expect(r.rows[0].currentMonthly).toBe(19_475);
  });
});

describe("computeInsuranceDiff — 60세 이상", () => {
  it("국민연금 row 는 발표값이 있어도 0/0 (diff 0) + 안내 문구, 나머지는 그대로", () => {
    const r = computeInsuranceDiff(
      { monthlySalary: 3_000_000, age60Plus: true },
      insuranceRules,
      nextYearRates,
    );
    const np = r.rows[0];
    expect(np.currentMonthly).toBe(0);
    expect(np.nextMonthly).toBe(0);
    expect(np.diffMonthly).toBe(0);
    expect(np.note).toBe("60세 이상은 국민연금 공제가 없어요");
    // 건강·장기요양·고용은 60세와 무관
    expect(r.totalCurrent).toBe(107_850 + 14_172 + 27_000);
    expect(r.totalDiffMonthly).toBe(0);
  });
});

describe("DoD: rules·next 교체만으로 숫자가 바뀐다 (하드코딩 금지 검증)", () => {
  it("current rateEmployee 를 바꾸면 올해 값이 그에 따라 바뀐다", () => {
    const changed: InsuranceRules = structuredClone(insuranceRules);
    changed.nationalPension.rateEmployee.value = 0.05;
    const r = computeInsuranceDiff(
      { monthlySalary: 3_000_000, age60Plus: false },
      changed,
      nextYearRates,
    );
    expect(r.rows[0].currentMonthly).toBe(150_000); // 300만 × 5%
  });

  it("next 발표값을 바꾸면 내년 값이 그에 따라 바뀐다", () => {
    const next: NextYearRates = structuredClone(nextYearRates);
    next.nationalPensionEmployee = 0.06;
    const r = computeInsuranceDiff(
      { monthlySalary: 3_000_000, age60Plus: false },
      insuranceRules,
      next,
    );
    expect(r.rows[0].nextMonthly).toBe(180_000); // 300만 × 6%
    expect(r.rows[0].diffMonthly).toBe(180_000 - 142_500);
  });

  it("next 값을 null 로 바꾸면 미발표 처리('12월 발표 예정')로 돌아간다", () => {
    const next: NextYearRates = structuredClone(nextYearRates);
    next.nationalPensionEmployee = null;
    next.healthEmployee = null;
    const r = computeInsuranceDiff(
      { monthlySalary: 3_000_000, age60Plus: false },
      insuranceRules,
      next,
    );
    expect(r.rows.every((row) => row.nextMonthly === null)).toBe(true);
    expect(r.rows.every((row) => row.note === "12월 발표 예정")).toBe(true);
    expect(r.partial).toBe(true);
    // 전부 미발표 → 올해 값으로 대체 합산 = diff 0
    expect(r.totalNext).toBe(r.totalCurrent);
    expect(r.totalDiffMonthly).toBe(0);
  });

  it("장기요양 formula 발표 시 내년 건보료 기반으로 계산된다", () => {
    const next: NextYearRates = structuredClone(nextYearRates);
    next.longTermCareFormula = "건강보험료 본인부담분 × 1.0/7.19";
    const r = computeInsuranceDiff(
      { monthlySalary: 3_000_000, age60Plus: false },
      insuranceRules,
      next,
    );
    // 내년 건보료 107,850 × 1.0/7.19 = 15,000
    expect(r.rows[2].nextMonthly).toBe(15_000);
    expect(r.rows[2].diffMonthly).toBe(15_000 - 14_172);
    // 고용보험은 여전히 미발표 → partial 유지
    expect(r.partial).toBe(true);
  });
});
