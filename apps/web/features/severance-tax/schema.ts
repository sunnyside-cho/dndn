import { z } from "zod";
import type { SeveranceInput } from "@contracts/shared-types";

// 폼 값: 퇴직금은 시니어 입력 편의를 위해 "만원" 단위 — 엔진 호출 직전 원 단위로 변환한다.
// 입사일/퇴직일은 input[type=date] 의 YYYY-MM-DD 문자열 그대로 다룬다.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요");

export const severanceFormSchema = z
  .object({
    /** 세전 퇴직금 (만원) */
    severanceMan: z.coerce
      .number()
      .min(1, "퇴직금을 입력해 주세요")
      .max(10_000_000, "값이 너무 큽니다"),
    joinDate: isoDate,
    leaveDate: isoDate,
    /** 수령 방식 — 기본값 "아직 모름" (비교표가 답을 준다, TOOL_SPEC) */
    receiveType: z.enum(["lump", "irp", "unknown"]),
  })
  .superRefine((v, ctx) => {
    if (v.leaveDate <= v.joinDate) {
      ctx.addIssue({
        code: "custom",
        path: ["leaveDate"],
        message: "퇴직일은 입사일보다 뒤여야 해요",
      });
    }
  });

/** 폼이 다루는 원시 입력(문자열 허용 — coerce 전) / 파싱 후 값 */
export type SeveranceFormInput = z.input<typeof severanceFormSchema>;
export type SeveranceFormValues = z.output<typeof severanceFormSchema>;

export const severanceFormDefaults: SeveranceFormInput = {
  severanceMan: 0,
  joinDate: "",
  leaveDate: "",
  receiveType: "unknown",
};

const MAN = 10_000;

export function toEngineInput(v: SeveranceFormValues): SeveranceInput {
  return {
    severancePay: v.severanceMan * MAN,
    joinDate: v.joinDate,
    leaveDate: v.leaveDate,
  };
}
