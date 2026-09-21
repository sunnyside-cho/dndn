import type {
  DependentInput,
  DependentResult,
  DependentRules,
  RegionalPremiumEstimate,
  RegionalPremiumInput,
} from "@contracts/shared-types";
import { wonKorean } from "@/lib/format";

// F-03 건보 피부양자 자격 체크 엔진 — TOOL_SPEC_dependent-check.md 의 판정 게이트·간이 산식을
// rules 값으로 구현. 순수함수: 같은 (input, rules) → 같은 result (api-spec 엔진 계약).
//
// 예외 상수 3종 — rules 에 "문구"로만 존재하고 구조화 필드가 없어 상수로 둔다
// (rules 개정 시 아래 문구 필드와 함께 점검 — 완료 보고에 명시된 구조화 갭):
//   · 미등록 사업소득 허용 상한 500만원 — dependentEligibility.businessIncome.unregistered 문구
//   · 재산 tier1~tier2 구간의 소득 상한 1,000만원 — dependentEligibility.assetMax.tier2.rule 문구
//   · 소득 반영률 근로·연금 50% / 그 외 100% — regionalPremium.incomeReflection 문구
const UNREGISTERED_BIZ_INCOME_MAX = 5_000_000;
const TIER2_INCOME_MAX = 10_000_000;
const REFLECT_WORK_PENSION = 0.5;
const REFLECT_OTHER = 1.0;

export function checkDependent(input: DependentInput, rules: DependentRules): DependentResult {
  const e = rules.dependentEligibility;
  const incomeMax = e.incomeMax.value;
  const tier1 = e.assetMax.tier1.value;
  const tier2 = e.assetMax.tier2.value;

  const fails: string[] = [];
  const passes: string[] = [];

  // ①② 사업소득 — 등록자는 발생 즉시(금액 불문), 미등록자는 연 500만 초과 시 탈락
  if (input.hasBusinessRegistration) {
    if (input.businessIncomeAnnual > 0) {
      fails.push(
        "사업자등록이 있고 사업소득이 발생하면 금액과 관계없이 피부양자에서 제외돼요 — " +
          `연 ${wonKorean(UNREGISTERED_BIZ_INCOME_MAX)} 특례는 미등록자에게만 있어요.`,
      );
    } else {
      passes.push("사업자등록은 있지만 사업소득이 발생하지 않아 사업소득 요건은 충족해요.");
    }
  } else if (input.businessIncomeAnnual > UNREGISTERED_BIZ_INCOME_MAX) {
    fails.push(
      `사업자등록이 없어도 사업소득이 연 ${wonKorean(UNREGISTERED_BIZ_INCOME_MAX)}을 넘으면 제외돼요.`,
    );
  } else if (input.businessIncomeAnnual > 0) {
    passes.push(
      `사업자등록 없이 얻는 사업소득이 연 ${wonKorean(UNREGISTERED_BIZ_INCOME_MAX)} 이하예요.`,
    );
  } else {
    passes.push("사업소득이 없어요.");
  }

  // ③ 주택임대소득 — 금액 불문 탈락
  if (input.hasRentalIncome) {
    fails.push("주택임대소득이 있으면 금액과 관계없이 제외돼요.");
  } else {
    passes.push("주택임대소득이 없어요.");
  }

  // ④ 연간 소득 합계 — 공적연금 100% 반영 (부과 시 50% 와 다름)
  if (input.annualIncome > incomeMax) {
    fails.push(
      `연간 소득 합계가 ${wonKorean(incomeMax)}을 넘어요 — 공적연금은 100% 반영돼요` +
        "(보험료 부과 때 50% 반영과 달라요).",
    );
  } else {
    passes.push(`연간 소득 합계가 ${wonKorean(incomeMax)} 이하예요 (공적연금 100% 반영 기준).`);
  }

  // ⑤ 재산세 과세표준 — tier2 초과 즉시 탈락 / tier1~tier2 는 소득 1,000만 재확인
  if (input.propertyTaxBase > tier2) {
    fails.push(`재산세 과세표준이 ${wonKorean(tier2)}을 넘으면 소득과 관계없이 제외돼요.`);
  } else if (input.propertyTaxBase > tier1) {
    if (input.annualIncome > TIER2_INCOME_MAX) {
      fails.push(
        `재산세 과세표준이 ${wonKorean(tier1)}~${wonKorean(tier2)} 구간이면 연간 소득이 ` +
          `${wonKorean(TIER2_INCOME_MAX)} 이하여야 하는데, 이를 넘어요.`,
      );
    } else {
      passes.push(
        `재산세 과세표준이 ${wonKorean(tier1)}~${wonKorean(tier2)} 구간이지만 연간 소득이 ` +
          `${wonKorean(TIER2_INCOME_MAX)} 이하라 재산 요건을 충족해요.`,
      );
    }
  } else {
    passes.push(`재산세 과세표준이 ${wonKorean(tier1)} 이하예요.`);
  }

  // ⑥ 부부 — 두 사람 모두 소득요건 충족 필요 (재산은 각자 판정). null = 배우자 없음.
  if (input.spouseMeetsIncome === false) {
    fails.push(
      "부부는 두 분 모두 소득요건을 충족해야 해요 (재산은 각자 판정) — 배우자가 소득요건을 충족하지 못해 함께 제외돼요.",
    );
  } else if (input.spouseMeetsIncome === true) {
    passes.push("배우자도 소득요건을 충족해요.");
  } else {
    passes.push("배우자가 없어 본인 요건만 확인했어요.");
  }

  const verdict: DependentResult["verdict"] = fails.length > 0 ? "lose" : "keep";
  // estimatedPremium 은 화면(Calculator)이 estimateRegionalPremium 결과를 채운다 (Task 계약).
  return { verdict, reasons: verdict === "lose" ? fails : passes, estimatedPremium: null };
}

