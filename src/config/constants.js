// ── 부서 (회원가입 선택지) ─────────────────────────────
export const DEPARTMENTS = [
  '자문회',
  '장년회',
  '여청년',
  '남청년',
  '부녀회',
  '중진교역',
];

// ── 성별 ───────────────────────────────────────────────
export const GENDERS = ['남', '여'];

// ── 배지 정의 ──────────────────────────────────────────
// check(ctx) : { totals, record, isPB, streak } 를 받아 boolean 반환
export const BADGES = [
  { id: 'first',        emoji: '🏅', name: '첫 인증',     check: (c) => c.totals.totalCount >= 1 },
  { id: 'first5km',     emoji: '🏅', name: '첫 5km',      check: (c) => c.totals.maxDistance >= 5 },
  { id: 'streak7',      emoji: '🏅', name: '7일 연속',    check: (c) => c.totals.longestStreak >= 7 },
  { id: 'count30',      emoji: '🏅', name: '30회 인증',   check: (c) => c.totals.totalCount >= 30 },
  { id: 'dist100',      emoji: '🏅', name: '100km 달성',  check: (c) => c.totals.totalDistance >= 100 },
  { id: 'pb',           emoji: '🏅', name: 'PB 갱신',     check: (c) => c.isPB === true },
  { id: 'finisher',     emoji: '🏅', name: '완주자',      check: (c) => c.totals.maxDistance >= 42.195 },
];

// ── 등급/목표 기본값 (웹 관리자에서 config/tiers 로 덮어씀) ──
// metric: 'count'(누적 인증 횟수) 기준. minCount 이상이면 해당 등급.
export const DEFAULT_TIERS = [
  { id: 'bronze',   name: '브론즈',   emoji: '🥉', minCount: 0 },
  { id: 'silver',   name: '실버',     emoji: '🥈', minCount: 20 },
  { id: 'gold',     name: '골드',     emoji: '🥇', minCount: 40 },
  { id: 'platinum', name: '플래티넘', emoji: '💎', minCount: 60 },
];

// 주간 목표 인증 횟수 기본값 (config/settings.weeklyGoal 로 덮어씀)
export const DEFAULT_WEEKLY_GOAL = 3;

// ── Firestore 컬렉션 이름 ──────────────────────────────
export const COL = {
  USERS: 'users',
  RECORDS: 'records',
  EVENTS: 'events',
  ANNOUNCEMENTS: 'announcements',
  CONFIG: 'config',
};
