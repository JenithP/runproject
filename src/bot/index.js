import { Telegraf } from 'telegraf';
import { db, FieldValue } from '../config/firebase.js';
import { getUser, setState } from '../services/users.js';
import { mainMenu, BTN } from './keyboards.js';
import {
  startRegistration,
  handleRegistrationText,
  setupRegistrationActions,
} from './registration.js';
import { startRunning, handlePhoto } from './running.js';
import { showMyRecord, showMyInfo } from './myrecord.js';

export function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 이 설정되지 않았습니다.');
  const bot = new Telegraf(token);

  // ── 중복 업데이트 방지 (서버리스 webhook 재전송 대비) ──
  // 텔레그램이 같은 update 를 재전송해도 update_id 로 1회만 처리.
  bot.use(async (ctx, next) => {
    const id = ctx.update?.update_id;
    if (id == null) return next();
    try {
      await db.collection('processed_updates').doc(String(id)).create({
        at: FieldValue.serverTimestamp(),
      });
    } catch {
      return; // 이미 처리된 update → 무시
    }
    return next();
  });

  // /start
  bot.start(async (ctx) => {
    const user = await getUser(ctx.from.id);
    if (user?.registered) {
      await ctx.reply(`${user.name} 님, 다시 오셨네요! 🏃`, mainMenu());
    } else {
      await startRegistration(ctx);
    }
  });

  // 메뉴 버튼
  bot.hears(BTN.RECORD, startRunning);
  bot.hears(BTN.MY_RECORD, showMyRecord);
  bot.hears(BTN.INFO, showMyInfo);
  bot.command('내기록', showMyRecord);
  bot.command('record', startRunning);

  // 인라인 콜백 (부서/성별)
  setupRegistrationActions(bot);

  // 취소
  bot.action('cancel', async (ctx) => {
    await ctx.answerCbQuery('취소되었습니다');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    const user = await getUser(ctx.from.id);
    if (user?.registered) await setState(ctx.from.id, { step: 'done' });
    await ctx.reply('취소되었습니다.', mainMenu());
  });

  // 사진
  bot.on('photo', handlePhoto);

  // 텍스트 라우터 (메뉴 버튼은 위 hears에서 먼저 처리됨)
  bot.on('text', async (ctx) => {
    const user = await getUser(ctx.from.id);
    if (!user) {
      await startRegistration(ctx);
      return;
    }
    if (!user.registered) {
      const handled = await handleRegistrationText(ctx, user);
      if (!handled) await ctx.reply('등록을 완료해주세요. /start 를 입력하세요.');
      return;
    }
    if (user.state?.step === 'awaiting_photo') {
      await ctx.reply('📸 러닝 앱 스크린샷 사진을 보내주세요.');
      return;
    }
    await ctx.reply('아래 메뉴를 이용해주세요 🙂', mainMenu());
  });

  bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx?.updateType}:`, err);
  });

  return bot;
}
