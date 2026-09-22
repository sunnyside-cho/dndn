// rules 로딩 유일 진입점 (contracts/api-spec.md · db-schema.md)
// 연도 개정(W1) = 새 파일 추가 + 아래 import 전환. 이 파일 외에서 rules JSON 직접 import 금지.
import type {
  BasicPensionRules,
  DependentRules,
  InsuranceRules,
  NextYearRates,
  SeveranceRules,
  SimplifiedTaxTable,
} from "@contracts/shared-types";
import basicPension from "./basic-pension.2026.json";
import dependent from "./dependent.2026.json";
import insurance from "./insurance.2026.json";
import severance from "./severance.2026.json";
import taxTable from "./tax-table.2026.json";

/** 활성 연도 — 화면 표기·연도 비교 기준 */
export const ACTIVE_YEAR = 2026;

// JSON 리터럴은 union("official" 등)으로 좁혀지지 않으므로 형태 캐스트가 필요하다.
// 구조 드리프트는 __tests__/rules-shape.test.ts 가 잡는다.
export const basicPensionRules = basicPension as unknown as BasicPensionRules;
export const severanceRules = severance as unknown as SeveranceRules;
export const dependentRules = dependent as unknown as DependentRules;
export const insuranceRules = insurance as unknown as InsuranceRules;
/** 간이세액표 — rows 비어 있으면 미수록(소득세 '표 수록 전' 표시, 단정 금지) */
export const simplifiedTaxTable = taxTable as unknown as SimplifiedTaxTable;

/** 내년 확정분 — 현행 rules 파일의 nextYear 필드에서 파생 (미발표 항목은 null) */
export const nextYearRates: NextYearRates = {
  year: ACTIVE_YEAR + 1,
  nationalPensionEmployee: insuranceRules.nationalPension.nextYear
    ? insuranceRules.nationalPension.nextYear.value / 2
    : null,
  healthEmployee: insuranceRules.healthInsurance.nextYear?.value ?? null,
  // 장기요양·고용은 연말 발표 — 발표 전 null (화면: "12월 발표 예정")
  longTermCareFormula: null,
  employmentEmployee: null,
};

export function getRules(toolId: "basic-pension"): BasicPensionRules;
export function getRules(toolId: "severance-tax"): SeveranceRules;
export function getRules(toolId: "dependent-check"): DependentRules;
export function getRules(toolId: "insurance-rate" | "salary-senior"): InsuranceRules;
export function getRules(
  toolId: "basic-pension" | "severance-tax" | "dependent-check" | "insurance-rate" | "salary-senior",
): BasicPensionRules | SeveranceRules | DependentRules | InsuranceRules {
  switch (toolId) {
    case "basic-pension":
      return basicPensionRules;
    case "severance-tax":
      return severanceRules;
    case "dependent-check":
      return dependentRules;
    case "insurance-rate":
    case "salary-senior":
      return insuranceRules;
  }
}
