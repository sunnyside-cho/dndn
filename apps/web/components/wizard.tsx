"use client";
import type { InputHTMLAttributes, ReactNode } from "react";

// 문답형 위저드 공통 프리미티브 (design-guide: 한 화면에 한 질문, 큰 컨트롤, 항상 뒤로)
// basic-pension · severance-tax · dependent-check 등 3개+ feature 가 공유한다.

export function StepShell({
  step,
  total,
  title,
  help,
  onBack,
  onNext,
  nextLabel = "다음",
  children,
}: {
  step: number;
  total: number;
  title: string;
  help?: string;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="no-print">
      <p className="t-label mb-2">
        {step + 1} / {total}
      </p>
      <h2 className="t-h2 mt-0">{title}</h2>
      {help ? <p className="t-body-l mt-2 mb-6">{help}</p> : null}
      <div className="mt-6">{children}</div>
      <div className="mt-8 flex gap-3">
        {onBack ? (
          <button type="button" className="btn btn-ghost min-w-28" onClick={onBack}>
            뒤로
          </button>
        ) : null}
        {onNext ? (
          <button type="button" className="btn btn-primary btn-cta flex-1" onClick={onNext}>
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; desc?: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-selected={value === o.value}
          className="choice"
          onClick={() => onChange(o.value)}
        >
          <span>
            {o.label}
            {o.desc ? <span className="t-body block font-normal">{o.desc}</span> : null}
          </span>
          {value === o.value ? <span aria-hidden>✓</span> : null}
        </button>
      ))}
    </div>
  );
}

export function MoneyField({
  label,
  help,
  error,
  unit = "만원",
  onNone,
  inputProps,
}: {
  label: string;
  help?: string;
  error?: string;
  unit?: string;
  /** "없음" 버튼 — 값을 0 으로 */
  onNone?: () => void;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}) {
  const id = `money-${String(inputProps.name)}`;
  return (
    <div className="mb-6">
      <label htmlFor={id} className="t-h4 block">
        {label}
      </label>
      {help ? <p className="t-body mt-1 mb-2">{help}</p> : null}
      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="input flex-1 text-right"
          {...inputProps}
        />
        <span className="t-h4 shrink-0">{unit}</span>
        {onNone ? (
          <button type="button" className="btn btn-ghost shrink-0" onClick={onNone}>
            없음
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="t-body mt-2 mb-0 font-semibold text-[var(--text-primary)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
