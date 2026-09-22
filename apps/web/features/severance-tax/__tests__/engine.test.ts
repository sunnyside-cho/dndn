import { describe, expect, it } from "vitest";
import type { SeveranceInput, SeveranceRules } from "@contracts/shared-types";
import { severanceRules } from "@/data/rules";
import {
  computeSeverance,
  convertedTaxFor,
  irpEffectivePayRate,
  parseConvertedSalaryDeduction,
  parseServiceYearFormula,
  serviceYearsBetween,
} from "../engine";

// 기대값은 TOOL_SPEC_severance-tax.md 산식(소득세법 제48조·제55조)으로 수기 계산한 값 —
// 구현과 독립인 앵커. 구현이 바뀌어도 이 숫자는 법이 바뀌기 전엔 그대로여야 한다.

describe("serviceYearsBetween — 근속연수 (1년 미만 올림)", () => {
  it("6개월 근무 → 1년", () => {
    expect(serviceYearsBetween("2024-01-01", "2024-06-30")).toBe(1);
  });
  it("만 19년 + 1일 → 20년 올림", () => {
    expect(serviceYearsBetween("2006-01-01", "2025-01-02")).toBe(20);
  });
  it("정확히 만 19년 → 19년 (올림 없음)", () => {
    expect(serviceYearsBetween("2006-01-01", "2025-01-01")).toBe(19);
  });
  it("2006-01-01 ~ 2025-12-31 → 20년 (앵커 케이스)", () => {
    expect(serviceYearsBetween("2006-01-01", "2025-12-31")).toBe(20);
  });
});

describe("rules 산식 파서 (rules 가 SSOT — 파싱 실패는 throw)", () => {
  it('근속연수공제: "1000000 * n" / "5000000 + 2000000 * (n - 5)" 두 포맷을 해석한다', () => {
    expect(parseServiceYearFormula("1000000 * n")).toEqual({ base: 0, per: 1_000_000, offset: 0 });
    expect(parseServiceYearFormula("5000000 + 2000000 * (n - 5)")).toEqual({
      base: 5_000_000,
      per: 2_000_000,
      offset: 5,
    });
  });
  it('환산급여공제: "100%"(전액) / "8000000 + 초과분*60%" 두 포맷을 해석한다', () => {
    expect(parseConvertedSalaryDeduction("100%")).toEqual({ full: true });
    expect(parseConvertedSalaryDeduction("8000000 + 초과분*60%")).toEqual({
      full: false,
      base: 8_000_000,
      ratePct: 60,
    });
  });
  it("지원하지 않는 포맷은 throw — 조용한 오계산 금지", () => {
    expect(() => parseServiceYearFormula("min(n, 5) * 1000000")).toThrow();
    expect(() => parseServiceYearFormula("n * 1000000")).toThrow();
    expect(() => parseConvertedSalaryDeduction("60%")).toThrow();
    expect(() => parseConvertedSalaryDeduction("8000000 + 초과분*0.6")).toThrow();
  });
});

