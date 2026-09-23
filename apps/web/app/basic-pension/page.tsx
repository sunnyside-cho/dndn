import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { AudienceLabel } from "@/components/AudienceLabel";
import { FaqBlock } from "@/components/FaqBlock";
import { SourceBadgeFromMeta } from "@/components/SourceBadge";
import { basicPensionRules as rules, ACTIVE_YEAR } from "@/data/rules";
import { computeBasicPension } from "@/features/basic-pension/engine";
import { BasicPensionCalculator } from "@/features/basic-pension/components/Calculator";
import { won, wonKorean } from "@/lib/format";

export const metadata: Metadata = {
  title: `기초연금 모의계산 — ${ACTIVE_YEAR}년 기준`,
  description: `나이·소득·재산만 넣으면 ${ACTIVE_YEAR}년 선정기준액으로 기초연금 수급 가능성과 예상 금액을 바로 계산합니다. 가입 없음, 입력값 저장 안 함.`,
};

// citable shell 예시 — rules 로 빌드 시 재계산 (TOOL_SPEC: "예시 수치는 rules 파일로 재계산해
// 일치 확인"). rules 교체 시 예시 문장의 숫자도 자동 갱신된다.
const exampleBase = {
  birthYear: ACTIVE_YEAR - 68,
  hasOccupationalPension: false,
  spouseEligible: true,
  laborIncomeSelf: 0,
  laborIncomeSpouse: 0,
  npsSelf: 0,
  npsSpouse: 0,
  otherIncomeMonthly: 0,
  interestIncomeMonthly: 0,
  generalAssets: 0,
  rentDeposit: 0,
  financialAssets: 0,
  debts: 0,
  luxuryCarValue: 0,
  membershipValue: 0,
  freeRentHousePrice: 0,
} as const;

