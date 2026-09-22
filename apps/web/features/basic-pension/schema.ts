import { z } from "zod";
import type { BasicPensionInput } from "@contracts/shared-types";

// 폼 값은 시니어 입력 편의를 위해 "만원" 단위 — 엔진 호출 직전 원 단위로 변환한다.
const man = z.coerce.number().min(0, "0 이상을 입력해 주세요").max(10_000_000, "값이 너무 큽니다");

export const basicPensionFormSchema = z.object({
  birthYear: z.coerce
    .number()
    .min(1900, "출생연도를 확인해 주세요")
    .max(2010, "출생연도를 확인해 주세요"),
  occupational: z.enum(["yes", "no"]),
  household: z.enum(["single", "couple"]),
  /** 부부일 때: 배우자도 만 65세가 지났는지 (수급 대상 여부 근사) */
  spouseEligible: z.boolean(),
  region: z.enum(["metro", "city", "rural"]),
  laborSelf: man,
  laborSpouse: man,
  npsSelf: man,
  npsSpouse: man,
  otherIncome: man,
  interestIncome: man,
  generalAssets: man,
  rentDeposit: man,
  financialAssets: man,
  debts: man,
  hasLuxury: z.boolean(),
  luxuryCar: man,
  membership: man,
  hasFreeRent: z.boolean(),
  freeRentPrice: man,
});

/** 폼이 다루는 원시 입력(문자열 허용 — coerce 전) / 파싱 후 값 */
export type BasicPensionFormInput = z.input<typeof basicPensionFormSchema>;
export type BasicPensionFormValues = z.output<typeof basicPensionFormSchema>;

export const basicPensionFormDefaults: BasicPensionFormInput = {
  birthYear: 1960,
  occupational: "no",
  household: "single",
  spouseEligible: true,
  region: "city",
  laborSelf: 0,
  laborSpouse: 0,
  npsSelf: 0,
  npsSpouse: 0,
  otherIncome: 0,
  interestIncome: 0,
  generalAssets: 0,
  rentDeposit: 0,
  financialAssets: 0,
  debts: 0,
  hasLuxury: false,
  luxuryCar: 0,
  membership: 0,
  hasFreeRent: false,
  freeRentPrice: 0,
};

const MAN = 10_000;

export function toEngineInput(v: BasicPensionFormValues): BasicPensionInput {
  return {
    birthYear: v.birthYear,
    hasOccupationalPension: v.occupational === "yes",
    household: v.household,
    spouseEligible: v.spouseEligible,
    region: v.region,
    laborIncomeSelf: v.laborSelf * MAN,
    laborIncomeSpouse: v.laborSpouse * MAN,
    npsSelf: v.npsSelf * MAN,
    npsSpouse: v.npsSpouse * MAN,
    otherIncomeMonthly: v.otherIncome * MAN,
    interestIncomeMonthly: v.interestIncome * MAN,
    generalAssets: v.generalAssets * MAN,
    rentDeposit: v.rentDeposit * MAN,
    financialAssets: v.financialAssets * MAN,
    debts: v.debts * MAN,
    luxuryCarValue: v.hasLuxury ? v.luxuryCar * MAN : 0,
    membershipValue: v.hasLuxury ? v.membership * MAN : 0,
    freeRentHousePrice: v.hasFreeRent ? v.freeRentPrice * MAN : 0,
  };
}
