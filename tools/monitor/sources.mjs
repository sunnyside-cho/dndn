// 모니터링 소스 (W1: 복지로·국민연금공단·국세청·건보공단 계열).
// v1 은 서버렌더 HTML 로 안정적으로 텍스트가 잡히는 페이지부터 시작한다 — 목록은 운영하며 넓힌다.
// JS 렌더 페이지(law.go.kr 상세 등)는 여기 넣어도 fail-closed(수집 실패가 리포트에 노출)라 안전.
export const SOURCES = [
  {
    id: "nhis-levy-system",
    name: "건보공단 지역가입자 부과체계 (요율·60등급표·공제)",
    url: "https://www.nhis.or.kr/nhis/policy/wbhada07910p01.do",
  },
  {
    id: "nhis-levy-method",
    name: "건보공단 보험료 산정방법 (건강·장기요양 요율)",
    url: "https://www.nhis.or.kr/static/html/wbma/b/wbmab0102.html",
  },
  {
    id: "nts-tax-table",
    name: "국세청 근로소득 간이세액표 안내",
    url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6583&cntntsId=7862",
  },
  {
    id: "nts-severance",
    name: "국세청 퇴직소득 안내 (세액계산 방법)",
    url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6444&cntntsId=7880",
  },
  {
    // 기초연금 선정기준액·기준연금액 고시가 게시되는 목록 (복지로 상세는 SPA 라 v1 제외)
    id: "mohw-notices",
    name: "보건복지부 훈령·예규·고시 목록",
    url: "https://www.mohw.go.kr/board.es?mid=a10409020000&bid=0026",
  },
];
