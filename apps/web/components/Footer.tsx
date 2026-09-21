import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--surface-subtle)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-10">
        <p className="t-body m-0">
          든든노후는 공공기관이 아닌 <strong>민간 정보 서비스</strong>입니다. 모든 계산과 해설은
          참고용이며 법적 효력이 없습니다. 실제 수급·부과는 해당 기관의 심사·고지에 따릅니다.
        </p>
        <p className="t-caption mt-4 mb-0">
          공식 자료(법령·고시)를 정리해 제공하며, 각 페이지 하단에 기준일과 출처를 표기합니다.{" "}
          <Link href="/about/" className="text-[var(--text-tertiary)] underline">
            운영자·계산 근거 안내
          </Link>
        </p>
      </div>
    </footer>
  );
}
