"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import type { BasicPensionResult } from "@contracts/shared-types";
import { Disclaimer } from "@/components/Disclaimer";
import { ResultCard } from "@/components/ResultCard";
import { ChoiceGroup, MoneyField, StepShell } from "@/components/wizard";
import { basicPensionRules } from "@/data/rules";
import { track } from "@/lib/analytics";
import { won } from "@/lib/format";
import { computeBasicPension } from "../engine";
import {
  basicPensionFormDefaults,
  basicPensionFormSchema,
  toEngineInput,
  type BasicPensionFormInput,
  type BasicPensionFormValues,
} from "../schema";

const TOTAL_STEPS = 7;
type Terminal = "ageNotYet" | "occupational" | null;

export function BasicPensionCalculator() {
  const [step, setStep] = useState(0);
  const [terminal, setTerminal] = useState<Terminal>(null);
  const [result, setResult] = useState<BasicPensionResult | null>(null);
  const rules = basicPensionRules;

  const {
    register,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
    reset,
  } = useForm<BasicPensionFormInput, unknown, BasicPensionFormValues>({
    resolver: zodResolver(basicPensionFormSchema),
    defaultValues: basicPensionFormDefaults,
    mode: "onSubmit",
  });

  const household = watch("household");
  const occupational = watch("occupational");
  const region = watch("region");
  const hasLuxury = watch("hasLuxury");
  const hasFreeRent = watch("hasFreeRent");
  const couple = household === "couple";

  const restart = () => {
    reset(basicPensionFormDefaults);
    setTerminal(null);
    setResult(null);
    setStep(0);
  };

  const back = () => (step === 0 ? undefined : setStep(step - 1));

  const next = async (fields: (keyof BasicPensionFormInput)[], after?: () => void) => {
    if (await trigger(fields)) (after ?? (() => setStep(step + 1)))();
  };

  const finish = () => {
    // trigger 통과 후이므로 parse 는 항상 성공 — coerce(문자열→숫자)를 여기서 확정한다.
    const values = basicPensionFormSchema.parse(getValues());
    const r = computeBasicPension(toEngineInput(values), rules);
    setResult(r);
    track({ name: "calc_complete", params: { tool: "basic-pension" } });
  };

  // ---- 종료 화면 (문답 0단계 분기 — TOOL_SPEC) ----
  if (terminal === "ageNotYet") {
    return (
      <TerminalNotice
        title="아직 신청 시기가 아니에요"
        body={`기초연금은 만 ${rules.eligibility.ageMin}세부터 받을 수 있어요. 만 ${rules.eligibility.ageMin}세 생일이 있는 달의 한 달 전부터 신청할 수 있으니, 그때 다시 계산해 보세요.`}
        onRestart={restart}
      />
    );
  }
  if (terminal === "occupational") {
    return (
      <TerminalNotice
        title="직역연금을 받으시면 대상이 아니에요"
        body="공무원·사학·군인·별정우체국 연금을 받는 분(배우자 포함)은 기초연금 대상에서 제외돼요. 다만 연계연금(직역 기간 10년 미만)이거나 일시금을 받고 5년이 지난 경우 등 예외가 있으니, 해당된다면 국민연금공단(1355)에 확인해 보세요."
        onRestart={restart}
      />
    );
  }

  // ---- 결과 화면 ----
  if (result) {
    return <ResultView result={result} onRestart={restart} couple={couple} />;
  }

  // ---- 문답 7단계 ----
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {step === 0 ? (
        <StepShell
          step={0}
          total={TOTAL_STEPS}
          title="나이와 연금 종류를 확인할게요"
          onNext={() =>
            next(["birthYear", "occupational"], () => {
              if (getValues("occupational") === "yes") setTerminal("occupational");
              else if (rules._meta.year - Number(getValues("birthYear")) < rules.eligibility.ageMin)
                setTerminal("ageNotYet");
              else setStep(1);
            })
          }
        >
          <MoneyField
            label="출생연도"
            unit="년"
            help="예: 1958"
            error={errors.birthYear?.message}
            inputProps={register("birthYear")}
          />
          <p className="t-h4 mb-2">공무원·군인·사학연금을 받고 계세요? (배우자 포함)</p>
          <ChoiceGroup
            options={[
              { value: "no", label: "아니요" },
              { value: "yes", label: "예", desc: "직역연금 수급자는 대상에서 제외돼요" },
            ]}
            value={occupational}
            onChange={(v) => setValue("occupational", v)}
          />
        </StepShell>
      ) : null}

      {step === 1 ? (
        <StepShell step={1} total={TOTAL_STEPS} title="혼자세요, 부부세요?" onBack={back} onNext={() => next(["household"])}>
          <ChoiceGroup
            options={[
              { value: "single", label: "혼자예요", desc: "배우자가 없거나 사별·이혼" },
              { value: "couple", label: "부부예요", desc: "배우자 소득·재산도 함께 계산해요" },
            ]}
            value={household}
            onChange={(v) => setValue("household", v)}
          />
        </StepShell>
      ) : null}

      {step === 2 ? (
        <StepShell
          step={2}
          total={TOTAL_STEPS}
          title="어디에 사세요?"
          help="사는 곳에 따라 재산에서 빼 주는 금액(기본재산 공제)이 달라져요."
          onBack={back}
          onNext={() => next(["region"])}
        >
          <ChoiceGroup
            options={[
              { value: "metro", label: "대도시", desc: "서울·부산·대구·인천·광주·대전·울산, 세종, 경기도의 시" },
              { value: "city", label: "중소도시", desc: "그 외 도의 시 지역 (예: 춘천시·전주시·포항시)" },
              { value: "rural", label: "농어촌", desc: "군 지역 (예: 홍천군·해남군)" },
            ]}
            value={region}
            onChange={(v) => setValue("region", v)}
          />
        </StepShell>
      ) : null}

      {step === 3 ? (
        <StepShell
          step={3}
          total={TOTAL_STEPS}
          title="일해서 버는 돈이 있으세요?"
          help="세전 월급 기준이에요. 일하는 소득에는 기본 공제가 있어서 실제보다 적게 계산돼요 — 공제는 자동으로 해 드려요."
          onBack={back}
          onNext={() => next(["laborSelf", "laborSpouse"])}
        >
          <MoneyField
            label={couple ? "본인 근로소득 (월)" : "근로소득 (월)"}
            error={errors.laborSelf?.message}
            onNone={() => setValue("laborSelf", 0)}
            inputProps={register("laborSelf")}
          />
          {couple ? (
            <MoneyField
              label="배우자 근로소득 (월)"
              error={errors.laborSpouse?.message}
              onNone={() => setValue("laborSpouse", 0)}
              inputProps={register("laborSpouse")}
            />
          ) : null}
        </StepShell>
      ) : null}

      {step === 4 ? (
        <StepShell
          step={4}
          total={TOTAL_STEPS}
          title="연금이나 다른 소득이 있으세요?"
          help="국민연금은 매달 받는 금액 그대로 적어 주세요."
          onBack={back}
          onNext={() => next(["npsSelf", "npsSpouse", "otherIncome", "interestIncome"])}
        >
          <MoneyField
            label={couple ? "본인 국민연금 (월)" : "국민연금 (월)"}
            error={errors.npsSelf?.message}
            onNone={() => setValue("npsSelf", 0)}
            inputProps={register("npsSelf")}
          />
          {couple ? (
            <MoneyField
              label="배우자 국민연금 (월)"
              error={errors.npsSpouse?.message}
              onNone={() => setValue("npsSpouse", 0)}
              inputProps={register("npsSpouse")}
            />
          ) : null}
          <MoneyField
            label="사업·임대소득 (월)"
            error={errors.otherIncome?.message}
            onNone={() => setValue("otherIncome", 0)}
            inputProps={register("otherIncome")}
          />
          <MoneyField
            label="이자소득 (월)"
            help="예금 이자 등. 매달 4만원까지는 빼고 계산해요."
            error={errors.interestIncome?.message}
            onNone={() => setValue("interestIncome", 0)}
            inputProps={register("interestIncome")}
          />
        </StepShell>
      ) : null}

      {step === 5 ? (
        <StepShell
          step={5}
          total={TOTAL_STEPS}
          title="재산을 알려주세요"
          help="정확히 몰라도 괜찮아요 — 대략적인 금액이면 됩니다."
          onBack={back}
          onNext={() => next(["generalAssets", "rentDeposit", "financialAssets", "debts"])}
        >
          <MoneyField
            label="집·땅 등 재산 (시가표준액)"
            help="아파트는 공시가격 기준이에요. 실거래가보다 낮은 경우가 많아요."
            error={errors.generalAssets?.message}
            onNone={() => setValue("generalAssets", 0)}
            inputProps={register("generalAssets")}
          />
          <MoneyField
            label="전월세 보증금"
            help="5%를 뺀 95%가 재산으로 계산돼요."
            error={errors.rentDeposit?.message}
            onNone={() => setValue("rentDeposit", 0)}
            inputProps={register("rentDeposit")}
          />
          <MoneyField
            label="예금 등 금융재산"
            help="2,000만원까지는 빼고 계산해요."
            error={errors.financialAssets?.message}
            onNone={() => setValue("financialAssets", 0)}
            inputProps={register("financialAssets")}
          />
          <MoneyField
            label="부채 (대출 등)"
            error={errors.debts?.message}
            onNone={() => setValue("debts", 0)}
            inputProps={register("debts")}
          />
        </StepShell>
      ) : null}

      {step === 6 ? (
        <StepShell
          step={6}
          total={TOTAL_STEPS}
          title="마지막으로 확인할게요"
          onBack={back}
          onNext={() =>
            next(["luxuryCar", "membership", "freeRentPrice"], finish)
          }
          nextLabel="결과 보기"
        >
          <p className="t-h4 mb-2">4천만원 이상 자동차나 골프 회원권 등이 있으세요?</p>
          <ChoiceGroup
            options={[
              { value: "no", label: "아니요" },
              { value: "yes", label: "예", desc: "가액 전체가 매달 소득으로 계산돼요" },
            ]}
            value={hasLuxury ? "yes" : "no"}
            onChange={(v) => setValue("hasLuxury", v === "yes")}
          />
          {hasLuxury ? (
            <>
              <MoneyField
                label="자동차 가액"
                error={errors.luxuryCar?.message}
                onNone={() => setValue("luxuryCar", 0)}
                inputProps={register("luxuryCar")}
              />
              <MoneyField
                label="회원권 가액"
                error={errors.membership?.message}
                onNone={() => setValue("membership", 0)}
                inputProps={register("membership")}
              />
            </>
          ) : null}
          <p className="t-h4 mb-2 mt-6">자녀 명의의 6억원 이상 집에 살고 계세요?</p>
          <ChoiceGroup
            options={[
              { value: "no", label: "아니요" },
              { value: "yes", label: "예", desc: "무료임차소득이 더해져요" },
            ]}
            value={hasFreeRent ? "yes" : "no"}
            onChange={(v) => setValue("hasFreeRent", v === "yes")}
          />
          {hasFreeRent ? (
            <MoneyField
              label="그 집의 시가표준액"
              error={errors.freeRentPrice?.message}
              inputProps={register("freeRentPrice")}
            />
          ) : null}
        </StepShell>
      ) : null}
    </form>
  );
}

