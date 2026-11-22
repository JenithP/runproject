import { db } from '../config/firebase.js';
import { COL } from '../config/constants.js';
import { thisWeekRange, toDateKey } from '../lib/date.js';

const records = () => db.collection(COL.RECORDS);
const users = () => db.collection(COL.USERS);

/** 이번 주(월~일) 사용자의 인증 횟수 (인정된 기록만). 인메모리 필터로 복합 인덱스 불필요. */
export async function weeklyCount(userId, range = thisWeekRange()) {
  const snap = await records().where('userId', '==', String(userId)).get();
  return snap.docs.filter((d) => {
    const r = d.data();
    return r.certified !== false && r.date >= range.start && r.date <= range.end;
  }).length;
}

/**
 * 부서순위 / 전체순위 (누적 인증 횟수 기준 내림차순, 동점은 누적거리).
 * @returns { overallRank, overallTotal, deptRank, deptTotal }
 */
export async function getRankings(userId) {
  // 등록 회원 + 건강인증 일괄등록으로 생긴 임시(offline) 회원 포함
  const snap = await users().get();
  const all = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.registered === true || u.offline === true);

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
    if (r.certified === false) continue; // 불인정 제외
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
        sports: {},
        days: new Set(),
      });
    }
    const agg = map.get(key);
    agg.count += 1;
    const sp = sportOf(r);
    agg.sports[sp] = (agg.sports[sp] || 0) + 1;
    agg.days.add(r.date);
  }

  const list = [...map.values()].map(({ days, ...a }) => ({
    ...a,
    dayCount: days.size,
    sports: sortSports(a.sports),
  }));

  const sorters = {
    count: (a, b) => b.count - a.count || b.dayCount - a.dayCount,
    days: (a, b) => b.dayCount - a.dayCount || b.count - a.count,
    name: (a, b) => a.name.localeCompare(b.name, 'ko'),
  };
  list.sort(sorters[sortBy] || sorters.count);
  return list;
}

/** 기록의 종목명 (건강인증은 입력 종목, 앱 인증은 달리기/걷기) */
export const sportOf = (r) =>
  r.type === 'health' ? r.sport || '기타' : r.type === 'walk' ? '걷기' : '달리기';

/** { 헬스: 3, 달리기: 1 } → [{ sport, count }] (많은 순) */
const sortSports = (obj) =>
  Object.entries(obj)
    .map(([sport, count]) => ({ sport, count }))
    .sort((a, b) => b.count - a.count);

/** 부서별 통계 (구간) */
export async function departmentStats({ start, end } = {}) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  const snap = await records().where('date', '>=', s).where('date', '<=', e).get();

  const map = new Map();
  for (const doc of snap.docs) {
    const r = doc.data();
    if (r.certified === false) continue; // 불인정 제외
    const key = r.department || '미지정';
    if (!map.has(key)) {
      map.set(key, { department: key, count: 0, sports: {}, members: new Set() });
    }
    const agg = map.get(key);
    agg.count += 1;
    const sp = sportOf(r);
    agg.sports[sp] = (agg.sports[sp] || 0) + 1;
    agg.members.add(r.userId);
  }
  return [...map.values()]
    .map((a) => ({
      department: a.department,
      count: a.count,
      sports: sortSports(a.sports),
      memberCount: a.members.size,
    }))
    .sort((a, b) => b.count - a.count);
}

/** 구간 내 원본 기록 목록 (엑셀 내보내기용, 불인정 포함) */
export async function listRecordsInRange({ start, end, department, gender } = {}) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  const [snap, userSnap] = await Promise.all([
    records().where('date', '>=', s).where('date', '<=', e).get(),
    users().get(), // 러닝 기록엔 지역-구역이 없어서 회원 소속(unit)으로 채움
  ]);
  const unitOf = new Map(userSnap.docs.map((d) => [d.id, d.data().unit || '']));
  const rows = [];
  for (const doc of snap.docs) {
    const r = doc.data();
    if (department && r.department !== department) continue;
    if (gender && r.gender !== gender) continue;
    rows.push({
      id: doc.id,
      date: r.date,
      unit: r.unit || unitOf.get(r.userId) || '',
      sport: sportOf(r),
      name: r.name || '',
      department: r.department || '',
      gender: r.gender || '',
      userId: r.userId,
      certified: r.certified === false ? '불인정' : '인정',
      edited: !!r.editedAt,
      certReason: r.certReason || '',
    });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows;
}

/** 일별 추이 (구간 내 날짜별 합계) */
export async function dailySeries({ start, end } = {}) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  const snap = await records().where('date', '>=', s).where('date', '<=', e).get();

  const map = new Map();
  for (const doc of snap.docs) {
    const r = doc.data();
    if (r.certified === false) continue; // 불인정 제외
    if (!map.has(r.date)) map.set(r.date, { date: r.date, count: 0, members: new Set() });
    const agg = map.get(r.date);
    agg.count += 1;
    agg.members.add(r.userId);
  }
  return [...map.values()]
    .map(({ members, ...a }) => ({ ...a, memberCount: members.size }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
