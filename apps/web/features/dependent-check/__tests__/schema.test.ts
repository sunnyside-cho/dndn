import { describe, expect, it } from "vitest";
import {
  dependentFormDefaults,
  dependentFormSchema,
  toEngineInput,
  toPremiumInput,
} from "../schema";

// codex 리뷰 #4·#5 — 폼 → 엔진 입력 매핑 가드
describe("dependent schema 매핑", () => {
  const rental = dependentFormSchema.parse({
    ...dependentFormDefaults,
    rentalIncome: "yes",
    rentalIncomeAnnual: 1200, // 만원 단위 = 연 1,200만원
  });

  it("임대소득 금액이 보험료 추정의 기타소득(100% 반영)에 합산된다 (codex #5)", () => {
    expect(toPremiumInput(rental).annualOtherIncome).toBe(12_000_000);
  });

  it("판정용 연 소득 합계에도 임대소득이 포함된다", () => {
    expect(toEngineInput(rental).annualIncome).toBe(12_000_000);
    expect(toEngineInput(rental).hasRentalIncome).toBe(true);
  });

  it('임대소득 "없음"으로 되돌리면 잔존 입력값은 무시된다', () => {
    const off = dependentFormSchema.parse({
      ...dependentFormDefaults,
      rentalIncome: "no",
      rentalIncomeAnnual: 1200,
    });
    expect(toPremiumInput(off).annualOtherIncome).toBe(0);
    expect(toEngineInput(off).annualIncome).toBe(0);
  });

  it("supporter=sibling → relationship sibling, 그 외 → family (codex #4)", () => {
    const sib = dependentFormSchema.parse({ ...dependentFormDefaults, supporter: "sibling" });
    expect(toEngineInput(sib).relationship).toBe("sibling");
    const parent = dependentFormSchema.parse({ ...dependentFormDefaults, supporter: "parent" });
    expect(toEngineInput(parent).relationship).toBe("family");
  });
});
