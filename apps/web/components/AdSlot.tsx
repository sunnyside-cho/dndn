// F-09/F-12 애드센스 자리 예약 — 승인 전엔 아무것도 렌더하지 않는다(빈 공간·화면 밀림 금지).
// 승인 후: ADSENSE_ENABLED=true + 슬롯 코드 삽입. 도구 화면 과밀 금지 (W3 절대 규칙).
const ADSENSE_ENABLED = false;

export function AdSlot({ position }: { position: string }) {
  if (!ADSENSE_ENABLED) return null;
  return <div data-ad-position={position} className="no-print" />;
}
