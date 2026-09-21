import { z } from "zod";
import type { SalarySeniorInput } from "@contracts/shared-types";

// 폼 값은 시니어 입력 편의를 위해 월급을 "만원" 단위로 받는다 — 엔진 호출 직전 원 단위로 변환.
export const salarySeniorFormSchema = z.object({
  age: z.coerce
    .number()
    .min(15, "나이를 확인해 주세요")
    .max(99, "나이를 확인해 주세요"),
  /** 세전 월급 (만원) */
  salaryMan: z.coerce
    .number()
    .min(1, "세전 월급을 만원 단위로 입력해 주세요")
    .max(100_000, "값이 너무 큽니다"),
  /** 본인 포함 공제대상 가족 수 — 간이세액표 열은 최대 11명 */
  dependents: z.coerce
    .number()
    .int("명 단위로 입력해 주세요")
    .min(1, "본인을 포함해 1명 이상이에요")
    .max(11, "간이세액표는 최대 11명까지예요"),
});

/** 폼이 다루는 원시 입력(문자열 허용 — coerce 전) / 파싱 후 값 */
export type SalarySeniorFormInput = z.input<typeof salarySeniorFormSchema>;
export type SalarySeniorFormValues = z.output<typeof salarySeniorFormSchema>;

export const salarySeniorFormDefaults: SalarySeniorFormInput = {
  age: 62,
  salaryMan: 0,
  dependents: 1,
};

const MAN = 10_000;

export function toEngineInput(v: SalarySeniorFormValues): SalarySeniorInput {
  return {
    age: v.age,
    monthlySalary: v.salaryMan * MAN,
    dependents: v.dependents,
  };
}
