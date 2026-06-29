// 모듈 임포트 + Firestore 연결 + 배지/등급 로직 스모크 테스트
import 'dotenv/config';

process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  './new-membership-e4a2c-firebase-adminsdk-fbsvc-6911fa7682.json';

let failures = 0;
const ok = (m) => console.log('  ✅', m);
const bad = (m, e) => {
  failures++;
  console.log('  ❌', m, '-', e?.message || e);
};

console.log('1) 모듈 임포트');
const constants = await import('../src/config/constants.js');
const badges = await import('../src/services/badges.js');
const configSvc = await import('../src/services/config.js');
const dateLib = await import('../src/lib/date.js');
const stats = await import('../src/services/stats.js');
const events = await import('../src/services/events.js');
ok('서비스 모듈 임포트 성공');

console.log('2) 날짜/주차 유틸');
try {
  const { thisWeekRange, isNextDay, formatDuration } = dateLib;
  const wr = thisWeekRange();
  if (!wr.start || !wr.end) throw new Error('주차 범위 계산 실패');
  if (!isNextDay('2026-06-28', '2026-06-29')) throw new Error('연속일 판정 오류');
  if (formatDuration(3753) !== '1시간 2분') throw new Error('시간 포맷 오류: ' + formatDuration(3753));
  ok(`thisWeek=${wr.start}~${wr.end}, formatDuration(3753)="${formatDuration(3753)}"`);
} catch (e) {
  bad('날짜 유틸', e);
}

console.log('3) 등급 계산');
try {
  const { current, next, remaining } = configSvc.computeTier(34, constants.DEFAULT_TIERS);
  if (current.id !== 'silver' || next.id !== 'gold' || remaining !== 6)
    throw new Error(`예상과 다름: ${current.id}/${next?.id}/${remaining}`);
  ok(`34회 → 현재 ${current.name}, 다음 ${next.name}까지 ${remaining}회 (예제와 일치)`);
} catch (e) {
  bad('등급 계산', e);
}

console.log('4) 배지 평가');
try {
  const totals = { totalCount: 30, maxDistance: 5.2, longestStreak: 7, totalDistance: 101 };
  const { earnedIds } = badges.evaluateBadges(totals, [], true);
  const expect = ['first', 'first5km', 'streak7', 'count30', 'dist100', 'pb'];
  for (const id of expect) if (!earnedIds.includes(id)) throw new Error('누락 배지: ' + id);
  ok(`획득 배지: ${earnedIds.join(', ')}`);
} catch (e) {
  bad('배지 평가', e);
}

console.log('5) Firestore 연결 (config/settings 읽기)');
try {
  const settings = await configSvc.getSettings();
  ok(`Firestore 연결 OK — weeklyGoal=${settings.weeklyGoal}, tiers=${settings.tiers.length}개`);
} catch (e) {
  bad('Firestore 연결', e);
}

console.log('6) 통계 쿼리 (range leaderboard, 빈 결과 허용)');
try {
  const lb = await stats.rangeLeaderboard({ start: '2026-06-01', end: '2026-06-30' });
  ok(`leaderboard 쿼리 OK — ${lb.length}건`);
  const ev = await events.listEvents();
  ok(`events 쿼리 OK — ${ev.length}건`);
} catch (e) {
  bad('통계/이벤트 쿼리', e);
}

console.log('\n' + (failures ? `❌ 실패 ${failures}건` : '🎉 모든 스모크 테스트 통과'));
process.exit(failures ? 1 : 0);
