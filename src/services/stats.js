import { db } from '../config/firebase.js';
import { COL } from '../config/constants.js';
import { thisWeekRange, toDateKey } from '../lib/date.js';

const records = () => db.collection(COL.RECORDS);
const users = () => db.collection(COL.USERS);

/** 이번 주(월~일) 사용자의 인증 횟수 */
export async function weeklyCount(userId, range = thisWeekRange()) {
  const snap = await records()
    .where('userId', '==', String(userId))
    .where('date', '>=', range.start)
    .where('date', '<=', range.end)
    .get();
  return snap.size;
}

/**
 * 부서순위 / 전체순위 (누적 인증 횟수 기준 내림차순, 동점은 누적거리).
 * @returns { overallRank, overallTotal, deptRank, deptTotal }
 */
export async function getRankings(userId) {
  const snap = await users().where('registered', '==', true).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const score = (u) => ({
    count: u.totals?.totalCount || 0,
    dist: u.totals?.totalDistance || 0,
  });
  const cmp = (a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sb.count !== sa.count) return sb.count - sa.count;
    return sb.dist - sa.dist;
  };

  const sortedAll = [...all].sort(cmp);
  const overallRank = sortedAll.findIndex((u) => u.id === String(userId)) + 1;

  const me = all.find((u) => u.id === String(userId));
  const dept = me?.department;
  const sortedDept = all.filter((u) => u.department === dept).sort(cmp);
  const deptRank = sortedDept.findIndex((u) => u.id === String(userId)) + 1;

  return {
    overallRank,
    overallTotal: sortedAll.length,
    deptRank,
    deptTotal: sortedDept.length,
  };
}

/**
 * 일자 구간 기록 집계 (웹 대시보드).
 * @param opts { start, end, gender, department, sortBy('distance'|'time'|'count') }
 * @returns 사용자별 집계 배열 (정렬됨)
 */
export async function rangeLeaderboard({ start, end, gender, department, sortBy = 'distance' } = {}) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  let q = records().where('date', '>=', s).where('date', '<=', e);
  const snap = await q.get();

  const map = new Map();
  for (const doc of snap.docs) {
    const r = doc.data();
    if (gender && r.gender !== gender) continue;
    if (department && r.department !== department) continue;
    const key = r.userId;
    if (!map.has(key)) {
      map.set(key, {
        userId: key,
        name: r.name || '',
        department: r.department || '',
        gender: r.gender || '',
        count: 0,
        distance: 0,
        durationSec: 0,
        calories: 0,
      });
    }
    const agg = map.get(key);
    agg.count += 1;
    agg.distance += Number(r.distance) || 0;
    agg.durationSec += Number(r.durationSec) || 0;
    agg.calories += Number(r.calories) || 0;
  }

  const list = [...map.values()].map((a) => ({
    ...a,
    distance: Math.round(a.distance * 100) / 100,
  }));

  const sorters = {
    distance: (a, b) => b.distance - a.distance,
    time: (a, b) => b.durationSec - a.durationSec,
    count: (a, b) => b.count - a.count,
  };
  list.sort(sorters[sortBy] || sorters.distance);
  return list;
}

/** 부서별 통계 (구간) */
export async function departmentStats({ start, end } = {}) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  const snap = await records().where('date', '>=', s).where('date', '<=', e).get();

  const map = new Map();
  for (const doc of snap.docs) {
    const r = doc.data();
    const key = r.department || '미지정';
    if (!map.has(key)) {
      map.set(key, { department: key, count: 0, distance: 0, durationSec: 0, members: new Set() });
    }
    const agg = map.get(key);
    agg.count += 1;
    agg.distance += Number(r.distance) || 0;
    agg.durationSec += Number(r.durationSec) || 0;
    agg.members.add(r.userId);
  }
  return [...map.values()]
    .map((a) => ({
      department: a.department,
      count: a.count,
      distance: Math.round(a.distance * 100) / 100,
      durationSec: a.durationSec,
      memberCount: a.members.size,
    }))
    .sort((a, b) => b.distance - a.distance);
}

/** 일별 추이 (구간 내 날짜별 합계) */
export async function dailySeries({ start, end } = {}) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  const snap = await records().where('date', '>=', s).where('date', '<=', e).get();

  const map = new Map();
  for (const doc of snap.docs) {
    const r = doc.data();
    if (!map.has(r.date)) map.set(r.date, { date: r.date, count: 0, distance: 0, durationSec: 0 });
    const agg = map.get(r.date);
    agg.count += 1;
    agg.distance += Number(r.distance) || 0;
    agg.durationSec += Number(r.durationSec) || 0;
  }
  return [...map.values()]
    .map((a) => ({ ...a, distance: Math.round(a.distance * 100) / 100 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
