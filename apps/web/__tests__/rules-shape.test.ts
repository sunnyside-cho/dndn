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

  it("간이세액표: 수록본 무결성 — 행마다 11인 컬럼, min<max, min 오름차순·빈틈 없음", () => {
    const rows = simplifiedTaxTable.rows;
    expect(rows.length).toBeGreaterThan(0); // 2026-09-22 국세청 공식 엑셀 변환본 수록
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      expect(r.byDependents, `row ${i}`).toHaveLength(11);
      if (r.max !== null) expect(r.max, `row ${i}`).toBeGreaterThan(r.min);
      // 구간 연속성: 다음 행 min = 이번 행 max ([min, max) 규약 — 빈틈이 있으면 lookup 누락)
      if (i > 0) expect(r.min, `row ${i}`).toBe(rows[i - 1].max);
    }
  });

  it("REVIEW_2026-09-22 구조화 필드 — 하드코딩 승격분이 rules 에 존재한다", () => {
    // C-2: 임차보증금 95% (5% 공제)
    expect(basicPensionRules.assetConversion.rentDepositRate.value).toBe(0.95);
    // M-1: 피부양자 상수 3종 + 지방소득세율
    expect(dependentRules.dependentEligibility.businessIncome.unregisteredMax.value).toBe(5_000_000);
    expect(dependentRules.dependentEligibility.assetMax.tier2IncomeMax.value).toBe(10_000_000);
    expect(dependentRules.regionalPremium.incomeReflection.halfRate.value).toBe(0.5);
    expect(dependentRules.regionalPremium.incomeReflection.fullRate.value).toBe(1.0);
    expect(insuranceRules.incomeTax?.localTaxRate.value).toBe(0.1);
  });

  it("간이세액표 overflow: 구간 연속 + fixed 누적 정합 (산식 해석을 데이터로 검증 — C-1 교훈)", () => {
    const o = simplifiedTaxTable.overflow;
    expect(o).toBeDefined();
    if (!o) return;
    expect(o.baseByDependents).toHaveLength(11);
    expect(o.tiers[0].min).toBe(o.baseAt);
    expect(o.tiers[o.tiers.length - 1].max).toBeNull();
    for (let i = 0; i < o.tiers.length - 1; i++) {
      const t = o.tiers[i];
      expect(o.tiers[i + 1].min, `tier ${i + 1} 연속성`).toBe(t.max);
      // fixed[i+1] = fixed[i] + 구간폭 × (98%) × rate — 국세청 산식의 누적 구조가 데이터와 일치해야 함
      const span = (t.max as number) - t.min;
      const expected = t.fixed + Math.round(span * (t.applyRate98 ? 0.98 : 1) * t.rate);
      expect(o.tiers[i + 1].fixed, `tier ${i + 1} fixed 정합`).toBe(expected);
    }
  });

  it("C-1: 퇴직세 quick 은 구간 시작점 누적세액 — 인접 구간과 정합해야 한다", () => {
    // quick[i+1] == quick[i] + (max[i] − max[i−1]) × rate[i] — rules 값 자체의 무결성 검증
    const rows = severanceRules.taxBrackets.rows;
    for (let i = 0; i < rows.length - 1; i++) {
      const prevMax = i > 0 ? (rows[i - 1].max as number) : 0;
      const expected = rows[i].quick + ((rows[i].max as number) - prevMax) * rows[i].rate;
      expect(rows[i + 1].quick, `구간 ${i + 1}`).toBe(expected);
    }
  });
});