function TerminalNotice({
  title,
  body,
  onRestart,
}: {
  title: string;
  body: string;
  onRestart: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6 sm:p-8">
      <h2 className="t-h2 mt-0">{title}</h2>
      <p className="t-body-l">{body}</p>
      <button type="button" className="btn mt-4" onClick={onRestart}>
        처음부터 다시
      </button>
    </div>
  );
}

function ResultView({
  result,
  couple,
  onRestart,
}: {
  result: BasicPensionResult;
  couple: boolean;
  onRestart: () => void;
}) {
  const r = result;
  const headline =
    r.verdict === "eligible"
      ? `받으실 가능성이 높아요 — 예상 ${couple ? "부부 합산 " : ""}월 ${won(r.estimatedMonthly ?? 0)}`
      : `아쉽지만 기준을 넘어요 — 소득인정액이 기준보다 ${won(r.recognizedIncome - r.criterion)} 많아요`;

  return (
    <div>
      <ResultCard tool="basic-pension" headline={headline}>
        <details className="mt-4">
          <summary className="t-h4 min-h-12 cursor-pointer py-2">계산 근거 보기</summary>
          <table className="table mt-2">
            <tbody>
              <tr>
                <td>일해서 버는 돈 (공제 후)</td>
                <td className="num">{won(r.breakdown.laborEvaluated)}</td>
              </tr>
              <tr>
                <td>연금·기타 소득</td>
                <td className="num">{won(r.breakdown.otherIncome)}</td>
              </tr>
              {r.breakdown.freeRentIncome > 0 ? (
                <tr>
                  <td>무료임차소득</td>
                  <td className="num">{won(r.breakdown.freeRentIncome)}</td>
                </tr>
              ) : null}
              <tr>
                <td>재산을 소득으로 환산한 금액</td>
                <td className="num">{won(r.assetConverted)}</td>
              </tr>
              <tr>
                <th scope="row">소득인정액 (합계)</th>
                <td className="num">
                  <strong>{won(r.recognizedIncome)}</strong>
                </td>
              </tr>
              <tr>
                <td>선정기준액 ({couple ? "부부" : "단독"} 가구)</td>
                <td className="num">{won(r.criterion)}</td>
              </tr>
            </tbody>
          </table>
          <p className="t-body mt-2">
            소득인정액 = 소득과 재산을 월 소득으로 환산해 합친 금액이에요. 이 금액이
            선정기준액 이하면 받을 수 있어요.
          </p>
        </details>
      </ResultCard>

      {/* 해석 (TOOL_SPEC 결과 3) */}
      <div className="mt-6">
        {r.verdict === "eligible" ? (
          <>
            <p className="t-body-l">
              신청은 <strong>주소지 주민센터</strong> 또는{" "}
              <strong>복지로(bokjiro.go.kr)</strong>에서 할 수 있어요. 만 65세 생일이 있는 달의
              한 달 전부터 신청 가능해요.
            </p>
            {r.npsLink === "mayReduce" ? (
              <p className="t-body-l">
                국민연금을 월 52만원 넘게 받고 계셔서 <strong>연계 감액이 있을 수
                있어요</strong>. 정확한 금액은 국민연금공단(1355)에서 확인해 주세요.
              </p>
            ) : null}
            {r.incomeReversalApplied ? (
              <p className="t-body-l">
                소득이 기준에 가까워서 <strong>일부 금액만</strong> 받게 계산됐어요 (소득역전방지
                감액).
              </p>
            ) : null}
          </>
        ) : (
          <p className="t-body-l">
            선정기준액은 해마다 오르는 추세예요. 지금은 기준을 넘지만{" "}
            <strong>내년 기준이 오르면 달라질 수 있으니</strong> 새해에 다시 계산해 보세요.
          </p>
        )}
      </div>

      <Disclaimer>실제 수급 여부와 금액은 국민연금공단 심사에 따라 달라질 수 있습니다.</Disclaimer>

      <div className="no-print mt-6 flex gap-3">
        <button type="button" className="btn" onClick={onRestart}>
          다시 계산하기
        </button>
        <Link href="/guide/" className="btn btn-ghost">
          기초연금 가이드 보기
        </Link>
      </div>
    </div>
  );
}
