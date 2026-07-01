import { getUser } from '../services/users.js';
import { weeklyCount, getRankings } from '../services/stats.js';
import { getSettings, computeTier } from '../services/config.js';
import { badgesByIds } from '../services/badges.js';
import { now, formatDuration, formatPace } from '../lib/date.js';
import { WALK_DEPARTMENT } from '../config/constants.js';
import { mainMenu } from './keyboards.js';

/** /내기록 — 통계 카드 */
export async function showMyRecord(ctx) {
  const user = await getUser(ctx.from.id);
  if (!user?.registered) {
    await ctx.reply('먼저 /start 로 등록을 완료해주세요.');
    return;
  }

  const t = user.totals || {};
  const [week, ranks, settings] = await Promise.all([
    weeklyCount(ctx.from.id),
    getRankings(ctx.from.id),
    getSettings(),
  ]);
  const tier = computeTier(t.totalCount || 0, settings.tiers);

  const today = now().format('YYYY-MM-DD');
  const ranToday = t.lastRunDate === today;

  const lines = [];
  lines.push(`${user.name} 님`);
  lines.push('');
  if (ranToday) lines.push('오늘 인증 완료 ✅');
  else lines.push('오늘 아직 인증 전이에요 🏃');
  lines.push('');
  lines.push('누적 인증');
  lines.push(`${t.totalCount || 0}회`);
  lines.push('');
  lines.push('누적 거리');
  lines.push(`${t.totalDistance || 0}km`);
  lines.push('');
  lines.push('누적 시간');
  lines.push(`${formatDuration(t.totalTime || 0)}`);
  lines.push('');
  lines.push('평균 페이스');
  lines.push(`${formatPace((t.totalDistance || 0) > 0 ? (t.totalTime || 0) / t.totalDistance : 0)}`);
  lines.push('');
  lines.push('누적 칼로리');
  lines.push(`${Math.round(t.totalCalories || 0)}kcal`);
  lines.push('');
  if (user.department === WALK_DEPARTMENT && (t.totalSteps || 0) > 0) {
    lines.push('누적 걸음');
    lines.push(`${Math.round(t.totalSteps).toLocaleString()}보`);
    lines.push('');
  }
  lines.push('이번주');
  lines.push(`${week}회 / 목표 ${settings.weeklyGoal}회`);
  lines.push('');
  lines.push('남은 목표');
  if (tier.next) {
    lines.push(`${tier.next.emoji} ${tier.next.name}까지`);
    lines.push(`${tier.remaining}회`);
  } else {
    lines.push(`${tier.current.emoji} ${tier.current.name} 최고 등급 달성! 🎉`);
  }
  lines.push('');
  lines.push('부서순위');
  lines.push(`${ranks.deptRank}위 / ${ranks.deptTotal}명`);
  lines.push('');
  lines.push('전체순위');
  lines.push(`${ranks.overallRank}위 / ${ranks.overallTotal}명`);

  const myBadges = badgesByIds(t.badges || []);
  if (myBadges.length) {
    lines.push('');
    lines.push('🏅 배지');
    lines.push('—————————————————');
    lines.push(myBadges.map((b) => `${b.emoji} ${b.name}`).join('   '));
  }

  await ctx.reply(lines.join('\n'), mainMenu());
}

/** ℹ️ 내 정보 */
export async function showMyInfo(ctx) {
  const user = await getUser(ctx.from.id);
  if (!user?.registered) {
    await ctx.reply('먼저 /start 로 등록을 완료해주세요.');
    return;
  }
  await ctx.reply(
    'ℹ️ 내 정보\n—————————————————\n' +
      `· 이름: ${user.name}\n· 부서: ${user.department}\n· 소속: ${user.unit}\n· 성별: ${user.gender}`,
    mainMenu()
  );
}
