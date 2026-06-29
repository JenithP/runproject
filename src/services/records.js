import { db, FieldValue } from '../config/firebase.js';
import { COL } from '../config/constants.js';
import { isNextDay } from '../lib/date.js';
import { evaluateBadges } from './badges.js';
import { getUser } from './users.js';

const records = () => db.collection(COL.RECORDS);
const users = () => db.collection(COL.USERS);

/** 사용자의 모든 기록 (날짜 오름차순) */
export async function getUserRecords(userId) {
  const snap = await records().where('userId', '==', String(userId)).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** 기록 리스트로부터 누적 통계 전체 재계산 */
function recomputeTotals(list, prevBadges = []) {
  const totals = {
    totalCount: list.length,
    totalDistance: 0,
    totalTime: 0,
    totalCalories: 0,
    maxDistance: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastRunDate: null,
    badges: prevBadges,
  };

  for (const r of list) {
    totals.totalDistance += Number(r.distance) || 0;
    totals.totalTime += Number(r.durationSec) || 0;
    totals.totalCalories += Number(r.calories) || 0;
    if ((Number(r.distance) || 0) > totals.maxDistance) totals.maxDistance = Number(r.distance) || 0;
  }
  totals.totalDistance = Math.round(totals.totalDistance * 100) / 100;

  // 연속일수: 고유 날짜 오름차순으로 연속 구간 계산
  const uniqueDays = [...new Set(list.map((r) => r.date))].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < uniqueDays.length; i++) {
    if (i === 0 || isNextDay(uniqueDays[i - 1], uniqueDays[i])) run += 1;
    else run = 1;
    if (run > longest) longest = run;
  }
  // 현재 연속: 마지막 날짜에서 거꾸로
  let current = 0;
  for (let i = uniqueDays.length - 1; i >= 0; i--) {
    if (i === uniqueDays.length - 1) current = 1;
    else if (isNextDay(uniqueDays[i], uniqueDays[i + 1])) current += 1;
    else break;
  }
  totals.longestStreak = longest;
  totals.currentStreak = current;
  totals.lastRunDate = uniqueDays.length ? uniqueDays[uniqueDays.length - 1] : null;

  return totals;
}

/**
 * 러닝 기록 추가 + 사용자 누적 통계/배지 갱신.
 * @param data { distance, durationSec, calories, date, pace, photoFileId, raw }
 * @returns { record, totals, newlyEarned, isPB }
 */
export async function addRecord(userId, data) {
  const user = await getUser(userId);
  if (!user) throw new Error('사용자를 찾을 수 없습니다.');

  const prevMax = user.totals?.maxDistance || 0;
  const distance = Number(data.distance) || 0;
  const isPB = distance > prevMax && distance > 0;

  const recordDoc = {
    userId: String(userId),
    name: user.name || user.telegramName || '',
    department: user.department || null,
    gender: user.gender || null,
    date: data.date, // YYYY-MM-DD
    distance,
    durationSec: Number(data.durationSec) || 0,
    calories: Number(data.calories) || 0,
    pace: data.pace || null,
    photoFileId: data.photoFileId || null,
    raw: data.raw || null,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await records().add(recordDoc);

  // 전체 재계산
  const list = await getUserRecords(userId);
  const prevBadges = user.totals?.badges || [];
  const totals = recomputeTotals(list, prevBadges);
  const { earnedIds, newlyEarned } = evaluateBadges(totals, prevBadges, isPB);
  totals.badges = earnedIds;

  await users().doc(String(userId)).set({ totals }, { merge: true });

  return { record: { id: ref.id, ...recordDoc }, totals, newlyEarned, isPB };
}
