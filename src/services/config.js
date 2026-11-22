import { db } from '../config/firebase.js';
import { COL, DEFAULT_TIERS, DEFAULT_WEEKLY_GOAL } from '../config/constants.js';

const doc = () => db.collection(COL.CONFIG).doc('settings');

/** 등급/주간목표 등 설정 조회 (없으면 기본값) */
export async function getSettings() {
  const snap = await doc().get();
  const data = snap.exists ? snap.data() : {};
  return {
    tiers: Array.isArray(data.tiers) && data.tiers.length ? data.tiers : DEFAULT_TIERS,
    weeklyGoal: data.weeklyGoal ?? DEFAULT_WEEKLY_GOAL,
  };
}

/** 설정 저장 (관리자 웹) */
export async function saveSettings(patch) {
  await doc().set(patch, { merge: true });
  return getSettings();
}

/** 누적 인증 횟수로 현재 등급과 다음 등급까지 남은 횟수 계산 */
export function computeTier(totalCount, tiers) {
  const sorted = [...tiers].sort((a, b) => a.minCount - b.minCount);
  let current = sorted[0];
  let next = null;
  for (let i = 0; i < sorted.length; i++) {
    if (totalCount >= sorted[i].minCount) {
      current = sorted[i];
      next = sorted[i + 1] || null;
    }
  }
  const remaining = next ? Math.max(0, next.minCount - totalCount) : 0;
  return { current, next, remaining };
}

// ── 부서별 출결재적 (월별) ─────────────────────────────
// config/roster 문서: { months: { 'YYYY-MM': { 청년회: 120, ... } } }
const rosterDoc = () => db.collection(COL.CONFIG).doc('roster');

/** 월별 재적 전체 조회 */
export async function getRoster() {
  const snap = await rosterDoc().get();
  return { months: (snap.exists && snap.data().months) || {} };
}

/** 한 달 재적 저장. counts: { 부서: 숫자 } (빈 값/0 은 삭제) */
export async function saveRosterMonth(month, counts = {}) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw new Error('월 형식이 올바르지 않습니다 (YYYY-MM).');
  const clean = {};
  for (const [dept, v] of Object.entries(counts)) {
    const n = Math.round(Number(v));
    if (n > 0) clean[dept] = n;
  }
  const cur = await getRoster();
  cur.months[month] = clean;
  await rosterDoc().set({ months: cur.months });
  return cur;
}
