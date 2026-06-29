import { BADGES } from '../config/constants.js';

/**
 * 현재 totals(+이번 기록의 PB 여부)로 충족하는 배지 목록 평가.
 * @returns { earnedIds: string[], newlyEarned: Badge[] }
 */
export function evaluateBadges(totals, prevBadgeIds = [], isPB = false) {
  const ctx = { totals, isPB };
  const earnedIds = [];
  const newlyEarned = [];
  for (const badge of BADGES) {
    if (badge.check(ctx)) {
      earnedIds.push(badge.id);
      if (!prevBadgeIds.includes(badge.id)) newlyEarned.push(badge);
    }
  }
  return { earnedIds, newlyEarned };
}

/** id 목록 → 배지 메타 목록 */
export function badgesByIds(ids = []) {
  return BADGES.filter((b) => ids.includes(b.id));
}

export { BADGES };