describe("computeSeverance — 앵커: 퇴직금 1억·근속 20년", () => {
  const anchor: SeveranceInput = {
    severancePay: 100_000_000,
    joinDate: "2006-01-01",
    leaveDate: "2025-12-31",
  };

  it("단계별 금액이 수기 계산값과 일치한다", () => {
    const r = computeSeverance(anchor, severanceRules);
    expect(r.serviceYears).toBe(20);
    expect(r.serviceYearDeduction).toBe(40_000_000);
    expect(r.convertedSalary).toBe(36_000_000);
    expect(r.convertedSalaryDeduction).toBe(24_800_000);
    expect(r.taxBase).toBe(11_200_000);
    expect(r.convertedTax).toBe(672_000);
    expect(r.incomeTax).toBe(1_120_000);
    expect(r.localTax).toBe(112_000);
    expect(r.totalTaxLump).toBe(1_232_000);
    expect(r.netLump).toBe(98_768_000);
  });

  it("IRP 시나리오 3종: 실효 부담률(연차별 감면 가중평균) × 이연세액 — codex #3 반영", () => {
    const r = computeSeverance(anchor, severanceRules);
    expect(r.irpOptions).toHaveLength(3);
    expect(r.irpOptions.map((o) => o.label)).toEqual(["10년 수령", "15년 수령", "25년 수령"]);
    // 10년: 전 기간 70% / 15년: (10×0.7+5×0.6)/15 = 2/3 / 25년: (10×0.7+10×0.6+5×0.5)/25 = 0.62
    expect(r.irpOptions[0].payRate).toBeCloseTo(0.7, 10);
    expect(r.irpOptions[1].payRate).toBeCloseTo(2 / 3, 10);
    expect(r.irpOptions[2].payRate).toBeCloseTo(0.62, 10);
    expect(r.irpOptions.map((o) => o.totalTax)).toEqual([862_400, 821_333, 763_840]);

    const long = r.irpOptions[2];
    expect(long.saving).toBe(468_160); // 1,232,000 − 763,840
    expect(long.net).toBe(100_000_000 - 763_840);
  });

  it("irpEffectivePayRate — 21년 수령이면 (10×70% + 10×60% + 1×50%) ÷ 21 (codex 실측 앵커)", () => {
    const rows = severanceRules.irp.pensionDiscount.rows;
    expect(irpEffectivePayRate(10, rows)).toBeCloseTo(0.7, 10);
    expect(irpEffectivePayRate(21, rows)).toBeCloseTo(13.5 / 21, 10);
    // codex 리뷰 실측: 일시금 세액 1,232,000 × (21년 균등 수령) = 792,000
    expect(Math.round(1_232_000 * irpEffectivePayRate(21, rows))).toBe(792_000);
    // "세금 절반"(50%)은 전 기간이 아니라 21년차 이후 수령분에만 — 무한히 길어져야 0.5 에 수렴
    expect(irpEffectivePayRate(100, rows)).toBeGreaterThan(0.5);
  });
});

describe("computeSeverance — 추가 케이스 (수기 계산 앵커)", () => {
  it("근속 1년 미만 올림: 500만·6개월 → 1년으로 계산 (2구간 세율 — REVIEW C-1 실측 케이스)", () => {
    // 근속 1년: 공제 100만 → 환산급여 (500만−100만)×12 = 4,800만
    // 환산급여공제 800만 + (4,800만−800만)×60% = 3,200만 → 과세표준 1,600만
    // 세액(quick=구간 시작점 누적세액): 84만 + (1,600만−1,400만)×15% = 114만
    //   교차검증: 표준 누진공제표 방식 1,600만×15% − 126만 = 114만 ✓ (REVIEW_2026-09-22 정답)
    // → ÷12×1 = 95,000 + 지방세 9,500
    const r = computeSeverance(
      { severancePay: 5_000_000, joinDate: "2024-01-01", leaveDate: "2024-06-30" },
      severanceRules,
    );
    expect(r.serviceYears).toBe(1);
    expect(r.serviceYearDeduction).toBe(1_000_000);
    expect(r.convertedSalary).toBe(48_000_000);
    expect(r.convertedSalaryDeduction).toBe(32_000_000);
    expect(r.taxBase).toBe(16_000_000);
    expect(r.convertedTax).toBe(1_140_000);
    expect(r.incomeTax).toBe(95_000);
    expect(r.localTax).toBe(9_500);
    expect(r.totalTaxLump).toBe(104_500);
  });

  it("고액·단기: 퇴직금 3억·근속 10년 (REVIEW C-1 실측 케이스)", () => {
    // 공제 500만+200만×5 = 1,500만 → 환산급여 (3억−1,500만)/10×12 = 3.42억
    // 환산급여공제 1.517억 + (3.42억−3억)×35% = 1.664억 → 과세표준 1.756억
    // 세액: 3,706만 + (1.756억−1.5억)×38% = 46,788,000 (REVIEW 정답 4,679만)
    //   교차검증: 표준 누진공제표 방식 1.756억×38% − 1,994만 = 46,788,000 ✓
    // → ÷12×10 = 38,990,000 + 지방세 3,899,000 = 42,889,000
    const r = computeSeverance(
      { severancePay: 300_000_000, joinDate: "2016-01-01", leaveDate: "2025-12-31" },
      severanceRules,
    );
    expect(r.serviceYears).toBe(10);
    expect(r.serviceYearDeduction).toBe(15_000_000);
    expect(r.convertedSalary).toBe(342_000_000);
    expect(r.convertedSalaryDeduction).toBe(166_400_000);
    expect(r.taxBase).toBe(175_600_000);
    expect(r.convertedTax).toBe(46_788_000);
    expect(r.incomeTax).toBe(38_990_000);
    expect(r.localTax).toBe(3_899_000);
    expect(r.totalTaxLump).toBe(42_889_000);
    expect(r.netLump).toBe(257_111_000);

    const long = r.irpOptions[2];
    expect(long.totalTax).toBe(26_591_180); // 42,889,000 × 0.62 (25년 균등 수령 실효율)
    expect(long.saving).toBe(16_297_820);
  });

  it("convertedTaxFor — 전 구간 경계에서 누적세액이 연속이다 (구간표 정합성)", () => {
    // 각 구간 상한에서의 세액 = 다음 구간의 quick 과 정확히 일치해야 한다.
    // (quick 이 "구간 시작점 누적세액"이라는 해석 자체를 rules 값으로 검증 — REVIEW C-1 재발 방지)
    const rows = severanceRules.taxBrackets.rows;
    for (let i = 0; i < rows.length - 1; i++) {
      const upper = rows[i].max;
      expect(upper).not.toBeNull();
      expect(convertedTaxFor(upper as number, severanceRules)).toBe(rows[i + 1].quick);
    }
  });

  it('환산급여가 첫 구간 이내면 "100%" 전액 공제 → 세금 0', () => {
    // 근속 6년: 공제 500만+200만×1 = 700만 → 환산급여 (1,000만−700만)/6×12 = 600만 ≤ 800만
    const r = computeSeverance(
      { severancePay: 10_000_000, joinDate: "2020-01-01", leaveDate: "2025-12-31" },
      severanceRules,
    );
    expect(r.serviceYears).toBe(6);
    expect(r.convertedSalary).toBe(6_000_000);
    expect(r.convertedSalaryDeduction).toBe(6_000_000);
    expect(r.taxBase).toBe(0);
    expect(r.totalTaxLump).toBe(0);
    expect(r.netLump).toBe(10_000_000);
    expect(r.irpOptions.every((o) => o.totalTax === 0 && o.saving === 0)).toBe(true);
  });
});

