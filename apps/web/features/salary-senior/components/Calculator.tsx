"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import type { SalarySeniorResult } from "@contracts/shared-types";
import { Disclaimer } from "@/components/Disclaimer";
import { ResultCard } from "@/components/ResultCard";
import { MoneyField, StepShell } from "@/components/wizard";
import { insuranceRules, simplifiedTaxTable } from "@/data/rules";
import { track } from "@/lib/analytics";
import { won } from "@/lib/format";
import { computeSalarySenior } from "../engine";
import {
  salarySeniorFormDefaults,
  salarySeniorFormSchema,
  toEngineInput,
  type SalarySeniorFormInput,
  type SalarySeniorFormValues,
} from "../schema";

const TOTAL_STEPS = 3;

// 간이세액표 미수록 상태 — 소득세를 계산에서 제외했음을 헤드라인·표에 명시한다 (숨기지 않는다).
const taxPending = simplifiedTaxTable.rows.length === 0;

export function SalarySeniorCalculator() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<SalarySeniorResult | null>(null);

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
    reset,
  } = useForm<SalarySeniorFormInput, unknown, SalarySeniorFormValues>({
    resolver: zodResolver(salarySeniorFormSchema),
    defaultValues: salarySeniorFormDefaults,
    mode: "onSubmit",
  });

  const restart = () => {
    reset(salarySeniorFormDefaults);
    setResult(null);
    setStep(0);
  };

  const back = () => (step === 0 ? undefined : setStep(step - 1));

  const next = async (fields: (keyof SalarySeniorFormInput)[], after?: () => void) => {
    if (await trigger(fields)) (after ?? (() => setStep(step + 1)))();
  };

  const finish = () => {
    // trigger 통과 후이므로 parse 는 항상 성공 — coerce(문자열→숫자)를 여기서 확정한다.
    const values = salarySeniorFormSchema.parse(getValues());
    const r = computeSalarySenior(toEngineInput(values), insuranceRules, simplifiedTaxTable);
    setResult(r);
    track({ name: "calc_complete", params: { tool: "salary-senior" } });
  };

  if (result) {
    return <ResultView result={result} onRestart={restart} />;
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {step === 0 ? (
        <StepShell
          step={0}
          total={TOTAL_STEPS}
          title="나이가 어떻게 되세요?"
          help="주민등록상 만 나이 기준이에요. 60세부터는 국민연금 보험료를 떼지 않아서 실수령이 달라져요."
          onNext={() => next(["age"])}
        >
          <MoneyField
            label="만 나이"
            unit="세"
            help="예: 62"
            error={errors.age?.message}
            inputProps={register("age")}
          />
        </StepShell>
      ) : null}

      {step === 1 ? (
        <StepShell
          step={1}
          total={TOTAL_STEPS}
          title="세전 월급이 얼마예요?"
          help="세금과 보험료를 떼기 전 금액이에요. 만원 단위로 적어 주세요 — 월 300만원이면 300."
          onBack={back}
          onNext={() => next(["salaryMan"])}
        >
          <MoneyField
            label="월급 (세전)"
            help="예: 300"
            error={errors.salaryMan?.message}
            inputProps={register("salaryMan")}
          />
        </StepShell>
      ) : null}

      {step === 2 ? (
        <StepShell
          step={2}
          total={TOTAL_STEPS}
          title="부양가족은 몇 명이에요?"
          help="본인을 포함해서 세어 주세요. 혼자면 1명이에요. 소득세(간이세액표) 계산에 쓰는 값이에요."
          onBack={back}
          onNext={() => next(["dependents"], finish)}
          nextLabel="결과 보기"
        >
          <MoneyField
            label="부양가족 수 (본인 포함)"
            unit="명"
            error={errors.dependents?.message}
            inputProps={register("dependents")}
          />
        </StepShell>
      ) : null}
    </form>
  );
}

function ResultView({
  result,
  onRestart,
}: {
  result: SalarySeniorResult;
  onRestart: () => void;
}) {
  const r = result;
  // 표 미수록 상태에서는 "실수령액"으로 단정하지 않는다 — 소득세 반영 전임을 헤드라인에 명시.
  const headline = taxPending
    ? `4대보험 공제 후 월 ${won(r.net)} — 소득세 반영 전`
    : `예상 실수령액 — 월 ${won(r.net)}`;

  return (
    <div>
      <ResultCard tool="salary-senior" headline={headline}>
        <table className="table mt-4">
          <tbody>
            <tr>
              <td>월급 (세전)</td>
              <td className="num">{won(r.gross)}</td>
            </tr>
            <tr>
              <td>국민연금</td>
              <td className="num">{won(r.nationalPension)}</td>
            </tr>
            <tr>
              <td>건강보험</td>
              <td className="num">{won(r.health)}</td>
            </tr>
            <tr>
              <td>장기요양보험</td>
              <td className="num">{won(r.longTermCare)}</td>
            </tr>
            <tr>
              <td>고용보험</td>
              <td className="num">{won(r.employment)}</td>
            </tr>
            <tr>
              <td>소득세</td>
              <td className="num">{taxPending ? "표 수록 전" : won(r.incomeTax)}</td>
            </tr>
            {r.localTax > 0 ? (
              <tr>
                <td>지방소득세</td>
                <td className="num">{won(r.localTax)}</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">공제 합계</th>
              <td className="num">
                <strong>{won(r.totalDeduction)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        {r.notes.map((note) => (
          <p key={note} className="t-body mt-3 mb-0">
            {note}
          </p>
        ))}
      </ResultCard>

      <Disclaimer>
        실제 공제액은 회사의 신고 내용과 연말정산에 따라 달라질 수 있습니다.
      </Disclaimer>

      <div className="no-print mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn" onClick={onRestart}>
          다시 계산하기
        </button>
        <Link href="/severance-tax/" className="btn btn-ghost">
          퇴직금은 어떻게 받는 게 유리할까요?
        </Link>
      </div>
    </div>
  );
}
