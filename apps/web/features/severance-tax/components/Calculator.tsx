"use client";
import { useState, type InputHTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import type { SeveranceResult, SeveranceRules } from "@contracts/shared-types";
import { AffiliateSlot } from "@/components/AffiliateSlot";
import { Disclaimer } from "@/components/Disclaimer";
import { OfficialLink } from "@/components/OfficialLink";
import { ResultCard } from "@/components/ResultCard";
import { ChoiceGroup, MoneyField, StepShell } from "@/components/wizard";
import { severanceRules } from "@/data/rules";
import { track } from "@/lib/analytics";
import { won, wonKorean } from "@/lib/format";
import { computeSeverance } from "../engine";
import {
  severanceFormDefaults,
  severanceFormSchema,
  toEngineInput,
  type SeveranceFormInput,
  type SeveranceFormValues,
} from "../schema";

const TOTAL_STEPS = 3;

/** 로컬(KST) 오늘 날짜 — toISOString 은 UTC 라 자정 전후 하루가 어긋난다 */
function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SeveranceCalculator() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<SeveranceResult | null>(null);
  // 퇴직예정일이 미래(V-4): "예정 기준 시뮬레이션" 배지 + 55세 미만 IRP 제약 안내 분기
  const [futureLeave, setFutureLeave] = useState(false);
  const rules = severanceRules;

  const {
    register,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
    reset,
  } = useForm<SeveranceFormInput, unknown, SeveranceFormValues>({
    resolver: zodResolver(severanceFormSchema),
    defaultValues: severanceFormDefaults,
    mode: "onSubmit",
  });

  const receiveType = watch("receiveType");

  const restart = () => {
    reset(severanceFormDefaults);
    setResult(null);
    setFutureLeave(false);
    setStep(0);
  };

  const back = () => (step === 0 ? undefined : setStep(step - 1));

  const next = async (fields: (keyof SeveranceFormInput)[], after?: () => void) => {
    if (await trigger(fields)) (after ?? (() => setStep(step + 1)))();
  };

  const finish = () => {
    // trigger 통과 후이므로 parse 는 항상 성공 — coerce(문자열→숫자)를 여기서 확정한다.
    const values = severanceFormSchema.parse(getValues());
    const r = computeSeverance(toEngineInput(values), rules);
    setFutureLeave(values.leaveDate > localTodayIso());
    setResult(r);
    track({ name: "calc_complete", params: { tool: "severance-tax" } });
  };

  if (result) {
    return <ResultView result={result} rules={rules} futureLeave={futureLeave} onRestart={restart} />;
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {step === 0 ? (
        <StepShell
          step={0}
          total={TOTAL_STEPS}
          title="퇴직금이 얼마인가요?"
          help="세전 금액 기준이에요. 정확히 몰라도 대략적인 금액이면 됩니다."
          onNext={() => next(["severanceMan"])}
        >
          <MoneyField
            label="예상 퇴직금 (세전)"
            help="회사에서 알려준 예상 퇴직금"
            error={errors.severanceMan?.message}
            inputProps={register("severanceMan")}
          />
        </StepShell>
      ) : null}

      {step === 1 ? (
        <StepShell
          step={1}
          total={TOTAL_STEPS}
          title="언제부터 언제까지 일하셨나요?"
          help="근속연수는 자동으로 계산해 드려요 — 1년 미만은 1년으로 올려서 계산합니다. 중간정산을 받으셨다면 정산 이후 날짜부터 적어 주세요. 아직 퇴직 전이면 예정일을 넣어 주세요 — 예정 기준으로 계산해 드려요."
          onBack={back}
          onNext={() => next(["joinDate", "leaveDate"])}
        >
          <DateField
            label="입사일"
            error={errors.joinDate?.message}
            inputProps={register("joinDate")}
          />
          <DateField
            label="퇴직일 (예정일)"
            error={errors.leaveDate?.message}
            inputProps={register("leaveDate")}
          />
        </StepShell>
      ) : null}

      {step === 2 ? (
        <StepShell
          step={2}
          total={TOTAL_STEPS}
          title="어떻게 받을 생각이세요?"
          help="아직 정하지 않으셨어도 괜찮아요 — 두 경우의 세금을 나란히 비교해 드려요."
          onBack={back}
          onNext={() => next(["receiveType"], finish)}
          nextLabel="결과 보기"
        >
          <ChoiceGroup
            options={[
              { value: "lump", label: "일시금으로 받을래요" },
              {
                value: "irp",
                label: "IRP 연금으로 받을래요",
                desc: "연금으로 나눠 받으면 세금 감면이 있어요",
              },
              {
                value: "unknown",
                label: "아직 모르겠어요",
                desc: "두 경우를 비교해서 보여 드려요",
              },
            ]}
            value={receiveType}
            onChange={(v) => setValue("receiveType", v)}
          />
        </StepShell>
      ) : null}
    </form>
  );
}

