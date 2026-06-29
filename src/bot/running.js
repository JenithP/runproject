import { getUser, setState } from '../services/users.js';
import { addRecord } from '../services/records.js';
import { extractRunningData } from '../ocr/vision.js';
import { toDateKey, formatDuration } from '../lib/date.js';
import { mainMenu, cancelInline, BTN } from './keyboards.js';

/** "러닝 기록하기" — 사진 요청 */
export async function startRunning(ctx) {
  const user = await getUser(ctx.from.id);
  if (!user?.registered) {
    await ctx.reply('먼저 /start 로 등록을 완료해주세요.');
    return;
  }
  await setState(ctx.from.id, { step: 'awaiting_photo' });
  await ctx.reply(
    '📸 러닝 앱 스크린샷을 보내주세요.\n\n' +
      '갤러리에서 나이키 런·스트라바·삼성헬스 등 기록 화면을 선택해 전송하면\n' +
      '거리·시간·날짜·칼로리를 자동으로 읽어옵니다.',
    cancelInline()
  );
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

    if (!data.distance_km || data.distance_km <= 0) {
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
      await ctx.reply(
        '😅 러닝 기록을 읽지 못했어요.\n\n' +
          '거리가 잘 보이는 러닝 앱 결과 화면을 다시 보내주세요.',
        cancelInline()
      );
      return;
    }

    const dateKey = toDateKey(data.date);
    const saved = await addRecord(ctx.from.id, {
      distance: data.distance_km,
      durationSec: data.duration_seconds || 0,
      calories: data.calories || 0,
      date: dateKey,
      pace: data.pace,
      photoFileId: fileId,
      raw: data,
    });

    await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
    await setState(ctx.from.id, { step: 'done' });

    const t = saved.totals;
    let msg =
      '✅ 인증 완료!\n' +
      '—————————————————\n' +
      `📅 날짜  ${dateKey}\n` +
      `📏 거리  ${data.distance_km} km\n` +
      `⏱️ 시간  ${formatDuration(data.duration_seconds)}\n` +
      (data.calories ? `🔥 칼로리  ${data.calories} kcal\n` : '') +
      (data.pace ? `🏃 페이스  ${data.pace}\n` : '') +
      '—————————————————\n' +
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
