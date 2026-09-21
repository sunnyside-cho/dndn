"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InsuranceItem, InsuranceRateResult } from "@contracts/shared-types";
import { Disclaimer } from "@/components/Disclaimer";
import { ResultCard } from "@/components/ResultCard";
import { ChoiceGroup, MoneyField, StepShell } from "@/components/wizard";
import { insuranceRules, nextYearRates } from "@/data/rules";
import { track } from "@/lib/analytics";
import { won, wonDiff } from "@/lib/format";
import { computeInsuranceDiff } from "../engine";
import {
  insuranceRateFormDefaults,
  insuranceRateFormSchema,
  toEngineInput,
  type InsuranceRateFormInput,
  type InsuranceRateFormValues,
} from "../schema";

const ITEM_LABEL: Record<InsuranceItem, string> = {
  nationalPension: "국민연금",
  health: "건강보험",
  longTermCare: "장기요양",
  employment: "고용보험",
};

// 입력 1개 철학 (TOOL_SPEC "시즌 무기") — 화면 1: 월급 + 60세 여부 → [계산하기]
export function InsuranceRateCalculator() {
  const [result, setResult] = useState<InsuranceRateResult | null>(null);

  const {
    register,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
    reset,
  } = useForm<InsuranceRateFormInput, unknown, InsuranceRateFormValues>({
    resolver: zodResolver(insuranceRateFormSchema),
    defaultValues: insuranceRateFormDefaults,
    mode: "onSubmit",
  });

  const age60 = watch("age60");

  const restart = () => {
    reset(insuranceRateFormDefaults);
    setResult(null);
  };

  const finish = async () => {
    if (!(await trigger(["salary", "age60"]))) return;
    // trigger 통과 후이므로 parse 는 항상 성공 — coerce(문자열→숫자)를 여기서 확정한다.
    const values = insuranceRateFormSchema.parse(getValues());
    const r = computeInsuranceDiff(toEngineInput(values), insuranceRules, nextYearRates);
    setResult(r);
    track({ name: "calc_complete", params: { tool: "insurance-rate" } });
  };

  if (result) {
    return <ResultView result={result} nextYear={nextYearRates.year} onRestart={restart} />;
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <StepShell
        step={0}
        total={1}
        title="세전 월급을 알려주세요"
        help="세금·보험료를 떼기 전 금액이에요. 대략적인 금액이면 됩니다."
        onNext={finish}
        nextLabel="계산하기"
      >
        <MoneyField
          label="세전 월급"
          help="예: 300"
          error={errors.salary?.message}
          inputProps={register("salary")}
        />
        <p className="t-h4 mb-2">60세 이상이세요?</p>
        <ChoiceGroup
          options={[
            { value: "no", label: "아니요" },
            { value: "yes", label: "예", desc: "60세 이상은 국민연금 공제가 없어요" },
          ]}
          value={age60}
          onChange={(v) => setValue("age60", v)}
        />
      </StepShell>
    </form>
  );
}

function ResultView({
  result,
  nextYear,
  onRestart,
}: {
  result: InsuranceRateResult;
  nextYear: number;
  onRestart: () => void;
}) {
  const r = result;
  const pendingLabels = r.rows
    .filter((row) => row.nextMonthly === null)
    .map((row) => ITEM_LABEL[row.item]);

  const headline =
    r.totalDiffMonthly > 0
      ? `${r.partial ? "지금까지 확정된 인상분만으로 " : ""}내년엔 월 ${won(r.totalDiffMonthly)} 더 냅니다 (연 ${won(r.totalDiffAnnual)})`
      : r.totalDiffMonthly === 0
        ? "지금까지 확정된 기준으로는 내년 공제액이 지금과 같아요"
        : `${r.partial ? "지금까지 확정된 기준으로 " : ""}내년엔 월 ${won(-r.totalDiffMonthly)} 덜 냅니다`;

  return (
    <div>
      <ResultCard tool="insurance-rate" headline={headline}>
        {pendingLabels.length > 0 ? (
          <p className="t-body-l mt-2 mb-0">{pendingLabels.join("·")}은 12월 발표 예정이에요.</p>
        ) : null}
        <table className="table mt-4">
          <thead>
            <tr>
              <th>항목</th>
              <th className="num">올해</th>
              <th className="num">내년({nextYear})</th>
              <th className="num">차액</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.item}>
                <td>
                  {ITEM_LABEL[row.item]}
                  {row.note && row.nextMonthly !== null ? (
                    <span className="t-caption block">{row.note}</span>
                  ) : null}
                </td>
                <td className="num">{won(row.currentMonthly)}</td>
                <td className="num">
                  {row.nextMonthly === null ? (row.note ?? "12월 발표 예정") : won(row.nextMonthly)}
                </td>
                <td className="num">{row.diffMonthly === null ? "—" : wonDiff(row.diffMonthly)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">합계</th>
              <td className="num">
                <strong>{won(r.totalCurrent)}</strong>
              </td>
              <td className="num">
                <strong>{won(r.totalNext)}</strong>
                {r.partial ? <span className="t-caption block font-normal">확정분 기준</span> : null}
              </td>
              <td className="num">
                <strong>{wonDiff(r.totalDiffMonthly)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        {r.partial ? (
          <p className="t-body mt-3 mb-0">
            미발표 항목은 올해 값 그대로 합산했어요 — 12월 발표에 따라 차액이 더 커질 수 있어요.
          </p>
        ) : null}
        <p className="t-caption mt-3 mb-0">이 표는 발표 즉시 갱신됩니다.</p>
      </ResultCard>

      <Disclaimer>
        실제 공제액은 회사가 신고한 보수월액과 연말 정산에 따라 달라질 수 있습니다.
      </Disclaimer>

      <div className="no-print mt-6 flex gap-3">
        <button type="button" className="btn" onClick={onRestart}>
          다시 계산하기
        </button>
      </div>
    </div>
  );
}
