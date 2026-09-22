import { describe, expect, it } from "vitest";
import type { DependentInput, DependentRules, RegionalPremiumInput } from "@contracts/shared-types";
import { dependentRules } from "@/data/rules";
import { checkDependent, estimateRegionalPremium } from "../engine";

// 기대값은 TOOL_SPEC_dependent-check.md 산식을 수기 계산한 값 (구현과 독립).

const base: DependentInput = {
  relationship: "family",
  hasBusinessRegistration: false,
  businessIncomeAnnual: 0,
  hasRentalIncome: false,
  annualIncome: 12_000_000,
  propertyTaxBase: 150_000_000,
  spouseMeetsIncome: null,
};

describe("checkDependent — 형제자매 관계 (재산 상한 1.8억 단일 기준, codex #4)", () => {
  it("형제자매·과표 2억 → 탈락 (직계 기준 5.4억이 아니라 1.8억 적용)", () => {
    const r = checkDependent({ ...base, relationship: "sibling", propertyTaxBase: 200_000_000 }, dependentRules);
    expect(r.verdict).toBe("lose");
    expect(r.reasons.join(" ")).toContain("형제자매");
  });

  it("형제자매·과표 1.5억 → 유지 + 연령·장애 요건 별도 확인 안내", () => {
    const r = checkDependent({ ...base, relationship: "sibling", propertyTaxBase: 150_000_000 }, dependentRules);
    expect(r.verdict).toBe("keep");
    expect(r.reasons.join(" ")).toContain("별도 확인");
  });

  it("직계(family)·과표 2억 → 유지 (기존 tier 기준)", () => {
    const r = checkDependent({ ...base, propertyTaxBase: 200_000_000 }, dependentRules);
    expect(r.verdict).toBe("keep");
  });
});

