"use client";
import type { GaEvent } from "@contracts/shared-types";

// GA4 이벤트 유일 진입점 (contracts/api-spec.md — gtag 직접 호출 금지).
// 입력값(소득·재산)은 절대 파라미터에 싣지 않는다 (F-10).
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: GaEvent): void {
  if (typeof window === "undefined" || !window.gtag) return; // GA 미설정 → no-op
  window.gtag("event", event.name, event.params);
}
