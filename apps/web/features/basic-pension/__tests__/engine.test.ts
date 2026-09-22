import { describe, expect, it } from "vitest";
import type { BasicPensionInput, BasicPensionRules } from "@contracts/shared-types";
import { basicPensionRules } from "@/data/rules";
import { computeBasicPension } from "../engine";

// 기대값은 TOOL_SPEC_basic-pension.md 예시를 고시 산식으로 수기 계산한 값 (구현과 독립).
const base: BasicPensionInput = {
  birthYear: 1958, // 2026 기준 68세
  hasOccupationalPension: false,
  household: "single",
  spouseEligible: true,
  region: "city",
  laborIncomeSelf: 0,
  laborIncomeSpouse: 0,
  npsSelf: 0,
  npsSpouse: 0,
  otherIncomeMonthly: 0,
  interestIncomeMonthly: 0,
  generalAssets: 0,
  rentDeposit: 0,
  financialAssets: 0,
  debts: 0,
  luxuryCarValue: 0,
  membershipValue: 0,
  freeRentHousePrice: 0,
};

describe("computeBasicPension — TOOL_SPEC 예시", () => {
  it("예시1: 단독·중소도시·근로 150만·집 1.2억·예금 3천 → 소득인정액 38.8만, 전액 349,700", () => {
    const r = computeBasicPension(
      { ...base, laborIncomeSelf: 1_500_000, generalAssets: 120_000_000, financialAssets: 30_000_000 },
      basicPensionRules,
    );
    // 근로: 0.7×(150만−116만)=23.8만 · 재산: (1.2억−8,500만)+(3천만−2천만)=4,500만 ×4%÷12=15만
    expect(r.verdict).toBe("eligible");
    expect(r.incomeEvaluated).toBe(238_000);
    expect(r.assetConverted).toBe(150_000);
    expect(r.recognizedIncome).toBe(388_000);
    expect(r.estimatedMonthly).toBe(349_700);
    expect(r.incomeReversalApplied).toBe(false);
    expect(r.npsLink).toBe("full");
  });

  it("예시2: 부부·대도시·국민연금 각 60만·집 3억 → 부부감액 559,520 + 연계감액 가능성 표시", () => {
    const r = computeBasicPension(
      {
        ...base,
        household: "couple",
        region: "metro",
        npsSelf: 600_000,
        npsSpouse: 600_000,
        generalAssets: 300_000_000,
      },
      basicPensionRules,
    );
    // 소득: 120만 · 재산: (3억−1.35억)×4%÷12=55만 → 소득인정액 175만 < 부부기준 395.2만
    expect(r.verdict).toBe("eligible");
    expect(r.recognizedIncome).toBe(1_750_000);
    // 349,700×0.8×2 = 559,520 (부부 각 20% 감액)
    expect(r.estimatedMonthly).toBe(559_520);
    // 국민연금 60만 > 524,550(기준연금액×150%) → 단정 금지, 감액 가능성 표시
    expect(r.npsLink).toBe("mayReduce");
  });

  it("예시3: 단독·소득인정액 235만 → 소득역전방지로 월 12만원 부분 수급", () => {
    const r = computeBasicPension({ ...base, otherIncomeMonthly: 2_350_000 }, basicPensionRules);
    // 선정기준액 247만 − 235만 = 12만
    expect(r.verdict).toBe("eligible");
    expect(r.estimatedMonthly).toBe(120_000);
    expect(r.incomeReversalApplied).toBe(true);
  });
});

