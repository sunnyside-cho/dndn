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

  const freeRentIncome =
    input.freeRentHousePrice > 0
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
  // 고급차·회원권은 공제·환산율 미적용, 가액 100% 월 가산
  const luxuryAdded = input.luxuryCarValue + input.membershipValue;
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

  const baseMax = r.basePension.monthlyMax.value;
  const npsLink: BasicPensionResult["npsLink"] =
    Math.max(input.npsSelf, couple ? input.npsSpouse : 0) >
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
  if (r._meta.year - input.birthYear < r.eligibility.ageMin) {
    return { verdict: "ageNotYet", estimatedMonthly: null, incomeReversalApplied: false, ...common };
  }
  if (recognizedIncome > criterion) {
    return { verdict: "notEligible", estimatedMonthly: null, incomeReversalApplied: false, ...common };
  }

  // ---- 지급액: 기준연금액 → (부부 각 20% 감액) → 소득역전방지 (최저 = 기준연금액×10%) ----
  const persons = couple ? 2 : 1;
  const afterCouple = couple
    ? baseMax * (1 - r.basePension.coupleReductionRate.value) * 2
    : baseMax;
  const reversalCap = criterion - recognizedIncome;
  const floor = baseMax * r.basePension.minPaymentRate.value * persons;
  const estimated = Math.max(Math.min(afterCouple, reversalCap), floor);

  return {
    verdict: "eligible",
    estimatedMonthly: Math.round(estimated),
    incomeReversalApplied: reversalCap < afterCouple,
    ...common,
  };
}
