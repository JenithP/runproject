import { getUser, setState } from '../services/users.js';
import { addRecord } from '../services/records.js';
import { extractRunningData } from '../ocr/vision.js';
import { toDateKey, formatDuration } from '../lib/date.js';
import { mainMenu, cancelInline, calendarInline, BTN } from './keyboards.js';
import { WALK_DEPARTMENT, CERT, evaluateCertification } from '../config/constants.js';

const CERT_REASON_TEXT = {
  time: `· 운동시간이 ${CERT.minMinutes}분을 넘어야 인정돼요`,
  distance: `· 달리기 거리가 ${CERT.minDistanceKm}km를 넘어야 인정돼요`,
  steps: `· 걸음이 ${CERT.minSteps.toLocaleString()}보를 넘어야 인정돼요`,
};

/** "러닝 기록하기" — 먼저 캘린더로 날짜 선택 */
export async function startRunning(ctx) {
  const user = await getUser(ctx.from.id);
  if (!user?.registered) {
    await ctx.reply('먼저 /start 로 등록을 완료해주세요.');
    return;
  }
  await setState(ctx.from.id, { step: 'awaiting_date' });
  await ctx.reply('📅 운동한 날짜를 선택해주세요.', calendarInline());
}

/** 러닝 관련 인라인 콜백 (캘린더 날짜 선택) */
export function setupRunningActions(bot) {
  // 빈 칸/헤더 등 무반응 버튼
  bot.action('cal:ignore', (ctx) => ctx.answerCbQuery().catch(() => {}));

  // 달 이동
  bot.action(/^cal:nav:(\d{4}-\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx
      .editMessageReplyMarkup(calendarInline(ctx.match[1]).reply_markup)
      .catch(() => {});
  });

  // 날짜 선택 → 사진 요청 단계로
  bot.action(/^cal:day:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const user = await getUser(ctx.from.id);
    if (!user?.registered) {
      await ctx.answerCbQuery('먼저 /start 로 등록을 완료해주세요.').catch(() => {});
      return;
    }
    const dateKey = ctx.match[1];
    await setState(ctx.from.id, { step: 'awaiting_photo', selectedDate: dateKey });
    await ctx.answerCbQuery(`${dateKey} 선택됨`).catch(() => {});
    await ctx
      .editMessageText(
        `📅 선택한 날짜: ${dateKey}\n\n` +
          '📸 이제 러닝 앱 스크린샷을 보내주세요.\n' +
          '나이키 런·스트라바·삼성헬스 등 기록 화면을 전송하면\n' +
          '거리·시간·칼로리를 자동으로 읽어옵니다.',
        cancelInline()
      )
      .catch(() => {});
  });
}

/** 사진 수신 처리 */
export async function handlePhoto(ctx) {
  const user = await getUser(ctx.from.id);
  if (!user?.registered) {
    await ctx.reply('먼저 /start 로 등록을 완료해주세요.');
    return;
  }
  if (user.state?.step !== 'awaiting_photo') {
    await ctx.reply(`러닝을 인증하려면 먼저 [${BTN.RECORD}] 버튼을 눌러주세요.`, mainMenu());
    return;
  }

  await ctx.sendChatAction('typing');
  const thinking = await ctx.reply('🔎 스크린샷을 분석하고 있어요...');

  try {
    // 가장 큰 해상도 사진 선택
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const link = await ctx.telegram.getFileLink(fileId);
    const resp = await fetch(link.href);
    const buffer = Buffer.from(await resp.arrayBuffer());

    const data = await extractRunningData(buffer, 'image/jpeg');

    // 걷기앱은 자문회만 인정. 종류(달리기/걷기) 판정
    const isWalkDept = user.department === WALK_DEPARTMENT;
    const looksWalk = data.activity_type === 'walk' || (data.steps > 0 && !(data.distance_km > 0));
    const type = isWalkDept && looksWalk ? 'walk' : 'run';

    // 판독 실패
    const unreadable = type === 'walk' ? !(data.steps > 0) : !(data.distance_km > 0);
    if (unreadable) {
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
      await ctx.reply(
        isWalkDept
          ? '😅 기록을 읽지 못했어요.\n\n걸음 수 또는 거리가 잘 보이는 화면을 다시 보내주세요.'
          : '😅 러닝 기록을 읽지 못했어요.\n\n거리가 잘 보이는 러닝 앱 결과 화면을 다시 보내주세요.',
        cancelInline()
      );
      return;
    }

    // 캘린더로 사용자가 선택한 날짜 우선. 없으면 OCR 추출 날짜.
    const dateKey = user.state?.selectedDate || toDateKey(data.date);
    const { certified, reason } = evaluateCertification(type, {
      distance: data.distance_km,
      durationSec: data.duration_seconds,
      steps: data.steps,
    });

    const saved = await addRecord(ctx.from.id, {
      type,
      distance: data.distance_km || 0,
      durationSec: data.duration_seconds || 0,
      calories: data.calories || 0,
      steps: data.steps || 0,
      date: dateKey,
      pace: data.pace,
      certified,
      certReason: reason,
      photoFileId: fileId,
      raw: data,
    });

    await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
    await setState(ctx.from.id, { step: 'done' });

    // 판독 내역
    const detail =
      '—————————————————\n' +
      `📅 날짜  ${dateKey}\n` +
      (type === 'walk'
        ? `👟 걸음  ${(data.steps || 0).toLocaleString()}보\n` +
          (data.distance_km ? `📏 거리  ${data.distance_km} km\n` : '')
        : `📏 거리  ${data.distance_km} km\n`) +
      `⏱️ 시간  ${formatDuration(data.duration_seconds)}\n` +
      (data.calories ? `🔥 칼로리  ${data.calories} kcal\n` : '') +
      (data.pace ? `🏃 페이스  ${data.pace}\n` : '') +
      '—————————————————';

    if (!certified) {
      await ctx.reply(
        '아이쿠, 이 기록으로 인증이 조금 어렵네요~ 조금 더 뛰어보시는 건 어떨까요? 🥲\n' +
          detail +
          '\n' +
          (CERT_REASON_TEXT[reason] || '') +
          '\n(이 기록은 불인정으로 저장돼요)',
        mainMenu()
      );
      return;
    }

    const t = saved.totals;
    let msg =
      `✅ 인증 완료!${type === 'walk' ? ' (걷기)' : ''}\n` +
      detail +
      '\n' +
      `누적 인증  ${t.totalCount}회 · 누적 거리  ${t.totalDistance}km`;

    if (saved.isPB) msg += '\n\n🎉 개인 최고 거리(PB)를 갱신했어요!';

    if (saved.newlyEarned.length) {
      msg +=
        '\n\n🏅 새 배지 획득!\n' +
        saved.newlyEarned.map((b) => `${b.emoji} ${b.name}`).join('\n');
    }

    await ctx.reply(msg, mainMenu());
  } catch (err) {
    console.error('handlePhoto error:', err);
    await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
    await ctx.reply('⚠️ 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.', mainMenu());
  }
}