// 날짜 입력 — MoneyField 가 아닌 input[type=date] + .input (design-guide 입력 높이 규격 공유)
function DateField({
  label,
  help,
  error,
  inputProps,
}: {
  label: string;
  help?: string;
  error?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}) {
  const id = `date-${String(inputProps.name)}`;
  return (
    <div className="mb-6">
      <label htmlFor={id} className="t-h4 block">
        {label}
      </label>
      {help ? <p className="t-body mt-1 mb-2">{help}</p> : null}
      <input id={id} type="date" className="input mt-2 w-full" {...inputProps} />
      {error ? (
        <p role="alert" className="t-body mt-2 mb-0 font-semibold text-[var(--text-primary)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ResultView({
  result,
  rules,
  futureLeave,
  onRestart,
}: {
  result: SeveranceResult;
  rules: SeveranceRules;
  futureLeave: boolean;
  onRestart: () => void;
}) {
  const r = result;
  const discountRows = rules.irp.pensionDiscount.rows;
  const longest = r.irpOptions[r.irpOptions.length - 1];
  const localPct = Math.round(rules.localTaxRate.value * 100);

  const headline =
    r.totalTaxLump === 0
      ? "이 조건에서는 퇴직소득세가 0원으로 계산돼요"
      : `일시금으로 받으면 세금 약 ${wonKorean(r.totalTaxLump)} — IRP로 ${longest.label.replace(" 수령", "")}에 나눠 받으면 약 ${wonKorean(longest.totalTax)} (${wonKorean(longest.saving)} 절세)`;

  return (
    <div>
      <ResultCard
        tool="severance-tax"
        timeBadge={futureLeave ? "예정 기준 시뮬레이션" : `${rules._meta.year}년 기준`}
        headline={headline}
      >
        {futureLeave ? (
          <p className="t-body-l mb-0 mt-1">
            아직 퇴직 전이시네요 — 입력하신 <strong>퇴직 예정일</strong>과 지금(
            {rules._meta.year}년) 세법 기준의 시뮬레이션이에요. 실제 세액은 퇴직하는 해의
            법령으로 정산돼요. 퇴직 시점에 <strong>만 55세 미만</strong>이라면 퇴직금은 IRP 등
            연금계좌로 의무이체되고, 연금 개시는 만 55세부터 신청할 수 있어요.
          </p>
        ) : null}
        <details className="mt-4">
          <summary className="t-h4 min-h-12 cursor-pointer py-2">계산 근거 보기</summary>
          <table className="table mt-2">
            <tbody>
              <tr>
                <td>근속연수 (1년 미만 올림)</td>
                <td className="num">{r.serviceYears}년</td>
              </tr>
              <tr>
                <td>근속연수공제</td>
                <td className="num">{won(r.serviceYearDeduction)}</td>
              </tr>
              <tr>
                <td>환산급여 (공제 후 ÷ 근속연수 × 12)</td>
                <td className="num">{won(r.convertedSalary)}</td>
              </tr>
              <tr>
                <td>환산급여공제</td>
                <td className="num">{won(r.convertedSalaryDeduction)}</td>
              </tr>
              <tr>
                <td>과세표준</td>
                <td className="num">{won(r.taxBase)}</td>
              </tr>
              <tr>
                <td>환산산출세액 (기본세율 적용)</td>
                <td className="num">{won(r.convertedTax)}</td>
              </tr>
              <tr>
                <td>퇴직소득세 (÷ 12 × 근속연수)</td>
                <td className="num">{won(r.incomeTax)}</td>
              </tr>
              <tr>
                <td>지방소득세 ({localPct}%)</td>
                <td className="num">{won(r.localTax)}</td>
              </tr>
              <tr>
                <th scope="row">일시금 총 세금</th>
                <td className="num">
                  <strong>{won(r.totalTaxLump)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="t-body mt-2">
            환산급여 = 퇴직금에서 근속연수공제를 뺀 뒤 1년치 급여로 바꿔 본 금액이에요. 세율을
            매긴 다음 다시 근속연수만큼 되돌리기 때문에, 오래 일할수록 세금이 줄어드는
            구조입니다. 지방소득세 {localPct}%가 포함된 금액이에요 (지방소득세율은 재확인
            중입니다).
          </p>
        </details>
      </ResultCard>

      {/* 비교표: 일시금 vs IRP 감면율별 3열 + 차액 강조 (TOOL_SPEC 결과 화면) */}
      <section className="mt-8">
        <h3 className="t-h3">일시금 vs IRP 연금 비교</h3>
        <div className="overflow-x-auto">
          <table className="table mt-3">
            <thead>
              <tr>
                <th>구분</th>
                <th className="num">일시금</th>
                {r.irpOptions.map((o) => (
                  <th key={o.label} className="num">
                    IRP {o.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>실효 감면율</td>
                <td className="num">없음</td>
                {r.irpOptions.map((o) => (
                  <td key={o.label} className="num">
                    약 {Math.round((1 - o.payRate) * 100)}%
                  </td>
                ))}
              </tr>
              <tr>
                <td>총 세금</td>
                <td className="num">{won(r.totalTaxLump)}</td>
                {r.irpOptions.map((o) => (
                  <td key={o.label} className="num">
                    {won(o.totalTax)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>실수령액</td>
                <td className="num">{won(r.netLump)}</td>
                {r.irpOptions.map((o) => (
                  <td key={o.label} className="num">
                    {won(o.net)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">일시금 대비 절세액</th>
                <td className="num">—</td>
                {r.irpOptions.map((o) => (
                  <td key={o.label} className="num">
                    <strong>{won(o.saving)}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="t-body mt-2">
          감면은 수령 <strong>연차별</strong>로 적용돼요 —{" "}
          {discountRows
            .map((row, i) => {
              const from = i === 0 ? 1 : (discountRows[i - 1].yearsMax ?? 0) + 1;
              const range = row.yearsMax === null ? `${from}년차부터` : `${from}~${row.yearsMax}년차`;
              return `${range} ${Math.round((1 - row.payRate) * 100)}%`;
            })
            .join(" · ")}
          . 위 표는 해마다 같은 금액을 받는다고 가정했을 때의 실효 감면율이며, 실제 유불리는
          수령 방식·운용 수익 등 개인 상황에 따라 달라질 수 있어요.
        </p>
      </section>

      {/* 해석 (TOOL_SPEC 결과 3) */}
      <section className="mt-8">
        <h3 className="t-h3">함께 알아두세요</h3>
        <ul className="t-body-l">
          <li>
            <strong>55세 미만에 퇴직하시면</strong> 퇴직금은 원칙적으로 IRP 등 연금계좌로
            이체받게 되어 있어요(의무이체). 이때는 세금을 떼지 않고 이체되고, 나중에 찾는
            방식에 따라 세금이 정해져요.
          </li>
          <li>
            IRP 연금은 <strong>55세 이후</strong>에 개시를 신청할 수 있어요. 퇴직금을 이연해
            넣은 경우에는 &lsquo;가입 5년&rsquo; 요건이 면제됩니다.
          </li>
          <li>
            <strong>IRP를 중간에 해지하거나 일시금으로 찾으면</strong> 미뤄 둔 퇴직소득세를
            감면 없이 전부 내게 돼요 — 위 절세액은 연금으로 끝까지 받는 경우의 계산입니다.
          </li>
        </ul>
      </section>

      <AffiliateSlot
        tool="severance-tax"
        campaign="irp-open"
        href="#"
        label="IRP 계좌 비교해보기"
      />

      <OfficialLink tool="severance-tax" />

      <Disclaimer>
        실제 세액은 퇴직 시점의 법령과 원천징수 정산에 따라 달라질 수 있습니다.
      </Disclaimer>

      <div className="no-print mt-6 flex gap-3">
        <button type="button" className="btn" onClick={onRestart}>
          다시 계산하기
        </button>
        <Link href="/guide/" className="btn btn-ghost">
          퇴직금 가이드 보기
        </Link>
      </div>
    </div>
  );
}
