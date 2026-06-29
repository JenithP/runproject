import { DEPARTMENTS } from '../config/constants.js';
import { ensureUser, getUser, setState, updateUser } from '../services/users.js';
import { departmentInline, genderInline, mainMenu, BTN } from './keyboards.js';

/** 가입 시작: 이름부터 */
export async function startRegistration(ctx) {
  const tgName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  await ensureUser(ctx.from.id, tgName);
  await setState(ctx.from.id, { step: 'name' });
  await ctx.reply(
    '🏃 강동 러닝프로젝트에 오신 걸 환영합니다!\n\n' +
      '먼저 등록을 진행할게요.\n\n이름을 입력해주세요.'
  );
}

/**
 * 등록 단계의 텍스트 입력 처리.
 * @returns true 면 등록 흐름에서 처리됨 (다른 핸들러로 넘기지 않음)
 */
export async function handleRegistrationText(ctx, user) {
  const step = user.state?.step;
  const text = (ctx.message.text || '').trim();

  if (step === 'name') {
    if (!text) return ctx.reply('이름을 입력해주세요.'), true;
    await updateUser(ctx.from.id, { name: text, state: { step: 'department' } });
    await ctx.reply(`반갑습니다, ${text} 님!\n\n소속 부서를 선택해주세요.`, departmentInline());
    return true;
  }

  if (step === 'department') {
    // 인라인 버튼 대신 숫자/이름을 직접 입력한 경우도 허용
    const byNum = DEPARTMENTS[parseInt(text, 10) - 1];
    const dept = DEPARTMENTS.includes(text) ? text : byNum;
    if (!dept) {
      await ctx.reply('아래 버튼에서 부서를 선택하거나, 1~6 숫자로 입력해주세요.', departmentInline());
      return true;
    }
    await saveDepartment(ctx, dept);
    return true;
  }

  if (step === 'unit') {
    if (!text) return ctx.reply('예) 1부 2팀 3구역  형식으로 입력해주세요.'), true;
    await updateUser(ctx.from.id, { unit: text, state: { step: 'gender' } });
    await ctx.reply('성별을 선택해주세요.', genderInline());
    return true;
  }

  if (step === 'gender') {
    await ctx.reply('아래 버튼에서 성별을 선택해주세요.', genderInline());
    return true;
  }

  return false;
}

async function saveDepartment(ctx, dept) {
  await updateUser(ctx.from.id, { department: dept, state: { step: 'unit' } });
  await ctx.reply(
    `부서: ${dept} ✅\n\n` +
      '몇 부 몇 팀 몇 구역인지 입력해주세요.\n예) 1부 2팀 3구역'
  );
}

/** dept:/gender: 인라인 콜백 등록 */
export function setupRegistrationActions(bot) {
  bot.action(/^dept:(.+)$/, async (ctx) => {
    const dept = ctx.match[1];
    const user = await getUser(ctx.from.id);
    if (user?.state?.step !== 'department') return ctx.answerCbQuery();
    await ctx.answerCbQuery(`${dept} 선택`);
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await saveDepartment(ctx, dept);
  });

  bot.action(/^gender:(.+)$/, async (ctx) => {
    const gender = ctx.match[1];
    const user = await getUser(ctx.from.id);
    if (user?.state?.step !== 'gender') return ctx.answerCbQuery();
    await ctx.answerCbQuery(`${gender} 선택`);
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await updateUser(ctx.from.id, {
      gender,
      registered: true,
      state: { step: 'done' },
    });
    await ctx.reply(
      '🎉 등록이 완료되었습니다!\n\n' +
        `· 이름: ${user.name}\n· 부서: ${user.department}\n· 소속: ${user.unit}\n· 성별: ${gender}\n\n` +
        `아래 [${BTN.RECORD}] 버튼으로 러닝을 인증하고, [${BTN.MY_RECORD}]로 내 기록을 확인하세요!`,
      mainMenu()
    );
  });
}
