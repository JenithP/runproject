import { Markup } from 'telegraf';
import { ensureUser, getUser, updateUser } from '../services/users.js';
import { parseHealthPosts, importHealthEntries } from '../services/healthImport.js';
import { mainMenu } from './keyboards.js';

const MAX_MSG = 3800; // 텔레그램 4096자 제한 여유

const adminMenuInline = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📋 건강인증 일괄등록', 'adm:import')],
    [Markup.button.callback('닫기', 'adm:close')],
  ]);

const importInline = (count) =>
  Markup.inlineKeyboard([
    [Markup.button.callback(`✅ 저장 (${count}건)`, 'adm:save')],
    [Markup.button.callback('❌ 취소', 'adm:cancel')],
  ]);

// 이전 상태 저장 시 중첩된 prev 제거
const bare = (st) => (st ? (({ prev, ...rest }) => rest)(st) : null);

const clip = (s) => (s.length > MAX_MSG ? s.slice(0, MAX_MSG) + '\n…(생략)' : s);

/** 관리자 모드 종료 → 이전 대화 상태 복원 */
async function exitImport(ctx, user) {
  await updateUser(ctx.from.id, {
    state: user.state?.prev ?? { step: user.registered ? 'done' : 'name' },
    importBuffer: [],
  });
}

async function showAdminMenu(ctx) {
  await ctx.reply('🛠 관리자 메뉴', adminMenuInline());
}

// 전각 문자(＠ 등)/앞뒤 공백 차이로 비밀번호가 틀리지 않게 정규화
const normPw = (s) => String(s || '').normalize('NFKC').trim();
const checkPw = (input) => !!process.env.ADMIN_PASSWORD && normPw(input) === normPw(process.env.ADMIN_PASSWORD);

/** 비밀번호 확인 후 관리자 지정 + 메뉴 표시 */
async function grantAdmin(ctx, user, pw, restoreState) {
  await ctx.deleteMessage().catch(() => {}); // 비밀번호가 채팅에 남지 않게
  const patch = restoreState ? { state: user?.state?.prev ?? null } : {};
  if (!checkPw(pw)) {
    if (restoreState) await updateUser(ctx.from.id, patch);
    await ctx.reply('비밀번호가 올바르지 않습니다. 다시 /admin 을 입력해주세요.');
    return;
  }
  await updateUser(ctx.from.id, { ...patch, isAdmin: true });
  await ctx.reply('🔑 관리자로 지정되었습니다. 다음부터는 /admin 만 입력하면 메뉴가 열려요.');
  await showAdminMenu(ctx);
}

/** 관리자 모드에서 붙여넣은 텍스트 처리. 처리했으면 true */
export async function handleAdminText(ctx, user) {
  // /admin 후 비밀번호를 따로 보낸 경우
  if (user?.state?.step === 'admin_pw') {
    await grantAdmin(ctx, user, ctx.message.text, true);
    return true;
  }
  if (!user?.isAdmin || user.state?.step !== 'admin_import') return false;

  const { entries, errors } = parseHealthPosts(ctx.message.text);
  const buffer = Array.isArray(user.importBuffer) ? user.importBuffer : [];
  const keys = new Set(buffer.map((e) => e.key));
  const added = entries.filter((e) => !keys.has(e.key));
  const next = [...buffer, ...added];
  await updateUser(ctx.from.id, { importBuffer: next });

  const lines = [];
  lines.push(`📥 이번 메시지: ${entries.length}건 인식` + (entries.length - added.length ? ` (이미 받은 글 ${entries.length - added.length}건 제외)` : ''));
  if (errors.length) {
    lines.push(`⚠️ 형식 오류 ${errors.length}건 (저장 안 됨)`);
    for (const e of errors.slice(0, 10)) lines.push(`  · ${e.reason}: ${e.text}`);
    if (errors.length > 10) lines.push(`  · …외 ${errors.length - 10}건`);
  }
  lines.push('');
  lines.push(`누적 ${next.length}건 대기 중`);
  for (const e of added.slice(0, 30)) lines.push(`  · ${e.date.slice(2).replace(/-/g, '.')} ${e.name} (${e.department || '-'}) ${e.sport}`);
  if (added.length > 30) lines.push(`  · …외 ${added.length - 30}건`);
  lines.push('');
  lines.push('더 보낼 글이 있으면 계속 붙여넣고, 다 됐으면 [저장]을 눌러주세요.');

  await ctx.reply(clip(lines.join('\n')), next.length ? importInline(next.length) : undefined);
  return true;
}

