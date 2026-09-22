import type {
  BasicPensionInput,
  BasicPensionResult,
  BasicPensionRules,
} from "@contracts/shared-types";

// F-01 기초연금 모의계산 엔진 — TOOL_SPEC_basic-pension.md 의 산식을 rules 값으로 구현.
// 순수함수: 같은 (input, rules) → 같은 result. 제도 숫자 하드코딩 금지 (도메인 규칙 1).
//
// v1 근사 (TOOL_SPEC 명시):
// - 나이는 연 단위(활성연도 − 출생연도 ≥ 65) — 생일 미반영, UI 가 "만 65세 생일 한 달 전
//   신청 가능"을 안내한다.
// - 국민연금 월액이 기준연금액×150% 초과면 정확한 연계감액에 A급여가 필요 — 전액 기준으로
//   계산하되 npsLink="mayReduce" 로 표시만 한다 (단정 금지).
export function computeBasicPension(
  input: BasicPensionInput,
  rules: BasicPensionRules,
): BasicPensionResult {
  const r = rules;
  const couple = input.household === "couple";

  // ---- 소득평가액 (월) ----
  const laborDeduction = r.incomeEvaluation.laborBasicDeduction.value;
  const laborRate = 1 - r.incomeEvaluation.laborExtraDeductionRate.value; // 0.7
  const evalLabor = (v: number) => laborRate * Math.max(v - laborDeduction, 0);
  const laborEvaluated =
    evalLabor(input.laborIncomeSelf) + (couple ? evalLabor(input.laborIncomeSpouse) : 0);

  const interest = Math.max(
    input.interestIncomeMonthly - r.incomeEvaluation.interestDeduction.value,
    0,
  );
  const nps = input.npsSelf + (couple ? input.npsSpouse : 0);
  const otherIncome = nps + input.otherIncomeMonthly + interest;

  // 무료임차소득 — 주택가액이 기준(6억) **이상**일 때만 가산 (고시 제4조)
  const freeRentIncome =
    input.freeRentHousePrice >= r.incomeEvaluation.freeRentHousePriceMin.value
      ? (input.freeRentHousePrice * r.incomeEvaluation.freeRentRate.value) / 12
      : 0;

  const incomeEvaluated = laborEvaluated + otherIncome + freeRentIncome;

  // ---- 재산의 소득환산액 (월) ----
  const regionDeduction = r.assetConversion.basicDeduction[input.region].value;
  // 임차보증금 × 0.95 (5% 공제 — rules.rentDepositRate. 종전 50%는 스펙 오류, REVIEW C-2)
  const generalAssetNet = Math.max(
    input.generalAssets +
      input.rentDeposit * r.assetConversion.rentDepositRate.value -
      regionDeduction,
    0,
  );
  const financialAssetNet = Math.max(
    input.financialAssets - r.assetConversion.financialDeduction.value,
    0,
  );
  const convertible = Math.max(generalAssetNet + financialAssetNet - input.debts, 0);
  // 고급차는 기준가액(4천만) **이상**일 때만, 회원권은 임계 없이 — 공제·환산율 미적용 100% 가산
  const luxuryCar =
    input.luxuryCarValue >= r.assetConversion.luxuryCarPriceMin.value ? input.luxuryCarValue : 0;
  const luxuryAdded = luxuryCar + input.membershipValue;
  const assetConverted =
    (convertible * r.assetConversion.conversionRateAnnual.value) / 12 + luxuryAdded;

  const recognizedIncome = Math.round(incomeEvaluated + assetConverted);
  const criterion = r.selectionCriteria[input.household].value;

  const breakdown = {
    laborEvaluated: Math.round(laborEvaluated),
    otherIncome: Math.round(otherIncome),
    freeRentIncome: Math.round(freeRentIncome),
    generalAssetNet: Math.round(generalAssetNet),
    financialAssetNet: Math.round(financialAssetNet),
    luxuryAdded: Math.round(luxuryAdded),
  };

  // 부부가구라도 배우자가 수급 대상이 아니면(65세 미만 등) 1인 수급 — 부부감액 없음
  const twoRecipients = couple && input.spouseEligible;
  const baseMax = r.basePension.monthlyMax.value;
  const npsLink: BasicPensionResult["npsLink"] =
    Math.max(input.npsSelf, twoRecipients ? input.npsSpouse : 0) >
    baseMax * r.npsLink.fullPaymentThresholdRate.value
      ? "mayReduce"
      : "full";

  const common = {
    incomeEvaluated: Math.round(incomeEvaluated),
    assetConverted: Math.round(assetConverted),
    recognizedIncome,
    criterion,
    npsLink,
    breakdown,
  };

  // ---- 자격 분기 ----
  if (input.hasOccupationalPension) {
    return { verdict: "occupationalExcluded", estimatedMonthly: null, incomeReversalApplied: false, ...common };
  }
  // 65세 미만은 종료하지 않고 "지금 65세라 가정" 예비 계산 (V-1) — 계산은 동일, verdict 만 preview
  const preview = r._meta.year - input.birthYear < r.eligibility.ageMin;
  if (recognizedIncome > criterion) {
    return {
      verdict: preview ? "preview" : "notEligible",
      estimatedMonthly: null,
      incomeReversalApplied: false,
      ...common,
    };
  }

  // ---- 지급액: 기준연금액 → (부부 모두 수급 시 각 20% 감액) → 소득역전방지 (최저 = ×10%) ----
  const persons = twoRecipients ? 2 : 1;
  const afterCouple = twoRecipients
    ? baseMax * (1 - r.basePension.coupleReductionRate.value) * 2
    : baseMax;
  const reversalCap = criterion - recognizedIncome;
  const floor = baseMax * r.basePension.minPaymentRate.value * persons;
  const estimated = Math.max(Math.min(afterCouple, reversalCap), floor);

  return {
    verdict: preview ? "preview" : "eligible",
    estimatedMonthly: Math.round(estimated),
    incomeReversalApplied: reversalCap < afterCouple,
    ...common,
  };
}
