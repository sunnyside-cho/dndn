import { jevApiKey } from "./lib/env.mjs";

// Jev(TypeSafe System One) 어댑터 — 문단 1개당 요청 1개에 전 질문을 fan-out 한다.
// 설계 규칙: 판단은 Jev, 제어 흐름·임계값·집계는 코드(report.mjs)가 소유한다.
const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-1.13.0"; // 임계값이 백테스트로 튜닝되므로 버전 고정 (alias 이동 주의)

export function buildQuestions(assumptions) {
  const questions = {
    relevant: {
      type: "noul",
      instructions:
        "`paragraph`는 한국의 연금·건강보험·고용보험·소득세(퇴직소득세·원천징수 포함) 제도에서 쓰이는 수치, 요율, 금액 기준, 계산 규칙의 변경(개정·인상·인하·신설·폐지·확정 발표)을 담고 있다. 절차·서식·시스템 안내나 다른 제도의 변경은 해당하지 않는다.",
    },
    tool: {
      type: "choice",
      instructions:
        "`paragraph`의 내용이 시행될 때 영향을 받는 계산기를 고르라. 어느 것에도 영향이 없으면 none.",
      criteria: {
        "basic-pension": "기초연금 수급자격·금액 (선정기준액, 기준연금액, 소득·재산 환산)",
        "severance-tax": "퇴직소득세와 IRP 연금수령 감면",
        "dependent-check": "건강보험 피부양자 자격과 지역가입자 보험료",
        "insurance-rate": "4대보험(국민연금·건강·장기요양·고용) 요율과 기준소득월액",
        "salary-senior": "월급 원천징수(간이세액표)와 4대보험 공제",
        none: "위 어느 계산기에도 영향 없음",
      },
    },
  };
  for (const [id, desc] of Object.entries(assumptions)) {
    questions[`aff_${id}`] = {
      type: "noul",
      instructions: `\`paragraph\`의 내용이 시행되면, \`assumptions.${id}\`에 적힌 값이나 규칙이 바뀌거나 새 값이 확정된다.`,
    };
  }
  return questions;
}

/** @returns {{relevant:number, tool:{choice:string, probabilities:Record<string,number>}, affected:Record<string,number>, usage:object}} */
export async function classifyParagraph(paragraph, assumptions, { fetchImpl = fetch } = {}) {
  const key = jevApiKey();
  if (!key) throw new Error("Jev API 키 없음 (TYPESAFE_API_KEY / JEV_API_KEY)");

  const body = {
    model: MODEL,
    state: { paragraph, assumptions },
    questions: buildQuestions(assumptions),
  };

  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status === 529) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    break;
  }
  if (!res.ok) throw new Error(`Jev API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  const a = json.answers;
  const affected = {};
  for (const id of Object.keys(assumptions)) affected[id] = a[`aff_${id}`].noul;
  return {
    relevant: a.relevant.noul,
    tool: { choice: a.tool.choice, probabilities: a.tool.probabilities },
    affected,
    usage: json.usage,
  };
}