function formatResult(r) {
  const fmt = (e) => `${e.date.slice(2).replace(/-/g, '.')} ${e.name}(${e.department || '-'}) ${e.sport}`;
  const lines = [];
  lines.push('✅ 건강인증 일괄등록 완료');
  lines.push('—————————————————');
  lines.push(`· 저장: ${r.saved.length}건 (${r.matchedUsers.size}명)`);
  if (r.newUsers.length) {
    lines.push(`· 신규 임시회원: ${r.newUsers.length}명 (봇에 같은 이름으로 가입하면 자동 합쳐짐)`);
    lines.push('  ' + r.newUsers.map((u) => `${u.name}(${u.department || '-'})`).join(', '));
  }
  if (r.duplicates.length) lines.push(`· 이미 등록된 글(중복): ${r.duplicates.length}건 — 건너뜀`);
  if (r.mismatched.length) {
    lines.push(`· ⚠️ 부서가 달라도 이름이 1명뿐이라 매칭: ${r.mismatched.length}건`);
    for (const m of r.mismatched.slice(0, 10))
      lines.push(`  · ${fmt(m.entry)} → 회원 부서 ${m.user.department || '-'}`);
  }
  if (r.ambiguous.length) {
    lines.push(`· ❗ 동명이인 구분 불가(저장 안 됨): ${r.ambiguous.length}건`);
    for (const a of r.ambiguous.slice(0, 15))
      lines.push(
        `  · ${fmt(a.entry)} → 후보: ${a.candidates.map((u) => `${u.name}/${u.department || '-'}/${u.unit || '-'}`).join(', ')}`
      );
    lines.push('  ※ 이름에 A, B 를 붙이거나 반구역을 맞춰 다시 붙여넣어 주세요.');
  }
  return clip(lines.join('\n'));
}

export function setupAdmin(bot) {
  // /admin <비밀번호> → 관리자 지정, /admin → 관리자 메뉴
  bot.command('admin', async (ctx) => {
    const arg = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
    let user = await getUser(ctx.from.id);
    if (!user) {
      const tgName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
      user = await ensureUser(ctx.from.id, tgName);
    }
    if (arg) {
      await grantAdmin(ctx, user, arg, false);
      return;
    }
    if (user.isAdmin) {
      await showAdminMenu(ctx);
      return;
    }
    // 비밀번호를 다음 메시지로 받기
    const prev = bare(user.state?.step === 'admin_pw' ? user.state.prev : user.state);
    await updateUser(ctx.from.id, { state: { step: 'admin_pw', prev } });
    await ctx.reply('🔑 관리자 비밀번호를 입력해주세요.');
  });

  bot.action('adm:close', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  });

  bot.action('adm:import', async (ctx) => {
    const user = await getUser(ctx.from.id);
    if (!user?.isAdmin) return ctx.answerCbQuery('관리자 전용입니다');
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    const prev = bare(user.state?.step === 'admin_import' ? user.state.prev : user.state);
    await updateUser(ctx.from.id, { state: { step: 'admin_import', prev }, importBuffer: [] });
    await ctx.reply(
      '📋 건강인증 일괄등록\n\n' +
        '다른 방에서 복사한 [건강 프로젝트 인증] 글들을 그대로 붙여넣어 보내주세요.\n' +
        '길면 여러 메시지로 나눠 보내도 돼요. 모두 보낸 뒤 [저장]을 누르면 반영됩니다.\n\n' +
        '형식 예)\n날짜:26.11.19\n부서:청년회\n반구역:2-18\n이름:김알곡\n종목:필라테스',
      Markup.inlineKeyboard([Markup.button.callback('❌ 취소', 'adm:cancel')])
    );
  });

  bot.action('adm:cancel', async (ctx) => {
    await ctx.answerCbQuery('취소되었습니다');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    const user = await getUser(ctx.from.id);
    if (user?.state?.step === 'admin_import') await exitImport(ctx, user);
    await ctx.reply('일괄등록을 취소했어요.', user?.registered ? mainMenu() : undefined);
  });

  bot.action('adm:save', async (ctx) => {
    const user = await getUser(ctx.from.id);
    if (!user?.isAdmin) return ctx.answerCbQuery('관리자 전용입니다');
    if (user.state?.step !== 'admin_import') return ctx.answerCbQuery('이미 처리되었어요');
    const buffer = Array.isArray(user.importBuffer) ? user.importBuffer : [];
    await ctx.answerCbQuery('저장 중…');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    if (!buffer.length) {
      await ctx.reply('저장할 글이 없어요. 먼저 인증글을 붙여넣어 주세요.');
      return;
    }
    // 중복 클릭 방지: 먼저 상태부터 종료
    await exitImport(ctx, user);
    await ctx.reply(`⏳ ${buffer.length}건 저장 중…`);
    try {
      const result = await importHealthEntries(buffer, { importedBy: ctx.from.id });
      await ctx.reply(formatResult(result), user.registered ? mainMenu() : undefined);
    } catch (e) {
      console.error('[admin import]', e);
      await ctx.reply(`저장 중 오류가 발생했어요: ${e.message}\n다시 시도해주세요 (이미 저장된 건은 중복 처리됩니다).`);
    }
  });
}
