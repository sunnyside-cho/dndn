// shared-types (SSOT) — 공유 TypeScript 계약 (typed SSOT)
//
// 계약서. 세션(오케스트레이터)이 사용자와 합의 후 작성·수정한다 — 구현(task-agent·세션)은 준수
// 대상이며 직접 수정하지 않는다(불일치는 완료 보고에 명시). 포맷·규율: `contract-authoring` 스킬.
// 구현은 이 파일을 그대로 import 한다 (`apps/web` 에서는 `@contracts/shared-types` 별칭).
//
// 1단계(SSG·DB 없음)의 계약 표면 = ① rules 파일 구조 ② 도구별 입력/결과 ③ GA4 이벤트.

// ---------------------------------------------------------------------------
// 공통: 출처 있는 수치 (rules 파일의 원자 단위)
// ---------------------------------------------------------------------------

/** official=고시·법령 원문 확인 / check=비공식 교차확인(공개 전 재확인) / todo=미확보 */
export type Verified = "official" | "check" | "todo";

export interface SourcedValue<T = number> {
  value: T;
  verified?: Verified;
  source?: string;
  note?: string;
}

export interface RulesMeta {
  year: number;
  status: "draft" | "confirmed" | "final";
  /** 화면 SourceBadge 에 노출되는 기준일 (YYYY-MM-DD) */
  asOf: string;
  /** 제도 적용 시작일 (예: 간이세액표 2026-03-01 지급분부터) */
  appliedFrom?: string;
  note?: string;
  law?: string;
  source?: string;
  unit?: string;
  primarySources?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// rules 파일 구조 (data/rules/*.json — db-schema.md 의 데이터 계약)
// ---------------------------------------------------------------------------

/** basic-pension.{year}.json — 기초연금 (원본: 02_data/rules/{year}.draft.json) */
export interface BasicPensionRules {
  _meta: RulesMeta;
  selectionCriteria: { single: SourcedValue; couple: SourcedValue };
  basePension: {
    monthlyMax: SourcedValue;
    coupleReductionRate: SourcedValue;
    /** 소득역전방지 최저 지급 비율 (기준연금액 대비) */
    minPaymentRate: SourcedValue;
  };
  incomeEvaluation: {
    laborBasicDeduction: SourcedValue;
    laborExtraDeductionRate: SourcedValue;
    interestDeduction: SourcedValue;
    freeRentHousePriceMin: SourcedValue;
    freeRentRate: SourcedValue;
  };
  assetConversion: {
    basicDeduction: { metro: SourcedValue; city: SourcedValue; rural: SourcedValue };
    financialDeduction: SourcedValue;
    conversionRateAnnual: SourcedValue;
    /** 임차보증금 반영률 (0.95 = 5% 공제 — REVIEW_2026-09-22 C-2. 종전 50%는 스펙 오류) */
    rentDepositRate: SourcedValue;
    luxuryCarPriceMin: SourcedValue;
    membershipFullAdd: SourcedValue<boolean>;
  };
  npsLink: {
    /** 국민연금 월액 ≤ 기준연금액×이 배율 → 전액 (법 제6조 특례) */
    fullPaymentThresholdRate: SourcedValue;
    formulaNote?: string;
    range150to200?: { note?: string; verified?: Verified };
  };
  eligibility: { ageMin: number; excluded: string; verified?: Verified; source?: string };
  updateSchedule?: { note?: string; verified?: Verified };
}

/** severance.{year}.json — 퇴직소득세 (원본: {year}.severance.draft.json) */
export interface SeveranceRules {
  _meta: RulesMeta;
  serviceYearDeduction: {
    verified?: Verified;
    source?: string;
    /** maxYears=null 이 마지막 구간. formula 가 계산의 정본 — 엔진이 문자열을 파싱해 계산한다
     *  (허용 포맷: "1000000 * n" | "5000000 + 2000000 * (n - 5)"; rules 교체만으로 산식 갱신). */
    brackets: Array<{ maxYears: number | null; formula: string }>;
    yearRounding?: string;
  };
  convertedSalary: { formula: string; verified?: Verified; source?: string };
  convertedSalaryDeduction: {
    verified?: Verified;
    source?: string;
    brackets: Array<{ max: number | null; deduction: string }>;
  };
  taxBrackets: {
    verified?: Verified;
    source?: string;
    /** quick = **구간 시작점까지의 누적세액** (누진공제액 아님 — REVIEW_2026-09-22 C-1).
     *  세액 = quick + (과세표준 − 직전 구간 max) × rate. 경계 정합성은 엔진 테스트가 검증. */
    rows: Array<{ max: number | null; rate: number; quick: number }>;
    finalStep?: string;
  };
  localTaxRate: SourcedValue;
  irp: {
    deferral: { rule: string; verified?: Verified; source?: string };
    pensionDiscount: {
      verified?: Verified;
      source?: string;
      /** payRate = 이연퇴직소득세 중 부담 비율 (0.70 = 30% 감면) */
      rows: Array<{ yearsMax: number | null; payRate: number; note?: string }>;
    };
    lumpSum: { rule: string; verified?: Verified };
    startCondition: { rule: string; verified?: Verified; source?: string };
    annualLimit?: { formula: string; verified?: Verified };
  };
  verifyAgainst?: string;
}

/** dependent.{year}.json — 건보 피부양자 (원본: {year}.dependent.draft.json) */
export interface DependentRules {
  _meta: RulesMeta;
  dependentEligibility: {
    incomeMax: SourcedValue & { unit?: string };
    businessIncome: {
      registered: string;
      unregistered: string;
      rentalIncome: string;
      /** 미등록자 사업소득 허용 상한 (연, 원 — REVIEW M-1 구조화) */
      unregisteredMax: SourcedValue;
      verified?: Verified;
      source?: string;
    };
    pensionCounting?: string;
    coupleRule?: string;
    assetMax: {
      tier1: { value: number; rule: string };
      tier2: { value: number; rule: string };
      /** tier1~tier2 구간에서 허용되는 연소득 상한 (원 — REVIEW M-1 구조화) */
      tier2IncomeMax: SourcedValue;
      sibling?: { value: number; rule: string };
      verified?: Verified;
      source?: string;
    };
  };
  regionalPremium: {
    healthRate: SourcedValue;
    incomeReflection: {
      full: string;
      half: string;
      /** 근로·연금 반영률 (0.5) / 그 외 반영률 (1.0) — REVIEW M-1 구조화 */
      halfRate: SourcedValue;
      fullRate: SourcedValue;
      verified?: Verified;
      source?: string;
    };
    assetBasicDeduction: SourcedValue;
    assetPointPrice: SourcedValue;
    /** 60등급 재산점수표 — [상한(원, null=무한), 점수] 오름차순. 미수록 시 보험료 추정 생략 */
    assetPointTable?: {
      verified?: Verified;
      source?: string;
      rows: Array<{ max: number | null; points: number }>;
    } | string;
    carLevy?: SourcedValue;
    longTermCareRate: SourcedValue & { formula?: string };
    monthlyMin: SourcedValue;
    monthlyMax: SourcedValue;
    jeonseDeposit?: { note?: string; verified?: Verified };
  };
  verifyAgainst?: string;
}

/** insurance.{year}.json — 4대보험 요율 (원본: {year}.insurance.draft.json) */
export interface InsuranceRules {
  _meta: RulesMeta;
  nationalPension: {
    rateTotal: SourcedValue;
    rateEmployee: SourcedValue | { value: number };
    baseMonthly: {
      until_2026_06?: { min: number; max: number };
      from_2026_07?: { min: number; max: number };
      verified?: Verified;
      source?: string;
    };
    age60Exempt: SourcedValue<boolean>;
    next2027?: SourcedValue;
  };
  healthInsurance: {
    rateEmployee: SourcedValue;
    longTermCare: { formula: string; verified?: Verified };
    next2027?: SourcedValue;
  };
  employmentInsurance: {
    rateEmployee: SourcedValue;
    pending2027?: { note?: string; verified?: Verified };
  };
  industrialAccident?: { rateEmployee: number; verified?: Verified };
  incomeTax?: {
    method: string;
    tableSource?: string;
    tableVersion?: { note?: string; verified?: Verified };
    /** 지방소득세율 (소득세 대비 — REVIEW M-1 구조화) */
    localTaxRate: SourcedValue;
  };
  verifyAgainst?: string;
}

// ---------------------------------------------------------------------------
// 도구 공통
// ---------------------------------------------------------------------------

export type ToolId =
  | "basic-pension"
  | "severance-tax"
  | "dependent-check"
  | "insurance-rate"
  | "salary-senior";

// ---------------------------------------------------------------------------
// F-01 기초연금 모의계산
// ---------------------------------------------------------------------------

export type HouseholdType = "single" | "couple";
export type RegionType = "metro" | "city" | "rural";

export interface BasicPensionInput {
  birthYear: number;
  /** 공무원·군인·사학 등 직역연금 수급(본인 또는 배우자) */
  hasOccupationalPension: boolean;
  household: HouseholdType;
  region: RegionType;
  /** 월 근로소득 (본인/배우자, 원) */
  laborIncomeSelf: number;
  laborIncomeSpouse: number;
  /** 국민연금 월액 (연계감액 판단에도 사용) */
  npsSelf: number;
  npsSpouse: number;
  /** 사업·임대 등 기타소득 (월, 원) */
  otherIncomeMonthly: number;
  /** 이자소득 (월, 원) */
  interestIncomeMonthly: number;
  /** 일반재산: 집·땅 시가표준액 (원) */
  generalAssets: number;
  /** 전월세보증금 (원) — 50% 반영은 엔진이 수행 */
  rentDeposit: number;
  financialAssets: number;
  debts: number;
  /** 4천만원 이상 차량·회원권 가액 (없으면 0) */
  luxuryCarValue: number;
  membershipValue: number;
  /** 자녀 명의 6억+ 주택 무료 거주 → 무료임차소득 가산 대상 주택가액 (없으면 0) */
  freeRentHousePrice: number;
}

export type BasicPensionVerdict =
  | "eligible"          // 수급 가능성 높음
  | "notEligible"       // 선정기준액 초과
  | "ageNotYet"         // 65세 미만
  | "occupationalExcluded"; // 직역연금 제외

export interface BasicPensionResult {
  verdict: BasicPensionVerdict;
  /** 소득평가액 (월, 원) */
  incomeEvaluated: number;
  /** 재산의 소득환산액 (월, 원) */
  assetConverted: number;
  /** 소득인정액 = incomeEvaluated + assetConverted */
  recognizedIncome: number;
  /** 해당 가구 선정기준액 */
  criterion: number;
  /** 예상 월 지급액 (가구 합계, 원) — 미수급/제외 시 null */
  estimatedMonthly: number | null;
  /** 국민연금 연계: full=전액(특례 이내) / mayReduce=감액 가능성(단정 금지 표시) */
  npsLink: "full" | "mayReduce";
  /** 소득역전방지 감액 적용 여부 */
  incomeReversalApplied: boolean;
  breakdown: {
    laborEvaluated: number;
    otherIncome: number;
    freeRentIncome: number;
    generalAssetNet: number;
    financialAssetNet: number;
    luxuryAdded: number;
  };
}

// ---------------------------------------------------------------------------
// F-02 퇴직금 세금·IRP 절세
// ---------------------------------------------------------------------------

export interface SeveranceInput {
  /** 세전 퇴직금 (원) */
  severancePay: number;
  /** ISO 날짜 (YYYY-MM-DD) — 근속연수는 엔진이 계산(1년 미만 올림) */
  joinDate: string;
  leaveDate: string;
}

export interface IrpOption {
  /** 표시 라벨 구간: "10년 이하" | "10~20년" | "20년 초과" */
  label: string;
  /** 이연퇴직소득세 부담 비율 (0.7/0.6/0.5) */
  payRate: number;
  totalTax: number;
  net: number;
  /** 일시금 대비 절세액 */
  saving: number;
}

export interface SeveranceResult {
  serviceYears: number;
  serviceYearDeduction: number;
  convertedSalary: number;
  convertedSalaryDeduction: number;
  taxBase: number;
  /** 환산산출세액 (연) */
  convertedTax: number;
  /** 퇴직소득세 (소득세분) */
  incomeTax: number;
  /** 지방소득세 (10%) */
  localTax: number;
  totalTaxLump: number;
  netLump: number;
  irpOptions: IrpOption[];
}

// ---------------------------------------------------------------------------
// F-03 건보 피부양자 자격 체크
// ---------------------------------------------------------------------------

export interface DependentInput {
  hasBusinessRegistration: boolean;
  /** 사업자등록 있을 때: 사업소득 발생 여부 / 없을 때: 연 500만 초과 여부 판단용 사업소득액(연) */
  businessIncomeAnnual: number;
  hasRentalIncome: boolean;
  /** 연간 소득 합계 (공적연금 100% 반영, 원) */
  annualIncome: number;
  /** 재산세 과세표준 (원) */
  propertyTaxBase: number;
  /** 배우자가 소득요건(연 2,000만 이하 등) 충족하는지 — null=배우자 없음 */
  spouseMeetsIncome: boolean | null;
}

export type DependentVerdict = "keep" | "lose";

export interface DependentResult {
  verdict: DependentVerdict;
  /** 판정 근거 (탈락 사유 또는 통과 요건) — 화면 그대로 노출 */
  reasons: string[];
  /** 탈락 시 예상 지역보험료 (간이) — 유지 시 null */
  estimatedPremium: RegionalPremiumEstimate | null;
}

export interface RegionalPremiumInput {
  /** 근로+연금 소득 (연, 원) — 50% 반영 */
  annualWorkPensionIncome: number;
  /** 이자·배당·사업·기타 소득 (연, 원) — 100% 반영 */
  annualOtherIncome: number;
  /** 재산세 과세표준 (원) */
  propertyTaxBase: number;
}

export interface RegionalPremiumEstimate {
  monthlyHealth: number;
  monthlyLongTermCare: number;
  monthlyTotal: number;
  /** 60등급표 미수록 등으로 추정 불가하면 그 사유 */
  note: string;
}

// ---------------------------------------------------------------------------
// F-04 4대보험 인상분
// ---------------------------------------------------------------------------

export interface InsuranceRateInput {
  monthlySalary: number;
  /** 60세 이상 → 국민연금 공제 0 */
  age60Plus: boolean;
}

/** 내년 확정분 요율 — rules 파일의 next* 필드에서 파생 (미발표 항목은 null, 추측 금지) */
export interface NextYearRates {
  year: number;
  nationalPensionEmployee: number | null;
  healthEmployee: number | null;
  longTermCareFormula: string | null;
  employmentEmployee: number | null;
}

export type InsuranceItem = "nationalPension" | "health" | "longTermCare" | "employment";

export interface InsuranceRateRow {
  item: InsuranceItem;
  currentMonthly: number;
  /** 내년 요율 미발표 항목은 null (화면: "12월 발표 예정") */
  nextMonthly: number | null;
  diffMonthly: number | null;
  note?: string;
}

export interface InsuranceRateResult {
  rows: InsuranceRateRow[];
  totalCurrent: number;
  /** 미발표 항목은 올해 값으로 대체해 합산하되 partial=true */
  totalNext: number;
  totalDiffMonthly: number;
  totalDiffAnnual: number;
  partial: boolean;
}

// ---------------------------------------------------------------------------
// F-07 재취업 연봉 실수령 (60세 분기 핵심)
// ---------------------------------------------------------------------------

export interface SalarySeniorInput {
  age: number;
  monthlySalary: number;
  /** 본인 포함 공제대상 가족 수 (간이세액표 기준) */
  dependents: number;
}

/** 근로소득 간이세액표 (국세청 원본 → JSON 변환, data/rules/tax-table.{version}.json) */
export interface SimplifiedTaxTable {
  _meta: RulesMeta;
  /** 월급여(천원 단위 아님, 원) 구간 [min, max) — max=null 은 최상단(산식 구간).
   *  byDependents[i] = 공제대상 가족 수 (i+1)명일 때 월 소득세(원). */
  rows: Array<{ min: number; max: number | null; byDependents: number[] }>;
  /** 최고 구간(표 밖) 처리 규칙 설명 */
  overflowRule?: string;
}

export interface SalarySeniorResult {
  gross: number;
  nationalPension: number;
  health: number;
  longTermCare: number;
  employment: number;
  incomeTax: number;
  localTax: number;
  totalDeduction: number;
  net: number;
  /** 60세 이상 국민연금 미공제 등 안내 문구 */
  notes: string[];
}

// ---------------------------------------------------------------------------
// GA4 이벤트 (F-15 — BUILD_BRIEF 명세와 1:1)
// ---------------------------------------------------------------------------

export type ShareChannel = "kakao" | "image" | "link";

export type GaEvent =
  | { name: "calc_complete"; params: { tool: ToolId } }
  | { name: "share_click"; params: { tool: ToolId; channel: ShareChannel } }
  | { name: "affiliate_click"; params: { tool: ToolId; campaign: string } }
  | { name: "faq_open"; params: { tool: ToolId; question: string } }
  | { name: "print_click"; params: { tool: ToolId } };

// ---------------------------------------------------------------------------
// 콘텐츠 (guide/[slug])
// ---------------------------------------------------------------------------

export interface GuideFrontmatter {
  /** 제목에는 연도 포함 가능 — slug 에는 연도 금지 (BUILD_BRIEF URL 설계) */
  title: string;
  slug: string;
  description: string;
  /** 발행일 YYYY-MM-DD */
  date: string;
  updated?: string;
  /** CONTENT_PLAN 세트 (A=기초연금 B=퇴직금 C=피부양자 D=시즌) */
  set: "A" | "B" | "C" | "D";
  /** 연동 도구 (상단 도구 링크 배치) */
  toolId?: ToolId;
  sources?: Array<{ label: string; url: string }>;
  /** true 면 빌드에서 제외 (무검수 자동 발행 금지 — W2) */
  draft?: boolean;
}
