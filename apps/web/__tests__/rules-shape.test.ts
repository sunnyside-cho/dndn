import { describe, expect, it } from "vitest";
import {
  basicPensionRules,
  dependentRules,
  insuranceRules,
  nextYearRates,
  severanceRules,
  simplifiedTaxTable,
  ACTIVE_YEAR,
} from "@/data/rules";

// rules JSON ↔ shared-types 구조 드리프트 가드 (data/rules/index.ts 의 캐스트 보완).
// 값 자체가 아니라 "형태와 규약"(_meta·asOf·핵심 필드 존재)을 검증한다.
describe("rules 파일 구조 계약 (db-schema.md)", () => {
  const all = [
    ["basic-pension", basicPensionRules._meta],
    ["severance", severanceRules._meta],
    ["dependent", dependentRules._meta],
    ["insurance", insuranceRules._meta],
    ["tax-table", simplifiedTaxTable._meta],
  ] as const;

  it("모든 rules 는 _meta(year·asOf) 를 갖는다 — SourceBadge 자동 표기의 원천", () => {
    for (const [name, meta] of all) {
      expect(meta.year, name).toBe(ACTIVE_YEAR);
      expect(meta.asOf, name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("기초연금: 선정기준액·기준연금액·공제 필드", () => {
    expect(basicPensionRules.selectionCriteria.single.value).toBeGreaterThan(0);
    expect(basicPensionRules.selectionCriteria.couple.value).toBeGreaterThan(
      basicPensionRules.selectionCriteria.single.value,
    );
    expect(basicPensionRules.assetConversion.basicDeduction.metro.value).toBeGreaterThan(0);
  });

  it("퇴직세: 구간표들이 오름차순이고 마지막 구간은 무한(null)", () => {
    const last = <T>(a: T[]) => a[a.length - 1];
    expect(last(severanceRules.serviceYearDeduction.brackets).maxYears).toBeNull();
    expect(last(severanceRules.convertedSalaryDeduction.brackets).max).toBeNull();
    expect(last(severanceRules.taxBrackets.rows).max).toBeNull();
    expect(severanceRules.irp.pensionDiscount.rows.map((r) => r.payRate)).toEqual([0.7, 0.6, 0.5]);
  });

  it("피부양자: 60등급 재산점수표 60행·점수 오름차순", () => {
    const table = dependentRules.regionalPremium.assetPointTable;
    expect(table).toBeTypeOf("object");
    if (typeof table === "object" && table) {
      expect(table.rows).toHaveLength(60);
      for (let i = 1; i < table.rows.length; i++) {
        expect(table.rows[i].points).toBeGreaterThan(table.rows[i - 1].points);
        if (table.rows[i].max !== null)
          expect(table.rows[i].max!).toBeGreaterThan(table.rows[i - 1].max!);
      }
      expect(table.rows[59].max).toBeNull();
    }
  });

  it("4대보험: 상하한·60세 면제 플래그·2027 파생값", () => {
    const np = insuranceRules.nationalPension;
    expect(np.baseMonthly.from_2026_07?.max).toBeGreaterThan(np.baseMonthly.from_2026_07!.min);
    expect(np.age60Exempt.value).toBe(true);
    // next2027(총요율 10%) → 근로자 절반 5%
    expect(nextYearRates.nationalPensionEmployee).toBeCloseTo(0.05);
    expect(nextYearRates.healthEmployee).toBeCloseTo(insuranceRules.healthInsurance.rateEmployee.value);
    expect(nextYearRates.longTermCareFormula).toBeNull(); // 미발표 — 추측 금지
  });

  it("간이세액표: 미수록이면 rows 빈 배열 (소득세 단정 금지 신호)", () => {
    expect(Array.isArray(simplifiedTaxTable.rows)).toBe(true);
  });
});
