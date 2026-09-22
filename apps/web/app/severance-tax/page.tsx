import type { Metadata } from "next";
import type { SeveranceInput } from "@contracts/shared-types";
import { AdSlot } from "@/components/AdSlot";
import { FaqBlock } from "@/components/FaqBlock";
import { SourceBadge } from "@/components/SourceBadge";
import { severanceRules as rules, ACTIVE_YEAR } from "@/data/rules";
import { computeSeverance, parseServiceYearFormula } from "@/features/severance-tax/engine";
import { SeveranceCalculator } from "@/features/severance-tax/components/Calculator";
import { won, wonKorean } from "@/lib/format";

export const metadata: Metadata = {
  title: `퇴직금 세금·IRP 절세 계산기 — ${ACTIVE_YEAR}년 기준`,
  description: `퇴직금과 입사일·퇴직일만 넣으면 ${ACTIVE_YEAR}년 소득세법 기준 퇴직소득세와, IRP 연금으로 받을 때 줄어드는 세금을 바로 비교합니다. 가입 없음, 입력값 저장 안 함.`,
};

// citable shell 예시 — rules 로 빌드 시 재계산 (TOOL_SPEC: "예시 수치는 rules 파일로 재계산해
// 일치 확인"). rules 교체 시 예시 문장의 숫자도 자동 갱신된다.
const EX1: SeveranceInput = {
  severancePay: 100_000_000,
  joinDate: "2006-01-01",
  leaveDate: "2025-12-31", // 근속 20년
};
const EX2: SeveranceInput = {
  severancePay: 300_000_000,
  joinDate: "2016-01-01",
  leaveDate: "2025-12-31", // 근속 10년 — 고액·단기 케이스
};

const pct = (v: number) => Math.round(v * 100);

/** 근속연수 구간 라벨 — brackets 의 maxYears 로 조립 */
function yearsRangeLabel(brackets: Array<{ maxYears: number | null }>, i: number): string {
  const cur = brackets[i].maxYears;
  const prev = i > 0 ? brackets[i - 1].maxYears : null;
  if (cur === null) return `${prev}년 초과`;
  return prev === null ? `${cur}년 이하` : `${prev}년 초과 ~ ${cur}년 이하`;
}

/** 금액 구간 라벨 — rows 의 max 로 조립 */
function amountRangeLabel(rows: Array<{ max: number | null }>, i: number): string {
  const cur = rows[i].max;
  const prev = i > 0 ? rows[i - 1].max : null;
  if (cur === null) return `${wonKorean(prev ?? 0)} 초과`;
  return prev === null
    ? `${wonKorean(cur)} 이하`
    : `${wonKorean(prev)} 초과 ~ ${wonKorean(cur)} 이하`;
}

/** rules formula 문자열을 사람이 읽는 산식으로 (엔진 파서 재사용 — 상수 하드코딩 금지) */
function formulaText(formula: string): string {
  const f = parseServiceYearFormula(formula);
  if (f.base === 0 && f.offset === 0) return `근속연수 × ${wonKorean(f.per)}`;
  return `${wonKorean(f.base)} + (근속연수 − ${f.offset}년) × ${wonKorean(f.per)}`;
}

