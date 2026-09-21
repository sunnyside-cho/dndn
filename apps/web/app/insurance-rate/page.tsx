import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { FaqBlock } from "@/components/FaqBlock";
import { SourceBadge } from "@/components/SourceBadge";
import { insuranceRules as rules, nextYearRates, ACTIVE_YEAR } from "@/data/rules";
import { computeInsuranceDiff } from "@/features/insurance-rate/engine";
import { InsuranceRateCalculator } from "@/features/insurance-rate/components/Calculator";
import { won, wonKorean } from "@/lib/format";

const NEXT_YEAR = nextYearRates.year;

export const metadata: Metadata = {
  title: `${NEXT_YEAR} 4대보험 인상분 계산기 — 내 월급 공제액 변화`,
  description: `월급 하나만 넣으면 ${ACTIVE_YEAR}년과 ${NEXT_YEAR}년 4대보험 월 공제액 차이를 바로 계산합니다. 국민연금 인상 확정분 반영, 미발표 항목은 발표 즉시 갱신. 가입 없음, 입력값 저장 안 함.`,
};

/** 0.095 → "9.5%" */
const pct = (v: number) => `${(v * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;

export default function InsuranceRatePage() {
  const npTotal = rules.nationalPension.rateTotal.value;
  const npNextTotal = rules.nationalPension.next2027?.value ?? null;
  const npEmployee = rules.nationalPension.rateEmployee.value;
  const npNextEmployee = nextYearRates.nationalPensionEmployee;
  const healthTotal = rules.healthInsurance.rateEmployee.value * 2;
  const employmentEmployee = rules.employmentInsurance.rateEmployee.value;
  const baseRange = rules.nationalPension.baseMonthly.from_2026_07;

  // citable shell 예시 — 엔진으로 빌드 시 재계산 (rules 교체 시 예시 숫자도 자동 갱신).
  const ex300 = computeInsuranceDiff(
    { monthlySalary: 3_000_000, age60Plus: false },
    rules,
    nextYearRates,
  );
  const ex700 = computeInsuranceDiff(
    { monthlySalary: 7_000_000, age60Plus: false },
    rules,
    nextYearRates,
  );
  const ex60 = computeInsuranceDiff(
    { monthlySalary: 3_000_000, age60Plus: true },
    rules,
    nextYearRates,
  );
  const np300 = ex300.rows[0];
  const np700 = ex700.rows[0];

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-10">
      {/* ① 한 줄 정의 */}
      <h1 className="t-h1">{NEXT_YEAR} 4대보험 인상분 계산기</h1>
      <p className="t-body-l mt-4">
        월급 하나만 넣으면 {ACTIVE_YEAR}년과 {NEXT_YEAR}년의 4대보험(국민연금·건강보험·장기요양·
        고용보험) 월 공제액을 나란히 비교해, 내년에 매달 얼마를 더 내게 되는지 보여 드리는
        도구입니다. 이미 확정된 국민연금 인상분({pct(npTotal)} →{" "}
        {npNextTotal !== null ? pct(npNextTotal) : "미정"})은 지금 바로 계산되고, 아직 발표되지
        않은 항목은 12월 발표 즉시 반영됩니다.
      </p>
      <p className="t-body mt-2">
        입력하신 월급은 서버로 전송되지 않고 이 화면 안에서만 계산됩니다.
      </p>

      {/* 계산기 (클라이언트) */}
      <div className="mt-8">
        <InsuranceRateCalculator />
      </div>

      <AdSlot position="insurance-below-calc" />

      {/* ② 평문 산식 */}
      <section className="mt-14">
        <h2 className="t-h2">계산 방법 (산식)</h2>
        <p className="t-body-l">
          <strong>각 보험료 = 월급 × 근로자 부담 요율</strong> — 인상분은 올해와 내년 보험료의
          차액입니다.
        </p>
        <ul className="t-body-l">
          <li>
            국민연금은 월급 그대로가 아니라 <strong>기준소득월액</strong>에 요율을 곱해요. 하한{" "}
            {wonKorean(baseRange?.min ?? 0)}~상한 {wonKorean(baseRange?.max ?? 0)} 범위를 벗어나는
            월급은 그 경계값으로 계산됩니다.
          </li>
          <li>
            <strong>60세 이상은 국민연금 공제가 없어요</strong> — 사업장가입 대상에서 제외되기
            때문이에요.
          </li>
          <li>
            장기요양보험료는 요율이 따로 있지 않고 <strong>건강보험료에서 파생</strong>돼요:{" "}
            {rules.healthInsurance.longTermCare.formula}.
          </li>
          <li>
            아직 발표되지 않은 내년 요율은 추측하지 않아요 — 해당 항목은 &ldquo;12월 발표
            예정&rdquo;으로 표시하고, 합계는 확정분 기준으로만 계산합니다.
          </li>
        </ul>
      </section>

      {/* ③ 계산 예시 (엔진 재계산 값) */}
      <section className="mt-12">
        <h2 className="t-h2">계산 예시</h2>
        <ul className="t-body-l">
          <li>
            월급 300만원(60세 미만) — 올해 4대보험 공제 합계 월 {won(ex300.totalCurrent)}:
            확정된 국민연금 인상분만으로 내년엔{" "}
            <strong>
              매달 {won(ex300.totalDiffMonthly)}(연 {won(ex300.totalDiffAnnual)})을 더
            </strong>{" "}
            내게 됩니다.
          </li>
          <li>
            월급 700만원 — 국민연금은 기준소득월액 상한 {wonKorean(baseRange?.max ?? 0)}까지만
            부과돼요: 올해 {won(np700.currentMonthly)}, 내년{" "}
            {won(np700.nextMonthly ?? 0)}으로 <strong>월급이 더 높아도 인상분은 같습니다</strong>.
          </li>
          <li>
            월급 300만원(60세 이상) — 국민연금 공제가 없어 확정 기준 인상분은 0원이에요. 건강보험
            등 나머지 공제 합계 월 {won(ex60.totalCurrent)}은 그대로이고, 내년 변동은 12월 발표될
            장기요양·고용보험에 달려 있습니다.
          </li>
        </ul>
      </section>

      {/* ④ 기준 수치 표 + 출처 */}
      <section className="mt-12">
        <h2 className="t-h2">
          {ACTIVE_YEAR} vs {NEXT_YEAR} 요율표
        </h2>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>항목</th>
              <th className="num">{ACTIVE_YEAR}년</th>
              <th className="num">{NEXT_YEAR}년</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>국민연금 (총요율 — 근로자는 절반 부담)</td>
              <td className="num">{pct(npTotal)}</td>
              <td className="num">
                {npNextTotal !== null ? `${pct(npNextTotal)} (법률상 확정)` : "12월 발표 예정"}
              </td>
            </tr>
            <tr>
              <td>건강보험 (총요율 — 근로자는 절반 부담)</td>
              <td className="num">{pct(healthTotal)}</td>
              <td className="num">
                {nextYearRates.healthEmployee !== null
                  ? `${pct(nextYearRates.healthEmployee * 2)} (동결 기결정)`
                  : "12월 발표 예정"}
              </td>
            </tr>
            <tr>
              <td>장기요양 (건강보험료 기반)</td>
              <td className="num">{rules.healthInsurance.longTermCare.formula}</td>
              <td className="num">
                {nextYearRates.longTermCareFormula ?? "12월 발표 예정"}
              </td>
            </tr>
            <tr>
              <td>고용보험 (근로자 부담)</td>
              <td className="num">{pct(employmentEmployee)}</td>
              <td className="num">
                {nextYearRates.employmentEmployee !== null
                  ? pct(nextYearRates.employmentEmployee)
                  : "인상안 심의 중 — 12월 발표 예정"}
              </td>
            </tr>
            <tr>
              <td>국민연금 기준소득월액 하한~상한</td>
              <td className="num">
                {wonKorean(baseRange?.min ?? 0)}~{wonKorean(baseRange?.max ?? 0)}
              </td>
              <td className="num">미고시 — 올해 기준 적용</td>
            </tr>
          </tbody>
        </table>
        <p className="t-body mt-3">이 표는 발표 즉시 갱신됩니다.</p>
        <p className="t-caption mt-1">
          출처: {rules.nationalPension.rateTotal.source} ·{" "}
          {rules.healthInsurance.rateEmployee.source} ·{" "}
          {rules.healthInsurance.next2027?.source}
        </p>
      </section>

      {/* ⑤ 결과 해석 가이드 */}
      <section className="mt-12">
        <h2 className="t-h2">결과를 어떻게 볼까요</h2>
        <p className="t-body-l">
          국민연금 인상은 한 해로 끝나지 않습니다 — 연금개혁에 따라{" "}
          <strong>&ldquo;{rules.nationalPension.rateTotal.note}&rdquo;</strong> 일정이 법으로 정해져
          있어요. 즉 올해 계산된 인상분과 비슷한 수준의 인상이 앞으로 매년 반복됩니다. 건강보험은{" "}
          {NEXT_YEAR}년까지 동결이 결정돼 있고, 장기요양·고용보험은 연말에 확정되므로 지금 보이는
          차액은 <strong>최소치</strong>로 보시는 게 안전합니다. 12월 발표가 나오면 이 계산기의
          표가 즉시 갱신됩니다.
        </p>
      </section>

      {/* ⑥ FAQ */}
      <FaqBlock
        tool="insurance-rate"
        items={[
          {
            q: "국민연금 보험료는 왜 오르나요?",
            a: `2026년부터 시작된 연금개혁 때문이에요. 국민연금 총 보험료율이 ${ACTIVE_YEAR}년 ${pct(npTotal)}에서 ${NEXT_YEAR}년 ${npNextTotal !== null ? pct(npNextTotal) : "인상"}으로 오르는 것이 법률로 확정돼 있어요 (${rules.nationalPension.rateTotal.note}). 회사가 절반을 부담하므로 월급에서 실제로 더 빠지는 건 인상분의 절반입니다.`,
          },
          {
            q: "매년 얼마씩 오르나요?",
            a: `연금개혁 일정상 "${rules.nationalPension.rateTotal.note}" — 근로자 부담 기준으로는 매년 약 ${npNextEmployee !== null ? pct(npNextEmployee - npEmployee) : "0.25%"}p씩이에요. 월급 300만원이면 매달 약 ${won(np300.diffMonthly ?? 0)}씩, 해가 바뀔 때마다 그만큼씩 더 내게 됩니다.`,
          },
          {
            q: "제 월급에서는 얼마나 오르나요?",
            a: `확정된 것 기준으로 국민연금 인상분은 월급의 약 ${npNextEmployee !== null ? pct(npNextEmployee - npEmployee) : "0.25%"}예요. 예를 들어 월급 300만원이면 월 ${won(np300.diffMonthly ?? 0)}(연 ${won((np300.diffMonthly ?? 0) * 12)}), 월급이 기준소득월액 상한(${wonKorean(baseRange?.max ?? 0)})을 넘으면 그 이상은 오르지 않아요. 위 계산기에 월급만 넣으면 항목별 표로 바로 확인할 수 있어요.`,
          },
          {
            q: "60세가 넘으면 어떻게 되나요?",
            a: `60세 이상은 국민연금 사업장가입 대상에서 제외돼 국민연금 공제가 없어요. 따라서 이번에 확정된 국민연금 인상의 영향도 받지 않습니다. 건강보험·장기요양·고용보험은 나이와 관계없이 계속 공제되고, 이 항목들의 내년 요율은 12월 발표 예정이에요.`,
          },
        ]}
      />

      <SourceBadge asOf={rules._meta.asOf} source="국민연금공단·건강보험공단 고시 및 발표" />
    </div>
  );
}
