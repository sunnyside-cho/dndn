import { z } from "zod";
import type { DependentInput, RegionalPremiumInput } from "@contracts/shared-types";

// 폼 값은 시니어 입력 편의를 위해 "만원" 단위(소득은 연간) — 엔진 호출 직전 원 단위로 변환한다.
const man = z.coerce.number().min(0, "0 이상을 입력해 주세요").max(10_000_000, "값이 너무 큽니다");

export const dependentFormSchema = z.object({
  /** 0단계 시점 선택 (TOOL_SPEC v1.1 · REVIEW V-3) — retired 는 문구·배지만 전환, 계산은 동일.
   *  은퇴 예정자가 현재 근로소득을 넣어 오탈락 받는 결함 방지: 은퇴 후 예상 소득만 입력 안내. */
  basis: z.enum(["current", "retired"]),
  /** 누구의 피부양자로 들어가는지 — 형제자매(sibling)는 재산 상한 1.8억 단일 기준 (codex #4) */
  supporter: z.enum(["child", "spouse", "parent", "sibling"]),
  bizRegistered: z.enum(["yes", "no"]),
  /** 사업자등록 있을 때만 의미 — 사업소득 발생 여부 (금액 불문 탈락) */
  bizIncomeRegistered: z.enum(["yes", "no"]),
  /** 연간 사업소득 (만원) — 미등록: 500만 판정 + 보험료 / 등록+발생: 보험료 추정용 대략값 */
  bizIncomeAnnual: man,
  rentalIncome: z.enum(["yes", "no"]),
  /** 연간 주택임대소득 (만원) — 있음일 때만 의미. 탈락 확정과 별개로 보험료 추정에 필요 (codex #5) */
  rentalIncomeAnnual: man,
  /** 근로·연금 소득 (연, 만원) — 판정에는 100%, 보험료에는 50% 반영 */
  workPensionIncome: man,
  /** 이자·배당·기타 소득 (연, 만원) — 사업소득은 위 필드에서 따로 받는다 (중복 입력 방지) */
  otherIncome: man,
  /** 재산세 과세표준 (만원) */
  propertyTaxBase: man,
  hasSpouse: z.enum(["yes", "no"]),
  /** 배우자 있을 때만 의미 */
  spouseMeetsIncome: z.enum(["yes", "no"]),
});

/** 폼이 다루는 원시 입력(문자열 허용 — coerce 전) / 파싱 후 값 */
export type DependentFormInput = z.input<typeof dependentFormSchema>;
export type DependentFormValues = z.output<typeof dependentFormSchema>;

export const dependentFormDefaults: DependentFormInput = {
  basis: "current",
  supporter: "child",
  bizRegistered: "no",
  bizIncomeRegistered: "no",
  bizIncomeAnnual: 0,
  rentalIncome: "no",
  rentalIncomeAnnual: 0,
  workPensionIncome: 0,
  otherIncome: 0,
  propertyTaxBase: 0,
  hasSpouse: "no",
  spouseMeetsIncome: "yes",
};

const MAN = 10_000;

/** 사업소득 연액(원) — 등록+발생 안 함이면 입력 필드가 화면에 없으므로 잔존값을 무시한다 */
function bizAnnualWon(v: DependentFormValues): number {
  if (v.bizRegistered === "yes" && v.bizIncomeRegistered === "no") return 0;
  return v.bizIncomeAnnual * MAN;
}

/** 임대소득 연액(원) — "없음"이면 잔존 입력값 무시 */
function rentalAnnualWon(v: DependentFormValues): number {
  return v.rentalIncome === "yes" ? v.rentalIncomeAnnual * MAN : 0;
}

export function toEngineInput(v: DependentFormValues): DependentInput {
  const registered = v.bizRegistered === "yes";
  const biz = bizAnnualWon(v);
  return {
    relationship: v.supporter === "sibling" ? "sibling" : "family",
    hasBusinessRegistration: registered,
    // shared-types: 등록자는 "발생 여부(>0)"가 판정 기준 — 금액을 0으로 적어도 발생=예면
    // 1원 마커로 게이트를 태운다 (금액 불문 탈락).
    businessIncomeAnnual:
      registered && v.bizIncomeRegistered === "yes" ? Math.max(biz, 1) : biz,
    hasRentalIncome: v.rentalIncome === "yes",
    // 판정용 연 소득 합계 = 근로·연금 + 이자·배당·기타 + 사업소득 + 임대소득 (모두 100% 반영)
    annualIncome: (v.workPensionIncome + v.otherIncome) * MAN + biz + rentalAnnualWon(v),
    propertyTaxBase: v.propertyTaxBase * MAN,
    spouseMeetsIncome: v.hasSpouse === "yes" ? v.spouseMeetsIncome === "yes" : null,
  };
}

export function toPremiumInput(v: DependentFormValues): RegionalPremiumInput {
  return {
    annualWorkPensionIncome: v.workPensionIncome * MAN,
    // 사업·임대소득은 부과 시 100% 반영 계열 — 기타소득에 합산 (임대 누락 = 보험료 과소, codex #5)
    annualOtherIncome: v.otherIncome * MAN + bizAnnualWon(v) + rentalAnnualWon(v),
    propertyTaxBase: v.propertyTaxBase * MAN,
  };
}