// 지역보험료 간이 추정 (TOOL_SPEC 산식):
//   소득분(월) = (근로·연금×50% + 그 외×100%) × 건보요율 ÷ 12
//   재산분(월) = 재산금액(과표 − 기본공제 1억) → 60등급표 점수 × 점수당 금액(211.5원)
//   장기요양(월) = 건강보험료 × (장기요양요율 ÷ 건보요율)
// monthlyMin/monthlyMax 는 verified "check"(고시 원문 대조 미완) — 결과는 항상 "간이 추정" 문구 동반.
export function estimateRegionalPremium(
  input: RegionalPremiumInput,
  rules: DependentRules,
): RegionalPremiumEstimate {
  const rp = rules.regionalPremium;
  const notes: string[] = [];

  const monthlyIncomePart =
    ((input.annualWorkPensionIncome * REFLECT_WORK_PENSION +
      input.annualOtherIncome * REFLECT_OTHER) *
      rp.healthRate.value) /
    12;

  let monthlyAssetPart = 0;
  const table = rp.assetPointTable;
  if (!table || typeof table === "string") {
    // shared-types: assetPointTable 은 object|string 유니언 — 미수록/문자열이면 재산분 생략 + 사유
    notes.push("60등급 재산점수표가 수록되지 않아 재산분은 0원으로 계산했어요.");
  } else {
    const assetAmount = Math.max(input.propertyTaxBase - rp.assetBasicDeduction.value, 0);
    if (assetAmount > 0) {
      // 오름차순 등급표 — 재산금액 이하(max ≥ 금액)인 첫 행, max=null 은 최고 등급
      const row = table.rows.find((r) => r.max === null || assetAmount <= r.max);
      monthlyAssetPart = (row?.points ?? 0) * rp.assetPointPrice.value;
    }
  }

  const monthlyHealth = Math.min(
    Math.max(Math.round(monthlyIncomePart + monthlyAssetPart), rp.monthlyMin.value),
    rp.monthlyMax.value,
  );
  const monthlyLongTermCare = Math.round(
    monthlyHealth * (rp.longTermCareRate.value / rp.healthRate.value),
  );

  notes.push(
    "간이 추정입니다 — 정확한 금액은 건보공단 모의계산(https://www.nhis.or.kr/nhis/minwon/retrieveLocalCalcView.do)에서 확인하세요.",
  );

  return {
    monthlyHealth,
    monthlyLongTermCare,
    monthlyTotal: monthlyHealth + monthlyLongTermCare,
    note: notes.join(" "),
  };
}
