"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import type { DependentResult } from "@contracts/shared-types";
import { Disclaimer } from "@/components/Disclaimer";
import { OfficialLink } from "@/components/OfficialLink";
import { ResultCard } from "@/components/ResultCard";
import { ChoiceGroup, MoneyField, StepShell } from "@/components/wizard";
import { dependentRules } from "@/data/rules";
import { track } from "@/lib/analytics";
import { won, wonKorean } from "@/lib/format";
import { checkDependent, estimateRegionalPremium } from "../engine";
import {
  dependentFormDefaults,
  dependentFormSchema,
  toEngineInput,
  toPremiumInput,
  type DependentFormInput,
  type DependentFormValues,
} from "../schema";

// F-03 문답형 7단계 (TOOL_SPEC v1.1 — 0단계 시점 선택 신설, REVIEW V-3) — 탈락 사유가
// 중간에 확정돼도 끝까지 진행한다: 보험료 추정("탈락하면 얼마 내나")에 소득·재산 입력이 필요하기 때문.
const TOTAL_STEPS = 7;

export function DependentCheckCalculator() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<DependentResult | null>(null);
  const rules = dependentRules;

  const {
    register,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
    reset,
  } = useForm<DependentFormInput, unknown, DependentFormValues>({
    resolver: zodResolver(dependentFormSchema),
    defaultValues: dependentFormDefaults,
    mode: "onSubmit",
  });

  const basis = watch("basis");
  const supporter = watch("supporter");
  const bizRegistered = watch("bizRegistered");
  const bizIncomeRegistered = watch("bizIncomeRegistered");
  const rentalIncome = watch("rentalIncome");
  const hasSpouse = watch("hasSpouse");
  const spouseMeetsIncome = watch("spouseMeetsIncome");

  const incomeMaxText = wonKorean(rules.dependentEligibility.incomeMax.value);

  const restart = () => {
    reset(dependentFormDefaults);
    setResult(null);
    setStep(0);
  };

  const back = () => (step === 0 ? undefined : setStep(step - 1));

  const next = async (fields: (keyof DependentFormInput)[], after?: () => void) => {
    if (await trigger(fields)) (after ?? (() => setStep(step + 1)))();
  };

  const finish = () => {
    // trigger 통과 후이므로 parse 는 항상 성공 — coerce(문자열→숫자)를 여기서 확정한다.
    const values = dependentFormSchema.parse(getValues());
    const check = checkDependent(toEngineInput(values), rules);
    setResult({
      ...check,
      // 탈락 시에만 지역보험료 간이 추정을 채운다 (유지 시 null — shared-types 계약)
      estimatedPremium:
        check.verdict === "lose" ? estimateRegionalPremium(toPremiumInput(values), rules) : null,
    });
    track({ name: "calc_complete", params: { tool: "dependent-check" } });
  };

  const retired = basis === "retired";

  if (result) {
    return <ResultView result={result} retired={retired} onRestart={restart} />;
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {step === 0 ? (
        <StepShell
          step={0}
          total={TOTAL_STEPS}
          title="언제 기준으로 볼까요?"
          help="은퇴를 앞두고 계시면 '은퇴 후 기준'을 골라 예상 소득으로 미리 확인할 수 있어요."
          onNext={() => next(["basis"])}
        >
          <ChoiceGroup
            options={[
              { value: "current", label: "지금 기준으로 볼게요", desc: "현재 소득·재산으로 판정해요" },
              {
                value: "retired",
                label: "은퇴 후 기준으로 볼게요 (예정)",
                desc: "지금 받는 월급은 빼고, 은퇴 후 예상되는 소득(연금·임대 등)만 넣어 미리 확인해요",
              },
            ]}
            value={basis}
            onChange={(v) => setValue("basis", v)}
          />
        </StepShell>
      ) : null}

      {step === 1 ? (
        <StepShell
          step={1}
          total={TOTAL_STEPS}
          title={
            retired
              ? "은퇴 후 누구의 건강보험에 피부양자로 들어가세요?"
              : "누구의 건강보험에 피부양자로 들어가세요?"
          }
          help="직장가입자인 가족의 보험에 얹히는 경우예요. 형제자매의 보험이면 재산 기준이 더 엄격해서 판정에 반영돼요."
          onBack={back}
          onNext={() => next(["supporter"])}
        >
          <ChoiceGroup
            options={[
              { value: "child", label: "자녀의 직장보험", desc: "가장 흔한 경우예요" },
              { value: "spouse", label: "배우자의 직장보험" },
              { value: "parent", label: "부모의 직장보험" },
              {
                value: "sibling",
                label: "형제자매의 직장보험",
                desc: "30세 미만·65세 이상·장애인 등만 가능하고, 재산 상한이 1억 8천만원으로 더 엄격해요",
              },
            ]}
            value={supporter}
            onChange={(v) => setValue("supporter", v)}
          />
        </StepShell>
      ) : null}

      {step === 2 ? (
        <StepShell
          step={2}
          total={TOTAL_STEPS}
          title={retired ? "은퇴 후에도 사업자등록이 있을 예정인가요?" : "사업자등록이 있으세요?"}
          help={retired ? "지금이 아니라 은퇴 후 계획 기준으로 답해 주세요." : undefined}
          onBack={back}
          onNext={() => next(["bizIncomeAnnual"])}
        >
          <ChoiceGroup
            options={[
              { value: "no", label: "없어요" },
              { value: "yes", label: "있어요", desc: "사업소득이 발생하면 금액과 관계없이 제외 대상이에요" },
            ]}
            value={bizRegistered}
            onChange={(v) => setValue("bizRegistered", v)}
          />
          {bizRegistered === "yes" ? (
            <>
              <p className="t-h4 mb-2 mt-6">사업소득이 발생하고 있나요?</p>
              <ChoiceGroup
                options={[
                  { value: "no", label: "아니요, 소득은 없어요", desc: "등록만 있고 소득이 없으면 괜찮아요" },
                  { value: "yes", label: "예, 소득이 있어요" },
                ]}
                value={bizIncomeRegistered}
                onChange={(v) => setValue("bizIncomeRegistered", v)}
              />
              {bizIncomeRegistered === "yes" ? (
                <MoneyField
                  label={retired ? "은퇴 후 예상 연간 사업소득 (대략)" : "연간 사업소득 (대략)"}
                  help="자격 판정에는 금액이 필요 없지만, 제외될 경우 보험료 추정에 사용돼요."
                  error={errors.bizIncomeAnnual?.message}
                  inputProps={register("bizIncomeAnnual")}
                />
              ) : null}
            </>
          ) : (
            <MoneyField
              label={
                retired
                  ? "은퇴 후 사업자등록 없이 벌 것 같은 연간 사업소득"
                  : "사업자등록 없이 버는 연간 사업소득"
              }
              help="프리랜서 수입 등이에요. 미등록자는 연 500만원까지 허용돼요."
              error={errors.bizIncomeAnnual?.message}
              onNone={() => setValue("bizIncomeAnnual", 0)}
              inputProps={register("bizIncomeAnnual")}
            />
          )}
        </StepShell>
      ) : null}

      {step === 3 ? (
        <StepShell
          step={3}
          total={TOTAL_STEPS}
          title={retired ? "은퇴 후 주택임대소득이 있을 예정인가요?" : "주택임대소득이 있으세요?"}
          help="주택을 세놓아 받는 월세 등이에요. 상가 임대는 사업소득으로 앞 단계에 해당해요."
          onBack={back}
          onNext={() => next(["rentalIncome", "rentalIncomeAnnual"])}
        >
          <ChoiceGroup
            options={[
              { value: "no", label: "없어요" },
              { value: "yes", label: "있어요", desc: "주택임대소득은 금액과 관계없이 제외 대상이에요" },
            ]}
            value={rentalIncome}
            onChange={(v) => setValue("rentalIncome", v)}
          />
          {rentalIncome === "yes" ? (
            <MoneyField
              label={retired ? "은퇴 후 예상 연간 주택임대소득 (대략)" : "연간 주택임대소득 (대략)"}
              help="자격 판정에는 금액이 필요 없지만, 제외될 경우 예상 보험료 계산에 사용돼요."
              error={errors.rentalIncomeAnnual?.message}
              inputProps={register("rentalIncomeAnnual")}
            />
          ) : null}
        </StepShell>
      ) : null}

      {step === 4 ? (
        <StepShell
          step={4}
          total={TOTAL_STEPS}
          title={retired ? "은퇴 후 예상 연간 소득을 알려주세요" : "연간 소득을 알려주세요"}
          help={
            retired
              ? `지금 받는 월급은 빼고, 은퇴 후에도 들어올 소득(연금·이자 등)만 적어 주세요. 두 금액을 합쳐 소득요건(연 ${incomeMaxText})을 판정해요. 국민연금 등 공적연금은 100% 반영돼요 — 보험료 부과 때 50%와 달라요.`
              : `두 금액을 합쳐 소득요건(연 ${incomeMaxText})을 판정해요. 국민연금 등 공적연금은 100% 반영돼요 — 보험료 부과 때 50%와 달라요.`
          }
          onBack={back}
          onNext={() => next(["workPensionIncome", "otherIncome"])}
        >
          <MoneyField
            label={retired ? "은퇴 후 근로·연금 소득 (연간 예상)" : "근로·연금 소득 (연간 합계)"}
            help={
              retired
                ? "국민연금·공무원연금 예상 수령액과 은퇴 후에도 계속할 일의 소득 1년치예요. 지금 다니는 직장 월급은 넣지 마세요."
                : "월급, 국민연금·공무원연금 등 1년치를 합쳐 주세요."
            }
            error={errors.workPensionIncome?.message}
            onNone={() => setValue("workPensionIncome", 0)}
            inputProps={register("workPensionIncome")}
          />
          <MoneyField
            label={retired ? "이자·배당·기타 소득 (연간 예상)" : "이자·배당·기타 소득 (연간 합계)"}
            help="예금 이자, 주식 배당 등이에요. 사업소득은 앞에서 여쭤봤으니 빼고 적어 주세요."
            error={errors.otherIncome?.message}
            onNone={() => setValue("otherIncome", 0)}
            inputProps={register("otherIncome")}
          />
        </StepShell>
      ) : null}

      {step === 5 ? (
        <StepShell
          step={5}
          total={TOTAL_STEPS}
          title="재산세 과세표준을 알려주세요"
          help={`재산세 고지서의 '과세표준' 금액이에요. 시세나 공시가격보다 낮은 경우가 많아요. 부부라도 재산은 각자 명의로 판정해요.${retired ? " 재산은 지금 금액 그대로 적어 주세요 — 미리보기는 현재 재산 기준이에요." : ""}`}
          onBack={back}
          onNext={() => next(["propertyTaxBase"])}
        >
          <MoneyField
            label="재산세 과세표준 (본인 명의 합계)"
            error={errors.propertyTaxBase?.message}
            onNone={() => setValue("propertyTaxBase", 0)}
            inputProps={register("propertyTaxBase")}
          />
        </StepShell>
      ) : null}

      {step === 6 ? (
        <StepShell
          step={6}
          total={TOTAL_STEPS}
          title="배우자가 있으세요?"
          help={`부부는 두 분 모두 소득요건을 충족해야 해요. 재산 요건은 각자 판정해요.${retired ? " 배우자 소득도 은퇴 후 예상 기준으로 판단해 주세요." : ""}`}
          onBack={back}
          onNext={() => next(["hasSpouse", "spouseMeetsIncome"], finish)}
          nextLabel="결과 보기"
        >
          <ChoiceGroup
            options={[
              { value: "no", label: "없어요" },
              { value: "yes", label: "있어요" },
            ]}
            value={hasSpouse}
            onChange={(v) => setValue("hasSpouse", v)}
          />
          {hasSpouse === "yes" ? (
            <>
              <p className="t-h4 mb-2 mt-6">
                배우자도 소득요건(연 {incomeMaxText} 이하 등)을 충족하세요?
              </p>
              <ChoiceGroup
                options={[
                  { value: "yes", label: "예, 충족해요" },
                  { value: "no", label: "아니요, 넘어요", desc: "한 분이라도 초과하면 두 분 모두 제외돼요" },
                ]}
                value={spouseMeetsIncome}
                onChange={(v) => setValue("spouseMeetsIncome", v)}
              />
            </>
          ) : null}
        </StepShell>
      ) : null}
    </form>
  );
}

