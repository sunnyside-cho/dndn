import { z } from "zod";
import type { InsuranceRateInput } from "@contracts/shared-types";

// 폼 값은 시니어 입력 편의를 위해 "만원" 단위 — 엔진 호출 직전 원 단위로 변환한다.
export const insuranceRateFormSchema = z.object({
  salary: z.coerce
    .number()
    .min(1, "월급을 입력해 주세요")
    .max(100_000, "값이 너무 큽니다"),
  age60: z.enum(["yes", "no"]),
});

/** 폼이 다루는 원시 입력(문자열 허용 — coerce 전) / 파싱 후 값 */
export type InsuranceRateFormInput = z.input<typeof insuranceRateFormSchema>;
export type InsuranceRateFormValues = z.output<typeof insuranceRateFormSchema>;

export const insuranceRateFormDefaults: InsuranceRateFormInput = {
  salary: 0,
  age60: "no",
};

const MAN = 10_000;

export function toEngineInput(v: InsuranceRateFormValues): InsuranceRateInput {
  return {
    monthlySalary: v.salary * MAN,
    age60Plus: v.age60 === "yes",
  };
}
