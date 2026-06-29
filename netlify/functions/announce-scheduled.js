// Netlify Scheduled Function: 매주 월요일 자동 공지.
// cron 은 UTC 기준 → 월요일 00:00 UTC = 월요일 09:00 KST.
import { schedule } from '@netlify/functions';
import { createBot } from '../../src/bot/index.js';
import { broadcastTopEvent } from '../../src/bot/announce.js';

const bot = createBot();

export const handler = schedule('0 0 * * 1', async () => {
  try {
    const result = await broadcastTopEvent(bot);
    console.log('[scheduled] 공지 발송:', JSON.stringify(result));
    return { statusCode: 200 };
  } catch (err) {
    console.error('[scheduled] 오류:', err);
    return { statusCode: 500 };
  }
});
