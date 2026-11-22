export function todayStr(offsetDays = 0) {
  // 로컬(한국) 날짜 기준. toISOString 은 UTC 라 오전 9시 전엔 하루 전으로 나옴
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDuration(sec) {
  sec = Number(sec) || 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h}시간`);
  parts.push(`${m}분`);
  return parts.join(' ');
}

export const DEPARTMENTS = ['자문회', '장년회', '청년회', '부녀회', '중진교역'];
export const GENDERS = ['남', '여'];

// ── 종목 자동 분류 (자유 입력 → 대분류) ──
// 한 기록에 여러 운동이 적히면 해당 분류 모두 반환. 아무것도 안 맞으면 ['기타'].
const SPORT_RULES = [
  ['걷기', ['걷기', '걸음', '산책', '워킹', 'walk', '만보']],
  ['러닝', ['러닝', '런닝', '달리기', '조깅', '마라톤', 'running', 'run', '뛰기']],
  ['헬스·웨이트', ['헬스', '웨이트', 'gym', 'pt', '근력', '덤벨', '바벨', '데드', '벤치', '레그프레스', '글루트']],
  ['홈트·맨몸', ['홈트', '푸쉬업', '푸시업', '팔굽', '스쿼트', '플랭크', '크런치', '윗몸', '버피', '런지', '맨몸', '복근', '싯업']],
  ['필라테스', ['필라테스']],
  ['요가·스트레칭', ['요가', '스트레칭', '폼롤러']],
  ['수영', ['수영']],
  ['등산', ['등산', '산행', '둘레길']],
  ['자전거', ['자전거', '사이클', '싸이클', '라이딩', '스피닝']],
  ['계단·줄넘기', ['계단', '줄넘기', '스텝퍼', '천국의']],
  ['구기·라켓', ['축구', '풋살', '농구', '배구', '족구', '배드민턴', '탁구', '테니스', '볼링', '골프', '피클볼']],
  ['댄스·에어로빅', ['댄스', '줌바', '에어로빅', '춤']],
];

export function sportCategories(text = '') {
  const t = String(text).toLowerCase().replace(/\s+/g, '');
  const out = SPORT_RULES.filter(([, kws]) => kws.some((k) => t.includes(k))).map(([name]) => name);
  return out.length ? out : ['기타'];
}
