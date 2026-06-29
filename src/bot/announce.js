import cron from 'node-cron';
import { getRegisteredUsers } from '../services/users.js';
import { getTopEvent } from '../services/events.js';
import { TZ } from '../lib/date.js';

/**
 * 최상단 활성 이벤트를 전체 등록 사용자에게 발송.
 * @returns { sent, failed, event }
 */
export async function broadcastTopEvent(bot) {
  const event = await getTopEvent();
  if (!event) {
    console.log('[announce] 활성 이벤트가 없어 공지를 건너뜁니다.');
    return { sent: 0, failed: 0, event: null };
  }
  const users = await getRegisteredUsers();
  const text =
    '📢 이번주 이벤트가 있어요!\n—————————————————\n' +
    `🎯 ${event.title}\n\n${event.content}`;

  let sent = 0;
  let failed = 0;
  for (const u of users) {
    try {
      await bot.telegram.sendMessage(u.telegramId, text);
      sent += 1;
      await new Promise((r) => setTimeout(r, 50)); // 텔레그램 rate limit 완화
    } catch (err) {
      failed += 1;
      console.warn(`[announce] ${u.telegramId} 발송 실패:`, err.message);
    }
  }
  console.log(`[announce] 발송 완료 sent=${sent} failed=${failed}`);
  return { sent, failed, event };
}

/** 매주 월요일 09:00 (KST) 자동 공지 스케줄 등록 */
export function setupScheduler(bot) {
  // 분 시 일 월 요일 → 월요일(1) 09:00
  cron.schedule(
    '0 9 * * 1',
    () => {
      broadcastTopEvent(bot).catch((e) => console.error('[announce] 스케줄 오류:', e));
    },
    { timezone: TZ }
  );
  console.log(`[announce] 월요일 09:00 (${TZ}) 자동 공지 스케줄 등록됨`);
}
