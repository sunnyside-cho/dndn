import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/env.mjs";

// 우리 계산 가정 목록 — 값은 rules JSON 에서 읽어 보간한다 (rules 가 SSOT, 수치 하드코딩 금지).
// 개정으로 rules 가 바뀌면 이 설명도 자동으로 따라간다.
const RULES_DIR = path.join(ROOT, "apps/web/data/rules");
const load = (f) => JSON.parse(fs.readFileSync(path.join(RULES_DIR, f), "utf-8"));

export function buildAssumptions() {
  const bp = load("basic-pension.2026.json");
  const sv = load("severance.2026.json");
  const dp = load("dependent.2026.json");
  const ins = load("insurance.2026.json");
  const man = (v) => `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;

  return {
    bp_criteria: `기초연금 선정기준액 — 단독가구 월 ${bp.selectionCriteria.single.value.toLocaleString()}원, 부부가구 월 ${bp.selectionCriteria.couple.value.toLocaleString()}원`,
    bp_base_amount: `기초연금 기준연금액 월 ${bp.basePension.monthlyMax.value.toLocaleString()}원, 부부 감액 ${bp.basePension.coupleReductionRate.value * 100}%, 소득역전방지 최저 ${bp.basePension.minPaymentRate.value * 100}%`,
    bp_labor_deduction: `기초연금 소득평가: 근로소득 기본공제 월 ${man(bp.incomeEvaluation.laborBasicDeduction.value)} + 추가 ${bp.incomeEvaluation.laborExtraDeductionRate.value * 100}% 공제, 이자소득 공제 월 ${man(bp.incomeEvaluation.interestDeduction.value)}`,
    bp_asset: `기초연금 재산환산: 기본재산 공제(대도시 ${man(bp.assetConversion.basicDeduction.metro.value)}·중소도시 ${man(bp.assetConversion.basicDeduction.city.value)}·농어촌 ${man(bp.assetConversion.basicDeduction.rural.value)}), 금융재산 공제 ${man(bp.assetConversion.financialDeduction.value)}, 소득환산율 연 ${bp.assetConversion.conversionRateAnnual.value * 100}%, 임차보증금 ${bp.assetConversion.rentDepositRate.value * 100}% 반영, 고급자동차 기준 ${man(bp.assetConversion.luxuryCarPriceMin.value)}`,
    bp_nps_link: `기초연금-국민연금 연계 감액: 국민연금 월액이 기준연금액의 ${bp.npsLink.fullPaymentThresholdRate.value * 100}% 이하이면 전액 지급`,
    bp_eligibility: `기초연금 수급 연령 만 ${bp.eligibility.ageMin}세, 직역연금(공무원·사학·군인 등) 수급자 제외`,
    sv_service_deduction: `퇴직소득세 근속연수공제 구간표 (5년 이하 연 100만원 ~ 20년 초과 연 300만원)`,
    sv_conv_deduction: `퇴직소득세 환산급여공제 구간표 (800만원 이하 전액 공제 등)`,
    sv_tax_brackets: `종합·퇴직소득 기본세율 구간 (${sv.taxBrackets.rows[0].rate * 100}% ~ ${sv.taxBrackets.rows[sv.taxBrackets.rows.length - 1].rate * 100}%, 8구간)`,
    sv_irp: `퇴직금 IRP 과세이연 및 연금수령 감면율 — 수령 1~10년차 ${sv.irp.pensionDiscount.rows[0].payRate * 100}% 부담, 11~20년차 ${sv.irp.pensionDiscount.rows[1].payRate * 100}%, 21년차부터 ${sv.irp.pensionDiscount.rows[2].payRate * 100}% 부담, 지방소득세 ${sv.localTaxRate.value * 100}%`,
    dp_eligibility: `건강보험 피부양자 요건: 연소득 ${man(dp.dependentEligibility.incomeMax.value)} 이하, 사업자등록 시 사업소득 발생하면 제외, 주택임대소득 있으면 제외, 재산세 과세표준 ${man(dp.dependentEligibility.assetMax.tier1.value)}/${man(dp.dependentEligibility.assetMax.tier2.value)} 기준, 형제자매 ${man(dp.dependentEligibility.assetMax.sibling.value)}`,
    dp_premium: `건강보험 지역가입자 보험료: 보험료율 ${dp.regionalPremium.healthRate.value * 100}%, 재산 기본공제 ${man(dp.regionalPremium.assetBasicDeduction.value)}, 재산점수당 ${dp.regionalPremium.assetPointPrice.value}원, 60등급 재산점수표, 최저보험료 ${dp.regionalPremium.monthlyMin.value.toLocaleString()}원`,
    in_np_rate: `국민연금 보험료율 총 ${ins.nationalPension.rateTotal.value * 100}% (근로자 ${ins.nationalPension.rateEmployee.value * 100}%), 연금개혁으로 매년 인상되어 내년 ${ins.nationalPension.nextYear ? ins.nationalPension.nextYear.value * 100 + "%" : "미정"}`,
    in_np_base: `국민연금 기준소득월액 상하한 — 하한 ${man(ins.nationalPension.baseMonthly.applied.min)}, 상한 ${man(ins.nationalPension.baseMonthly.applied.max)} (매년 7월 조정), ${ins.nationalPension.exemptAgeMin.value}세 이상 사업장가입 제외`,
    in_health: `건강보험 직장 보험료율 총 7.19%(근로자 ${ins.healthInsurance.rateEmployee.value * 100}%), 장기요양보험료율 0.9448%`,
    in_employment: `고용보험 근로자 요율 ${ins.employmentInsurance.rateEmployee.value * 100}% (실업급여분)`,
    in_tax_table: `근로소득 간이세액표 (월급 구간 × 공제대상가족수별 원천징수 세액, 2026.3.1 적용판)`,
  };
}