export default function SeveranceTaxPage() {
  const ex1 = computeSeverance(EX1, rules);
  const ex2 = computeSeverance(EX2, rules);
  const ex1Long = ex1.irpOptions[ex1.irpOptions.length - 1];
  const ex2Long = ex2.irpOptions[ex2.irpOptions.length - 1];

  const discountRows = rules.irp.pensionDiscount.rows;
  const longYears =
    discountRows.length >= 2 ? discountRows[discountRows.length - 2].yearsMax : null;
  const longPct = pct(1 - discountRows[discountRows.length - 1].payRate);
  const localPct = pct(rules.localTaxRate.value);
  const taxRows = rules.taxBrackets.rows;
  const minRate = pct(taxRows[0].rate);
  const maxRate = pct(taxRows[taxRows.length - 1].rate);

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-10">
      {/* ① 한 줄 정의 */}
      <h1 className="t-h1">퇴직금 세금·IRP 절세 계산기</h1>
      <p className="t-body-l mt-4">
        퇴직금을 일시금으로 받을 때 내는 <strong>퇴직소득세</strong>와, IRP(개인형
        퇴직연금)로 나눠 받을 때 줄어드는 세금을 {ACTIVE_YEAR}년 소득세법 기준으로 계산해
        비교하는 도구입니다. {ACTIVE_YEAR}년부터 {longYears}년 넘게 나눠 받으면 퇴직소득세가{" "}
        {longPct}% 감면되는 규칙이 새로 생겨서, 받는 방법에 따라 세금 차이가 더 커졌어요.
      </p>
      <p className="t-body mt-2">
        입력하신 금액과 날짜는 서버로 전송되지 않고 이 화면 안에서만 계산됩니다.
      </p>

      {/* 계산기 (클라이언트) */}
      <div className="mt-8">
        <SeveranceCalculator />
      </div>

      <AdSlot position="severance-below-calc" />

      {/* ② 평문 산식 */}
      <section className="mt-14">
        <h2 className="t-h2">계산 방법 (산식)</h2>
        <ol className="t-body-l">
          <li>
            <strong>근속연수공제</strong> — 일한 연수(1년 미만은 1년으로 올림)에 따라 퇴직금에서
            먼저 빼 줍니다. 오래 일할수록 공제가 커져요.
          </li>
          <li>
            <strong>환산급여</strong> = (퇴직금 − 근속연수공제) ÷ 근속연수 × 12. 퇴직금을 1년치
            급여로 바꿔 본 금액이에요.
          </li>
          <li>
            환산급여에서 <strong>환산급여공제</strong>를 뺀 과세표준에 기본세율({minRate}~
            {maxRate}%)을 적용해 환산산출세액을 구합니다.
          </li>
          <li>
            <strong>퇴직소득세 = 환산산출세액 ÷ 12 × 근속연수</strong>. 여기에 지방소득세{" "}
            {localPct}%가 더해져요 (지방소득세율은 재확인 중입니다).
          </li>
          <li>
            <strong>IRP로 이체하면</strong> 이 세금을 떼지 않고 미뤄 두었다가(과세이연), 연금으로
            받는 기간에 따라 이연된 세금의{" "}
            {discountRows.map((r) => `${pct(r.payRate)}%`).join(" / ")}만 나눠서 부담합니다.
          </li>
        </ol>
      </section>

      {/* ③ 계산 예시 (rules 재계산 값) */}
      <section className="mt-12">
        <h2 className="t-h2">계산 예시</h2>
        <ul className="t-body-l">
          <li>
            퇴직금 {wonKorean(EX1.severancePay)}·근속 {ex1.serviceYears}년 — 근속연수공제{" "}
            {wonKorean(ex1.serviceYearDeduction)} → 환산급여 {wonKorean(ex1.convertedSalary)} →
            과세표준 {wonKorean(ex1.taxBase)} → 퇴직소득세 {won(ex1.incomeTax)} + 지방소득세{" "}
            {won(ex1.localTax)} = <strong>총 {won(ex1.totalTaxLump)}</strong>
          </li>
          <li>
            같은 조건에서 IRP로 {longYears}년 넘게 나눠 받으면 총 세 부담은 약{" "}
            {won(ex1Long.totalTax)} — <strong>{won(ex1Long.saving)} 줄어드는 것으로
            계산됩니다</strong>. {ACTIVE_YEAR}년부터 {longYears}년 넘게 나눠 받으면 퇴직소득세{" "}
            {longPct}% 감면이 새로 적용되기 때문이에요.
          </li>
          <li>
            퇴직금 {wonKorean(EX2.severancePay)}·근속 {ex2.serviceYears}년 (고액·단기) —
            과세표준 {wonKorean(ex2.taxBase)} → 일시금 총 세금 약 {wonKorean(ex2.totalTaxLump)},
            IRP {ex2Long.label} 수령 시 약 {wonKorean(ex2Long.totalTax)} (
            {wonKorean(ex2Long.saving)} 차이)
          </li>
        </ul>
      </section>

      {/* ④ 기준 수치 표 + 출처 */}
      <section className="mt-12">
        <h2 className="t-h2">{ACTIVE_YEAR}년 기준 수치</h2>

        <h3 className="t-h3 mt-6">근속연수공제</h3>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>근속연수</th>
              <th>공제액</th>
            </tr>
          </thead>
          <tbody>
            {rules.serviceYearDeduction.brackets.map((b, i, arr) => (
              <tr key={b.formula}>
                <td>{yearsRangeLabel(arr, i)}</td>
                <td>{formulaText(b.formula)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="t-h3 mt-8">기본세율 (과세표준 구간)</h3>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>과세표준</th>
              <th className="num">세율</th>
              <th className="num">구간 시작점까지의 세액</th>
            </tr>
          </thead>
          <tbody>
            {taxRows.map((row, i, arr) => (
              <tr key={`${row.rate}`}>
                <td>{amountRangeLabel(arr, i)}</td>
                <td className="num">{pct(row.rate)}%</td>
                <td className="num">{won(row.quick)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="t-h3 mt-8">IRP 연금 수령 시 감면</h3>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>연금 수령 기간</th>
              <th className="num">감면율</th>
              <th className="num">부담 비율</th>
            </tr>
          </thead>
          <tbody>
            {discountRows.map((row, i) => (
              <tr key={`${row.payRate}`}>
                <td>
                  {ex1.irpOptions[i]?.label}
                  {row.yearsMax === null ? (
                    <span className="t-caption block">
                      {ACTIVE_YEAR}년 이후 수령분부터 새로 적용
                    </span>
                  ) : null}
                </td>
                <td className="num">{pct(1 - row.payRate)}%</td>
                <td className="num">{pct(row.payRate)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="t-caption mt-3">
          출처: {rules._meta.law} · 지방소득세 {localPct}%는 지방세법 조문 재확인 중입니다.
        </p>
      </section>

      {/* ⑤ 결과 해석 가이드 */}
      <section className="mt-12">
        <h2 className="t-h2">결과를 어떻게 볼까요</h2>
        <p className="t-body-l">
          일시금으로 받으면 위 산식대로 계산된 세금을 떼고 받습니다. 퇴직금을 IRP로 이체하면
          세금을 떼지 않고 미뤄 두었다가, 55세 이후 연금으로 받는 기간에 따라 이연된 세금의
          일부만 부담해요. 특히{" "}
          <strong>
            {ACTIVE_YEAR}년부터 {longYears}년 넘게 나눠 받으면 퇴직소득세가 {longPct}%
            감면됩니다
          </strong>{" "}
          (소득세법 {rules.irp.pensionDiscount.source} — {ACTIVE_YEAR}년 신설). 다만 IRP에서
          중간에 일시금으로 찾으면 감면이 사라지고 미뤄 둔 세금을 전부 내게 되니, 절세액은
          연금으로 끝까지 받는 경우의 계산으로 보셔야 해요. 실제 유불리는 수령 기간과 운용
          결과 등 개인 상황에 따라 달라질 수 있습니다.
        </p>
      </section>

      {/* ⑥ FAQ (TOOL_SPEC FAQ 후보 6개) */}
      <FaqBlock
        tool="severance-tax"
        items={[
          {
            q: "퇴직소득세는 얼마나 떼나요?",
            a: `퇴직금 액수와 근속연수에 따라 크게 달라져요. 근속연수공제와 환산급여공제를 거치기 때문에 같은 금액이라도 오래 일했을수록 세금이 적어요. 예를 들어 퇴직금 ${wonKorean(EX1.severancePay)}·근속 ${ex1.serviceYears}년이면 지방소득세를 포함해 약 ${won(ex1.totalTaxLump)}(실효세율 약 ${Math.round((ex1.totalTaxLump / EX1.severancePay) * 1000) / 10}%)로 계산돼요. 위 계산기에 넣으면 본인 조건으로 바로 확인할 수 있어요.`,
          },
          {
            q: "IRP로 받으면 뭐가 좋나요?",
            a: `퇴직금을 IRP 계좌로 이체하면 퇴직소득세를 바로 떼지 않고 미뤄 둡니다(과세이연). 이후 연금으로 나눠 받으면 이연된 세금의 ${discountRows.map((r) => `${pct(1 - r.payRate)}%`).join("/")}가 수령 기간에 따라 감면된 채로 나눠 부담해요. 이 계산기 기준으로는 퇴직금 ${wonKorean(EX1.severancePay)}·근속 ${ex1.serviceYears}년일 때 ${longYears}년 넘게 받으면 세금이 ${won(ex1Long.saving)} 줄어드는 것으로 계산됩니다.`,
          },
          {
            q: `${longYears}년 수령 ${longPct}% 감면(${ACTIVE_YEAR}년 신설)이 뭔가요?`,
            a: `${ACTIVE_YEAR}년 1월 1일 이후 연금 수령분부터, 연금 수령 기간이 ${longYears}년을 넘으면 이연된 퇴직소득세의 ${longPct}%만 부담하는 규칙이 새로 생겼어요. 기존에는 10년 초과 수령 시 ${pct(1 - discountRows[1].payRate)}% 감면이 최대였는데, 더 길게 나눠 받을수록 감면이 커지도록 확대된 거예요.`,
          },
          {
            q: "IRP를 중간에 깨면 어떻게 되나요?",
            a: "IRP를 중도 해지하거나 연금이 아닌 일시금으로 찾으면, 미뤄 둔 퇴직소득세를 감면 없이 100% 내게 돼요. 그동안 받은 감면 혜택이 사라지는 셈이라, 급하게 목돈이 필요할 가능성이 있다면 이 점을 꼭 고려하셔야 해요.",
          },
          {
            q: "55세 전에 퇴직하면 어떻게 되나요?",
            a: "55세 미만에 퇴직하면 퇴직금은 원칙적으로 IRP 등 연금계좌로 이체받게 되어 있어요(의무이체). 이때 세금을 떼지 않고 이체되고, 연금 개시는 55세 이후에 신청할 수 있어요. 퇴직금을 이연해 넣은 경우에는 '가입 5년' 요건 없이 55세부터 개시할 수 있습니다.",
          },
          {
            q: "중간정산을 했었는데 근속연수는 어떻게 계산하나요?",
            a: "퇴직금 중간정산을 받았다면 세금 계산의 근속연수는 원칙적으로 정산 이후부터 다시 계산돼요. 이 계산기에는 정산 이후의 입사일(정산 다음 날)부터 넣어 주세요. 다만 회사를 통해 '정산특례'를 신청하면 전체 기간으로 정산받을 수 있는 경우도 있으니, 퇴직 전에 회사 담당자나 세무사에게 확인해 보시는 게 좋아요.",
          },
        ]}
      />

      <SourceBadge asOf={rules._meta.asOf} source="소득세법 (법제처 국가법령정보센터)" />
    </div>
  );
}