function ResultView({
  result,
  retired,
  onRestart,
}: {
  result: DependentResult;
  retired: boolean;
  onRestart: () => void;
}) {
  const keep = result.verdict === "keep";
  const premium = result.estimatedPremium;
  const headline = keep
    ? "피부양자 자격을 유지할 수 있어요"
    : "피부양자에서 제외될 가능성이 높아요";

  return (
    <div>
      <ResultCard
        tool="dependent-check"
        timeBadge={retired ? "은퇴 후 가정 계산" : `${dependentRules._meta.year}년 기준`}
        headline={headline}
      >
        {retired ? (
          <p className="t-body-l mb-0 mt-1">
            입력하신 <strong>은퇴 후 예상 소득</strong> 기준의 가정 계산이에요 — 판정 기준은{" "}
            {dependentRules._meta.year}년 값이고, 실제 판정은 그 시점의 공단 소득·재산 자료로
            이뤄져요.
          </p>
        ) : null}
        <p className="t-h4 mb-2 mt-4">{keep ? "판정 근거" : "제외 사유"}</p>
        <ul className="t-body-l mt-0 space-y-2">
          {result.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        {premium ? (
          <div className="mt-6">
            <p className="t-h4 mb-2">제외되면 내게 될 지역보험료 (간이 추정)</p>
            <table className="table mt-2">
              <tbody>
                <tr>
                  <td>건강보험료 (월)</td>
                  <td className="num">{won(premium.monthlyHealth)}</td>
                </tr>
                <tr>
                  <td>장기요양보험료 (월)</td>
                  <td className="num">{won(premium.monthlyLongTermCare)}</td>
                </tr>
                <tr>
                  <th scope="row">합계 (월)</th>
                  <td className="num">
                    <strong>{won(premium.monthlyTotal)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="t-body mt-2">{premium.note}</p>
          </div>
        ) : null}
      </ResultCard>

      {/* 해석 (TOOL_SPEC 결과 화면) */}
      <div className="mt-6">
        {keep ? (
          <p className="t-body-l">
            지금 조건으로는 자격을 유지할 가능성이 높아요. 다만 공단은 소득·재산 자료로 정기적으로
            다시 판정하니, 연금 수령액이 늘거나 재산이 바뀌면 이 계산을 다시 해 보세요.
          </p>
        ) : (
          <p className="t-body-l">
            제외되면 지역가입자로 전환되어 위 추정 금액 수준의 보험료를 내게 될 수 있어요. 퇴직
            직후라면 <strong>임의계속가입</strong> 제도로 한동안 직장 보험료 수준을 유지할 수 있는
            경우가 있고, 소득·재산을 조정해 요건을 다시 충족하는 방법도 있어요. 정확한 내용은
            건강보험공단(1577-1000)에서 확인해 주세요.
          </p>
        )}
        {retired ? (
          <p className="t-body-l">
            은퇴 시점의 소득·재산은 지금 예상과 달라질 수 있어요. 은퇴가 가까워지면{" "}
            <strong>그때 값으로 다시 계산</strong>해 보세요.
          </p>
        ) : null}
      </div>

      <OfficialLink tool="dependent-check" />

      <Disclaimer>실제 자격 판정과 보험료는 건강보험공단 심사·고지에 따릅니다.</Disclaimer>

      <div className="no-print mt-6 flex gap-3">
        <button type="button" className="btn" onClick={onRestart}>
          다시 계산하기
        </button>
        <Link href="/guide/" className="btn btn-ghost">
          {keep ? "피부양자 가이드 보기" : "탈락 방지 전략 글 보기"}
        </Link>
      </div>
    </div>
  );
}