describe("DoD: rules 파일 교체만으로 숫자가 바뀐다 (하드코딩 금지 검증)", () => {
  it("taxBrackets 첫 구간 rate 를 2배로 바꾸면 세액이 그에 따라 변한다", () => {
    const anchor: SeveranceInput = {
      severancePay: 100_000_000,
      joinDate: "2006-01-01",
      leaveDate: "2025-12-31",
    };
    const doubled: SeveranceRules = structuredClone(severanceRules);
    doubled.taxBrackets.rows[0].rate = 0.12; // 6% → 12%

    const r = computeSeverance(anchor, doubled);
    expect(r.convertedTax).toBe(1_344_000); // 11,200,000 × 12%
    expect(r.incomeTax).toBe(2_240_000);
    expect(r.localTax).toBe(224_000);
    expect(r.totalTaxLump).toBe(2_464_000);
    // 원본 rules 는 그대로 (structuredClone 격리 확인)
    expect(computeSeverance(anchor, severanceRules).totalTaxLump).toBe(1_232_000);
  });

  it("IRP payRate·yearsMax 를 바꾸면 실효 부담률이 그에 따라 변한다", () => {
    const anchor: SeveranceInput = {
      severancePay: 100_000_000,
      joinDate: "2006-01-01",
      leaveDate: "2025-12-31",
    };
    const swapped: SeveranceRules = structuredClone(severanceRules);
    swapped.irp.pensionDiscount.rows[2].payRate = 0.4;
    swapped.irp.pensionDiscount.rows[1].yearsMax = 15;

    const r = computeSeverance(anchor, swapped);
    // 25년: (10×0.7 + 5×0.6 + 10×0.4) ÷ 25 = 0.56 → 1,232,000 × 0.56 = 689,920
    expect(r.irpOptions[2].payRate).toBeCloseTo(0.56, 10);
    expect(r.irpOptions[2].totalTax).toBe(689_920);
  });
});