describe("computeBasicPension — 경계·자격", () => {
  it("소득역전방지 최저선: 기준연금액의 10%(34,970) 아래로 내려가지 않는다", () => {
    const r = computeBasicPension({ ...base, otherIncomeMonthly: 2_450_000 }, basicPensionRules);
    expect(r.verdict).toBe("eligible");
    expect(r.estimatedMonthly).toBe(34_970);
  });

  it("선정기준액 초과 → notEligible, 지급액 null", () => {
    const r = computeBasicPension({ ...base, otherIncomeMonthly: 2_500_000 }, basicPensionRules);
    expect(r.verdict).toBe("notEligible");
    expect(r.estimatedMonthly).toBeNull();
  });

  it("65세 미만 → ageNotYet / 직역연금 → occupationalExcluded", () => {
    expect(computeBasicPension({ ...base, birthYear: 1965 }, basicPensionRules).verdict).toBe("ageNotYet");
    expect(
      computeBasicPension({ ...base, hasOccupationalPension: true }, basicPensionRules).verdict,
    ).toBe("occupationalExcluded");
  });

  it("부채·보증금 95%(5% 공제)·고급차 가산이 재산환산에 반영된다 — REVIEW C-2", () => {
    const r = computeBasicPension(
      {
        ...base,
        generalAssets: 100_000_000,
        rentDeposit: 40_000_000, // × 0.95 → 3,800만 (2026 사업안내 — 종전 50%는 스펙 오류)
        debts: 10_000_000,
        luxuryCarValue: 50_000_000,
      },
      basicPensionRules,
    );
    // (1억+3,800만−8,500만) + 0 − 1천만 = 4,300만 ×4%÷12 = 143,333 + 차 5,000만(100%)
    expect(r.assetConverted).toBe(Math.round(43_000_000 * 0.04 / 12 + 50_000_000));
  });

  it("DoD: rentDepositRate 를 바꾼 rules 주입 시 보증금 반영이 그에 따라 바뀐다", () => {
    const swapped: BasicPensionRules = structuredClone(basicPensionRules);
    swapped.assetConversion.rentDepositRate.value = 0.5;
    const input = { ...base, rentDeposit: 200_000_000 };
    // 0.95: 1.9억 − 8,500만 = 1.05억 ×4%÷12 = 350,000
    expect(computeBasicPension(input, basicPensionRules).assetConverted).toBe(350_000);
    // 0.5: 1.0억 − 8,500만 = 1,500만 ×4%÷12 = 50,000
    expect(computeBasicPension(input, swapped).assetConverted).toBe(50_000);
  });
});

describe("codex 리뷰 반영 — 임계값·부부 1인 수급 (2026-09-22)", () => {
  it("자녀 명의 주택 5억(< 기준 6억)은 무료임차소득을 가산하지 않는다", () => {
    const r = computeBasicPension({ ...base, freeRentHousePrice: 500_000_000 }, basicPensionRules);
    expect(r.breakdown.freeRentIncome).toBe(0);
    // 6억 이상이면 가산: 6억 × 0.78% ÷ 12 = 390,000
    const r2 = computeBasicPension({ ...base, freeRentHousePrice: 600_000_000 }, basicPensionRules);
    expect(r2.breakdown.freeRentIncome).toBe(390_000);
  });

  it("차량 3천만(< 기준 4천만)은 100% 가산하지 않는다 — 회원권은 임계 없이 가산", () => {
    const r = computeBasicPension(
      { ...base, luxuryCarValue: 30_000_000, membershipValue: 10_000_000 },
      basicPensionRules,
    );
    expect(r.breakdown.luxuryAdded).toBe(10_000_000); // 회원권만
    const r2 = computeBasicPension({ ...base, luxuryCarValue: 40_000_000 }, basicPensionRules);
    expect(r2.breakdown.luxuryAdded).toBe(40_000_000); // 경계(이상) 포함
  });

  it("부부가구·배우자 미수급(65세 미만 등): 1인분 전액 349,700 — 부부감액 없음", () => {
    const r = computeBasicPension(
      { ...base, household: "couple", spouseEligible: false },
      basicPensionRules,
    );
    expect(r.verdict).toBe("eligible");
    expect(r.criterion).toBe(3_952_000); // 선정기준은 부부가구 기준 유지
    expect(r.estimatedMonthly).toBe(349_700); // 감액 없음 (수급자 1인)
  });

  it("부부가구·배우자 미수급 + 소득역전방지 최저선은 1인 기준(34,970)", () => {
    const r = computeBasicPension(
      { ...base, household: "couple", spouseEligible: false, otherIncomeMonthly: 3_930_000 },
      basicPensionRules,
    );
    // cap = 3,952,000 − 3,930,000 = 22,000 < 1인 최저 34,970
    expect(r.estimatedMonthly).toBe(34_970);
  });
});

describe("DoD: rules 파일 교체만으로 숫자가 바뀐다 (하드코딩 금지 검증)", () => {
  it("선정기준액·기준연금액을 바꾼 rules 를 주입하면 판정·지급액이 그에 따라 바뀐다", () => {
    const lowerCriterion: BasicPensionRules = structuredClone(basicPensionRules);
    lowerCriterion.selectionCriteria.single.value = 300_000; // 대폭 인하

    const input = { ...base, otherIncomeMonthly: 350_000 };
    // 현행 rules: 35만 < 247만 → 수급
    expect(computeBasicPension(input, basicPensionRules).verdict).toBe("eligible");
    // 교체 rules: 35만 > 30만 → 탈락
    expect(computeBasicPension(input, lowerCriterion).verdict).toBe("notEligible");

    // 기준연금액만 인상한 rules → 소득 0 이면 교체값 400,000 이 그대로 반영
    const raisedPension: BasicPensionRules = structuredClone(basicPensionRules);
    raisedPension.basePension.monthlyMax.value = 400_000;
    expect(computeBasicPension(base, raisedPension).estimatedMonthly).toBe(400_000);
  });
});
