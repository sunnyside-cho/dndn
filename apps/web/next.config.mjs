/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1단계: 정적 내보내기(SSG) — BUILD_BRIEF. 모든 계산은 클라이언트, 서버 기능 없음.
  output: "export",
  // URL 설계가 /basic-pension/ 형태(디렉터리 + 슬래시)라 정적 호스팅과 1:1 대응시킨다.
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