export default function BasicPensionPage() {
  const single = rules.selectionCriteria.single.value;
  const couple = rules.selectionCriteria.couple.value;
  const baseMax = rules.basePension.monthlyMax.value;

  const ex1 = computeBasicPension(
    {
      ...exampleBase,
      household: "single",
      region: "city",
      laborIncomeSelf: 1_500_000,
      generalAssets: 120_000_000,
      financialAssets: 30_000_000,
    },
    rules,
  );
  const ex2 = computeBasicPension(
    {
      ...exampleBase,
      household: "couple",
      region: "metro",
      npsSelf: 600_000,
      npsSpouse: 600_000,
      generalAssets: 300_000_000,
    },
    rules,
  );
  const ex3 = computeBasicPension(
    { ...exampleBase, household: "single", region: "city", otherIncomeMonthly: 2_350_000 },
    rules,
  );

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-10">
      {/* ① 한 줄 정의 */}
      <h1 className="t-h1">기초연금 모의계산</h1>
      <p className="t-body-l mt-4">
        기초연금은 만 65세 이상이고 소득인정액이 선정기준액(
        {ACTIVE_YEAR}년 단독가구 월 {won(single)}, 부부가구 월 {won(couple)}) 이하인 분께 매달
        최대 {won(baseMax)}을 지급하는 제도입니다. 아래 문답에 답하면 수급 가능성과 예상 금액을
        바로 계산해 드립니다.
      </p>
      <p className="t-body mt-2">
        입력하신 소득·재산은 서버로 전송되지 않고 이 화면 안에서만 계산됩니다.
      </p>

      <AudienceLabel>
        지금 자격이 궁금한 만 65세 전후 분, 그리고 &lsquo;나중에 받을 수 있을까&rsquo; 미리
        보고 싶은 50~60대 분께요 — 65세 미만도 예비 계산으로 끝까지 계산해 드려요.
      </AudienceLabel>

      {/* 계산기 (클라이언트) */}
      <div className="mt-8">
        <BasicPensionCalculator />
      </div>

      <AdSlot position="basic-pension-below-calc" />

      {/* ② 평문 산식 */}
      <section className="mt-14">
        <h2 className="t-h2">계산 방법 (산식)</h2>
        <p className="t-body-l">
          <strong>소득인정액 = 소득평가액 + 재산의 소득환산액</strong>
        </p>
        <ul className="t-body-l">
          <li>
            소득평가액 = {(1 - rules.incomeEvaluation.laborExtraDeductionRate.value) * 100}% ×
            (근로소득 − {wonKorean(rules.incomeEvaluation.laborBasicDeduction.value)}) +
            연금·사업·임대소득 + (이자소득 − {wonKorean(rules.incomeEvaluation.interestDeduction.value)})
          </li>
          <li>
            재산의 소득환산액 = [(일반재산 − 지역별 기본재산 공제) + (금융재산 −{" "}
            {wonKorean(rules.assetConversion.financialDeduction.value)}) − 부채] ×{" "}
            {rules.assetConversion.conversionRateAnnual.value * 100}% ÷ 12개월 + 고급자동차·회원권
            가액
          </li>
          <li>
            소득인정액이 선정기준액 이하면 수급 — 부부 모두 받으면 각{" "}
            {rules.basePension.coupleReductionRate.value * 100}% 감액되고, 소득이 기준에 가까우면
            차액만큼만 지급됩니다(소득역전방지).
          </li>
        </ul>
      </section>

      {/* ③ 계산 예시 (rules 재계산 값) */}
      <section className="mt-12">
        <h2 className="t-h2">계산 예시</h2>
        <ul className="t-body-l">
          <li>
            혼자 사는 중소도시 거주자 — 월 근로소득 150만원, 공시가 1억 2천만원 아파트, 예금
            3천만원: 소득인정액 {won(ex1.recognizedIncome)} → 기준 이하로{" "}
            <strong>월 {won(ex1.estimatedMonthly ?? 0)} 전액 수급 예상</strong>
          </li>
          <li>
            대도시 부부 — 국민연금 각 60만원, 공시가 3억원 주택: 소득인정액{" "}
            {won(ex2.recognizedIncome)} → 부부 감액 적용 시 합산{" "}
            <strong>월 {won(ex2.estimatedMonthly ?? 0)} 예상</strong> (국민연금 연계 감액 가능성
            있음 — 공단 확인 필요)
          </li>
          <li>
            혼자 살며 소득인정액이 {won(ex3.recognizedIncome)}인 경우: 기준과의 차액만 지급되어{" "}
            <strong>월 {won(ex3.estimatedMonthly ?? 0)} 부분 수급</strong>
          </li>
        </ul>
      </section>

      {/* ④ 기준 수치 표 + 출처 */}
      <section className="mt-12">
        <h2 className="t-h2">{ACTIVE_YEAR}년 기준 수치</h2>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>항목</th>
              <th className="num">금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>선정기준액 — 단독가구</td>
              <td className="num">월 {won(single)}</td>
            </tr>
            <tr>
              <td>선정기준액 — 부부가구</td>
              <td className="num">월 {won(couple)}</td>
            </tr>
            <tr>
              <td>기준연금액 (최대 지급액)</td>
              <td className="num">월 {won(baseMax)}</td>
            </tr>
            <tr>
              <td>근로소득 기본공제</td>
              <td className="num">월 {wonKorean(rules.incomeEvaluation.laborBasicDeduction.value)}</td>
            </tr>
            <tr>
              <td>금융재산 공제</td>
              <td className="num">{wonKorean(rules.assetConversion.financialDeduction.value)}</td>
            </tr>
            <tr>
              <td>기본재산 공제 (대도시/중소도시/농어촌)</td>
              <td className="num">
                {wonKorean(rules.assetConversion.basicDeduction.metro.value)} /{" "}
                {wonKorean(rules.assetConversion.basicDeduction.city.value)} /{" "}
                {wonKorean(rules.assetConversion.basicDeduction.rural.value)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="t-caption mt-2">
          출처: {rules._meta.primarySources?.["고시"]} · {rules._meta.primarySources?.["법"]}.
          기본재산 공제 3종은 고시 별표 원문 재확인 중인 값이에요.
        </p>
      </section>

      {/* ⑤ 결과 해석 가이드 */}
      <section className="mt-12">
        <h2 className="t-h2">결과를 어떻게 볼까요</h2>
        <p className="t-body-l">
          이 계산은 공식 산식을 그대로 따르지만, 실제 수급 여부는 국민연금공단이 소득·재산을
          조사해 결정합니다. 국민연금을 월 52만원 넘게 받는 분은 연계 감액이 있을 수 있어 예상
          금액이 달라질 수 있습니다. 기준을 조금 넘겨 탈락으로 나온 분은 선정기준액이 해마다
          오르는 추세이니 새해에 다시 계산해 보세요.
        </p>
      </section>

      {/* ⑥ FAQ */}
      <FaqBlock
        tool="basic-pension"
        items={[
          {
            q: "기초연금 수급 자격은 어떻게 되나요?",
            a: `만 65세 이상이고, 소득인정액(소득 + 재산의 월 환산액)이 선정기준액 이하면 받을 수 있어요. ${ACTIVE_YEAR}년 선정기준액은 단독가구 월 ${won(single)}, 부부가구 월 ${won(couple)}입니다. 공무원·군인·사학연금 수급자(배우자 포함)는 제외돼요.`,
          },
          {
            q: "재산이 있으면 기초연금을 못 받나요?",
            a: `재산이 있다고 무조건 탈락하는 건 아니에요. 사는 지역에 따라 기본재산 공제(대도시 ${wonKorean(rules.assetConversion.basicDeduction.metro.value)}, 중소도시 ${wonKorean(rules.assetConversion.basicDeduction.city.value)}, 농어촌 ${wonKorean(rules.assetConversion.basicDeduction.rural.value)})를 먼저 빼고, 남은 금액의 연 ${rules.assetConversion.conversionRateAnnual.value * 100}%만 월 소득으로 환산해요. 공시가 기준이라 생각보다 여유가 있는 경우가 많아요.`,
          },
          {
            q: "부부가 같이 받으면 얼마나 깎이나요?",
            a: `부부가 모두 받으면 각자 ${rules.basePension.coupleReductionRate.value * 100}%씩 감액돼요. ${ACTIVE_YEAR}년 기준 1인 최대 ${won(baseMax)}이므로, 부부 합산 최대 월 ${won(Math.round(baseMax * (1 - rules.basePension.coupleReductionRate.value) * 2))}이 됩니다.`,
          },
          {
            q: "국민연금을 받으면 기초연금이 깎이나요?",
            a: `국민연금 월액이 기준연금액의 150%(약 ${won(Math.round(baseMax * rules.npsLink.fullPaymentThresholdRate.value))}) 이하면 전액 받아요. 그보다 많이 받으면 가입 기간에 따라 일부 감액될 수 있어요 — 정확한 금액은 국민연금공단(1355)에서 확인하세요.`,
          },
          {
            q: "자녀 명의 집에 살면 불리한가요?",
            a: `자녀 명의의 시가표준액 6억원 이상 주택에 무상으로 살면 '무료임차소득'(연 ${rules.incomeEvaluation.freeRentRate.value * 100}%)이 소득에 더해져요. 6억원 미만 주택은 해당되지 않아요.`,
          },
          {
            q: "신청은 언제, 어떻게 하나요?",
            a: "만 65세 생일이 있는 달의 한 달 전부터 신청할 수 있어요. 주소지 주민센터에 방문하거나 복지로(bokjiro.go.kr)에서 온라인으로 신청하면 되고, 본인 통장과 신분증이 필요해요.",
          },
        ]}
      />

      <SourceBadgeFromMeta meta={rules._meta} />
    </div>
  );
}
