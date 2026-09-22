import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { FaqBlock } from "@/components/FaqBlock";
import { SourceBadge } from "@/components/SourceBadge";
import { insuranceRules as rules, simplifiedTaxTable, ACTIVE_YEAR } from "@/data/rules";
import { computeSalarySenior } from "@/features/salary-senior/engine";
import { SalarySeniorCalculator } from "@/features/salary-senior/components/Calculator";
import { won } from "@/lib/format";

export const metadata: Metadata = {
  title: "은퇴 후 재취업 연봉 실수령 계산기 — 60세 이상 국민연금 면제 반영",
  description: `은퇴 후 재취업·촉탁직·계약직 월급에서 4대보험이 얼마나 빠지는지 ${ACTIVE_YEAR}년 요율로 계산합니다. 60세 이상은 국민연금을 떼지 않는 것까지 반영. 가입 없음, 입력값 저장 안 함.`,
};

/** 요율 표기: 0.03595 → "3.595%" (부동소수 잔재 반올림) */
function pct(v: number): string {
  return `${(v * 100).toLocaleString("ko-KR", { maximumFractionDigits: 3 })}%`;
}

export default function SalarySeniorPage() {
  const npRate = rules.nationalPension.rateEmployee.value;
  const healthRate = rules.healthInsurance.rateEmployee.value;
  const empRate = rules.employmentInsurance.rateEmployee.value;
  const ltcFormula = rules.healthInsurance.longTermCare.formula;
  const baseRange = rules.nationalPension.baseMonthly.from_2026_07;
  const taxPending = simplifiedTaxTable.rows.length === 0;

  // citable shell 예시 — 엔진으로 빌드 시 재계산 (rules 교체 시 숫자 자동 갱신).
  // 같은 월급 300만원, 62세 vs 58세 — 차이가 국민연금 공제라는 것을 보여주는 게 핵심.
  const ex62 = computeSalarySenior(
    { age: 62, monthlySalary: 3_000_000, dependents: 1 },
    rules,
    simplifiedTaxTable,
  );
  const ex58 = computeSalarySenior(
    { age: 58, monthlySalary: 3_000_000, dependents: 1 },
    rules,
    simplifiedTaxTable,
  );

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-10">
      {/* ① 한 줄 정의 — 은퇴 후 재취업 전용 각도 (범용 아님) */}
      <h1 className="t-h1">재취업 연봉 실수령 계산기</h1>
      <p className="t-body-l mt-4">
        은퇴 후 재취업·촉탁직·계약직으로 다시 일을 시작하는 분을 위한 월급 실수령 계산기입니다.
        일반 직장인용 범용 계산기와 달리 <strong>60세 이상은 국민연금 보험료를 떼지 않는다</strong>는
        점(사업장가입 제외)을 반영해 계산합니다.
      </p>
      {taxPending ? (
        <p className="t-body mt-2">
          지금은 {ACTIVE_YEAR}년 근로소득 간이세액표(소득세)가 수록되기 전이라{" "}
          <strong>4대보험 공제까지만</strong> 계산해요 — 소득세·지방소득세는 결과에서 제외됩니다.
        </p>
      ) : null}
      <p className="t-body mt-2">
        입력하신 나이·월급은 서버로 전송되지 않고 이 화면 안에서만 계산됩니다.
      </p>

      {/* 계산기 (클라이언트) */}
      <div className="mt-8">
        <SalarySeniorCalculator />
      </div>

      <AdSlot position="salary-below-calc" />

      {/* ② 평문 산식 */}
      <section className="mt-14">
        <h2 className="t-h2">계산 방법 (산식)</h2>
        <p className="t-body-l">
          <strong>실수령액 = 세전 월급 − (국민연금 + 건강보험 + 장기요양 + 고용보험 + 소득세 +
          지방소득세)</strong>
        </p>
        <ul className="t-body-l">
          <li>
            국민연금 = 월급
            {baseRange ? ` (${won(baseRange.min)}~${won(baseRange.max)} 구간으로 제한)` : ""} ×{" "}
            {pct(npRate)} — <strong>60세 이상은 0원</strong> (사업장가입 제외)
          </li>
          <li>
            건강보험 = 월급 × {pct(healthRate)} · 장기요양 = {ltcFormula} · 고용보험 = 월급 ×{" "}
            {pct(empRate)}
          </li>
          <li>
            소득세는 국세청 근로소득 간이세액표에서 월급 구간·부양가족 수로 찾고, 지방소득세는 그
            10%예요.
            {taxPending
              ? " 지금은 간이세액표 수록 전이라 이 두 항목은 계산에서 제외합니다."
              : null}
          </li>
        </ul>
      </section>

      {/* ③ 계산 예시 (엔진 재계산 값) — 62세 vs 58세, 차이 = 국민연금 */}
      <section className="mt-12">
        <h2 className="t-h2">계산 예시 — 같은 월급, 나이만 다를 때</h2>
        <ul className="t-body-l">
          <li>
            62세 · 월 300만원: 국민연금 {won(ex62.nationalPension)} + 건강보험 {won(ex62.health)} +
            장기요양 {won(ex62.longTermCare)} + 고용보험 {won(ex62.employment)} → 공제{" "}
            {won(ex62.totalDeduction)}, <strong>월 {won(ex62.net)}</strong>
            {taxPending ? " (소득세 반영 전)" : ""}
          </li>
          <li>
            58세 · 월 300만원: 국민연금 {won(ex58.nationalPension)}이 더해져 공제{" "}
            {won(ex58.totalDeduction)}, <strong>월 {won(ex58.net)}</strong>
            {taxPending ? " (소득세 반영 전)" : ""}
          </li>
          <li>
            두 사람의 차이 <strong>{won(ex62.net - ex58.net)}</strong>은 전부 국민연금 보험료예요 —
            60세 이상은 이만큼 실수령이 늘어납니다.
          </li>
        </ul>
      </section>

      {/* ④ 기준 수치 표 + 출처 */}
      <section className="mt-12">
        <h2 className="t-h2">{ACTIVE_YEAR}년 기준 수치 (근로자 부담분)</h2>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>항목</th>
              <th className="num">요율·금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>국민연금 (60세 미만)</td>
              <td className="num">{pct(npRate)}</td>
            </tr>
            <tr>
              <td>건강보험</td>
              <td className="num">{pct(healthRate)}</td>
            </tr>
            <tr>
              <td>장기요양보험</td>
              <td className="num">{ltcFormula}</td>
            </tr>
            <tr>
              <td>고용보험</td>
              <td className="num">{pct(empRate)}</td>
            </tr>
            {baseRange ? (
              <tr>
                <td>국민연금 기준소득월액 하한·상한 ({ACTIVE_YEAR}.7.부터)</td>
                <td className="num">
                  {won(baseRange.min)} / {won(baseRange.max)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p className="t-caption mt-2">
          출처: 각 보험 요율 고시 (국민연금공단·국민건강보험공단·고용노동부) — {rules.verifyAgainst}
          와 대조
        </p>
      </section>

      {/* ⑤ 결과 해석 가이드 */}
      <section className="mt-12">
        <h2 className="t-h2">결과를 어떻게 볼까요</h2>
        <p className="t-body-l">
          같은 월급이라도 60세 이상이 실수령이 더 많은 이유는 국민연금 사업장가입 의무가{" "}
          <strong>60세 미만까지</strong>이기 때문이에요. 60세가 넘으면 회사가 국민연금 보험료를
          공제하지 않아 월급의 {pct(npRate)}만큼 손에 쥐는 돈이 늘어납니다. 다만 국민연금(노령연금)을
          이미 받으면서 일하시는 경우, 소득이 전체 가입자 평균을 넘으면 받기 시작한 나이부터 5년간
          연금이 일부 감액될 수 있어요(재직자 노령연금) — 감액 여부는 국민연금공단(1355)에서
          확인하는 게 정확해요.
          {taxPending
            ? " 그리고 지금 결과는 소득세·지방소득세를 반영하기 전 금액이니, 세금은 홈택스 간이세액표 조견표에서 따로 확인해 주세요."
            : null}
        </p>
      </section>

      {/* ⑥ FAQ */}
      <FaqBlock
        tool="salary-senior"
        items={[
          {
            q: "60세가 넘으면 국민연금을 정말 안 떼나요?",
            a: `네. 국민연금 사업장가입은 60세 미만까지가 의무라서, 60세 이상 근로자는 회사가 국민연금 보험료를 공제하지 않아요. 같은 월급이면 60세 미만일 때보다 월급의 ${pct(npRate)}만큼 실수령이 늘어나는 셈이에요. 다만 가입 기간을 더 채우고 싶어 '임의계속가입'을 신청한 경우에는 보험료 전액을 본인이 부담하며 계속 낼 수 있어요.`,
          },
          {
            q: "국민연금을 받으면서 일하면 연금이 깎이나요?",
            a: "연금을 받기 시작한 나이부터 5년 동안은, 월평균 소득이 국민연금 전체 가입자의 평균소득을 넘으면 초과 소득 구간에 따라 노령연금이 일부 감액될 수 있어요(재직자 노령연금). 평균소득 이하라면 감액되지 않아요. 감액 여부와 금액은 국민연금공단(1355)에서 확인하는 게 정확해요.",
          },
          {
            q: "계약직·촉탁직도 4대보험에 가입하나요?",
            a: "네, 고용 형태와 관계없이 월 60시간(주 15시간) 이상 일하면 직장 4대보험이 적용돼요. 다만 나이에 따른 예외가 있어요 — 국민연금은 60세 이상이면 공제하지 않고, 65세 이후에 새로 고용된 경우에는 고용보험의 실업급여 몫 보험료를 떼지 않아요. 이 계산기는 고용보험료를 일괄 반영하므로 65세 이후 신규 취업이라면 실제 공제액이 조금 더 적을 수 있어요.",
          },
          {
            q: "세금(소득세)은 왜 이만큼 떼나요?",
            a: `월급에서 떼는 소득세는 국세청 '근로소득 간이세액표'에서 월급 구간과 부양가족 수로 정해지는 원천징수액이고, 지방소득세는 그 10%예요. 실제 세금은 다음 해 연말정산에서 정산되므로 매달 떼는 금액과 최종 세금은 다를 수 있어요.${taxPending ? " 지금 이 계산기는 간이세액표 수록 전이라 소득세를 계산에서 제외하고 있어요 — 정확한 금액은 홈택스 조견표(nts.go.kr)에서 확인할 수 있어요." : ""}`,
          },
        ]}
      />

      {/* 이 도구는 rules 2개(요율·간이세액표)를 쓴다 — 기준일은 둘 중 최신 (ISO 문자열 비교) */}
      <SourceBadge
        asOf={
          simplifiedTaxTable._meta.asOf > rules._meta.asOf
            ? simplifiedTaxTable._meta.asOf
            : rules._meta.asOf
        }
        source="4대보험 요율 고시·국세청 근로소득 간이세액표"
      />
    </div>
  );
}