describe("checkDependent — 판정 게이트 (TOOL_SPEC 순서)", () => {
  it("전부 통과 → keep, estimatedPremium null, 통과 근거 노출", () => {
    const r = checkDependent(base, dependentRules);
    expect(r.verdict).toBe("keep");
    expect(r.estimatedPremium).toBeNull();
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("① 사업자등록 + 사업소득 발생 → 금액 불문 lose (1원이라도)", () => {
    const r = checkDependent(
      { ...base, hasBusinessRegistration: true, businessIncomeAnnual: 1 },
      dependentRules,
    );
    expect(r.verdict).toBe("lose");
    expect(r.reasons.join(" ")).toContain("사업자등록");
  });

  it("① 사업자등록 있어도 사업소득 미발생이면 keep", () => {
    const r = checkDependent(
      { ...base, hasBusinessRegistration: true, businessIncomeAnnual: 0 },
      dependentRules,
    );
    expect(r.verdict).toBe("keep");
  });

  it("② 미등록 사업소득: 연 600만 → lose / 연 400만 → keep", () => {
    expect(
      checkDependent({ ...base, businessIncomeAnnual: 6_000_000 }, dependentRules).verdict,
    ).toBe("lose");
    expect(
      checkDependent({ ...base, businessIncomeAnnual: 4_000_000 }, dependentRules).verdict,
    ).toBe("keep");
  });

  it("③ 주택임대소득 → 금액 불문 lose", () => {
    const r = checkDependent({ ...base, hasRentalIncome: true }, dependentRules);
    expect(r.verdict).toBe("lose");
    expect(r.reasons.join(" ")).toContain("임대소득");
  });

  it("④ 연소득 2,100만 → lose (공적연금 100% 반영 안내 포함)", () => {
    const r = checkDependent({ ...base, annualIncome: 21_000_000 }, dependentRules);
    expect(r.verdict).toBe("lose");
    expect(r.reasons.join(" ")).toContain("100%");
  });

  it("⑤ 과표 9억 초과 → 소득 0 이어도 lose", () => {
    const r = checkDependent(
      { ...base, annualIncome: 0, propertyTaxBase: 950_000_000 },
      dependentRules,
    );
    expect(r.verdict).toBe("lose");
  });

  it("⑤ 과표 6억(5.4억~9억 구간): 연소득 1,200만 → lose / 900만 → keep", () => {
    expect(
      checkDependent(
        { ...base, annualIncome: 12_000_000, propertyTaxBase: 600_000_000 },
        dependentRules,
      ).verdict,
    ).toBe("lose");
    expect(
      checkDependent(
        { ...base, annualIncome: 9_000_000, propertyTaxBase: 600_000_000 },
        dependentRules,
      ).verdict,
    ).toBe("keep");
  });

  it("⑥ 배우자 소득요건 미충족 → lose / 충족 → keep / null(배우자 없음) → keep", () => {
    expect(checkDependent({ ...base, spouseMeetsIncome: false }, dependentRules).verdict).toBe(
      "lose",
    );
    expect(checkDependent({ ...base, spouseMeetsIncome: true }, dependentRules).verdict).toBe(
      "keep",
    );
    expect(checkDependent({ ...base, spouseMeetsIncome: null }, dependentRules).verdict).toBe(
      "keep",
    );
  });

  it("복수 탈락 사유가 모두 축적된다 (임대 + 소득 2,100만 + 과표 9.5억 → 3건)", () => {
    const r = checkDependent(
      { ...base, hasRentalIncome: true, annualIncome: 21_000_000, propertyTaxBase: 950_000_000 },
      dependentRules,
    );
    expect(r.verdict).toBe("lose");
    expect(r.reasons).toHaveLength(3);
  });
});

describe("estimateRegionalPremium — 간이 추정 앵커", () => {
  const anchor: RegionalPremiumInput = {
    annualWorkPensionIncome: 12_000_000,
    annualOtherIncome: 0,
    propertyTaxBase: 150_000_000,
  };

  it("앵커: 연금 연 1,200만·과표 1.5억 → 건보 92,632 / 장기요양 12,172 / 합계 104,804", () => {
    // 소득분 = 12,000,000×0.5×0.0719÷12 = 35,950
    // 재산금액 = 1.5억−1억 = 5,000만 → 4,500만 초과~5,020만 이하 등급 268점 × 211.5 = 56,682
    const r = estimateRegionalPremium(anchor, dependentRules);
    expect(r.monthlyHealth).toBe(92_632);
    // 92,632 × (0.009448/0.0719) = 12,172.28 → 12,172
    expect(r.monthlyLongTermCare).toBe(12_172);
    expect(r.monthlyTotal).toBe(104_804);
    expect(r.note).toContain("간이 추정");
  });

  it("과표가 기본공제(1억) 이하면 재산분 0 — 소득분만 부과", () => {
    const r = estimateRegionalPremium({ ...anchor, propertyTaxBase: 90_000_000 }, dependentRules);
    expect(r.monthlyHealth).toBe(35_950);
  });

  it("소득·재산 0 → 하한(monthlyMin)으로 클램프", () => {
    const r = estimateRegionalPremium(
      { annualWorkPensionIncome: 0, annualOtherIncome: 0, propertyTaxBase: 0 },
      dependentRules,
    );
    expect(r.monthlyHealth).toBe(dependentRules.regionalPremium.monthlyMin.value);
  });

  it("거대 소득 → 상한(monthlyMax)으로 클램프", () => {
    const r = estimateRegionalPremium(
      { annualWorkPensionIncome: 0, annualOtherIncome: 10_000_000_000, propertyTaxBase: 0 },
      dependentRules,
    );
    expect(r.monthlyHealth).toBe(dependentRules.regionalPremium.monthlyMax.value);
  });

  it("60등급표 미수록(문자열) → 재산분 0 + note 에 사유", () => {
    const noTable: DependentRules = structuredClone(dependentRules);
    noTable.regionalPremium.assetPointTable = "별표4 미수록";
    const r = estimateRegionalPremium(anchor, noTable);
    expect(r.monthlyHealth).toBe(35_950); // 소득분만
    expect(r.note).toContain("재산점수표");
    expect(r.note).toContain("간이 추정");
  });
});

describe("DoD: rules 파일 교체만으로 판정·보험료가 바뀐다 (하드코딩 금지 검증)", () => {
  it("incomeMax 를 1,000만으로 낮추면 연소득 1,500만이 keep → lose 로 바뀐다", () => {
    const lowered: DependentRules = structuredClone(dependentRules);
    lowered.dependentEligibility.incomeMax.value = 10_000_000;

    const input = { ...base, annualIncome: 15_000_000 };
    expect(checkDependent(input, dependentRules).verdict).toBe("keep");
    expect(checkDependent(input, lowered).verdict).toBe("lose");
  });

  it("assetPointPrice 를 2배(423원)로 바꾸면 재산분이 비례해 2배가 된다", () => {
    const doubled: DependentRules = structuredClone(dependentRules);
    doubled.regionalPremium.assetPointPrice.value = 423;

    const r = estimateRegionalPremium(
      { annualWorkPensionIncome: 12_000_000, annualOtherIncome: 0, propertyTaxBase: 150_000_000 },
      doubled,
    );
    // 소득분 35,950 + 재산분 268×423 = 113,364 (56,682 의 2배) → 149,314
    expect(r.monthlyHealth).toBe(149_314);
  });
});
