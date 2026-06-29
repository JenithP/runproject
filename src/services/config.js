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
