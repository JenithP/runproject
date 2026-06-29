import { Markup } from 'telegraf';
import { DEPARTMENTS, GENDERS } from '../config/constants.js';

export const BTN = {
  RECORD: '🏃 러닝 기록하기',
  MY_RECORD: '📊 내 기록',
  INFO: 'ℹ️ 내 정보',
};

/** 하단 상시 메뉴 */
export const mainMenu = () =>
  Markup.keyboard([[BTN.RECORD], [BTN.MY_RECORD, BTN.INFO]]).resize();

/** 부서 선택 (인라인) — callback: dept:<부서명> */
export const departmentInline = () =>
  Markup.inlineKeyboard(
    DEPARTMENTS.map((d, i) => Markup.button.callback(`${i + 1}. ${d}`, `dept:${d}`)),
    { columns: 2 }
  );

/** 성별 선택 (인라인) — callback: gender:<남|여> */
export const genderInline = () =>
  Markup.inlineKeyboard(
    GENDERS.map((g) => Markup.button.callback(g, `gender:${g}`)),
    { columns: 2 }
  );

/** 사진 등록 취소 */
export const cancelInline = () =>
  Markup.inlineKeyboard([Markup.button.callback('취소', 'cancel')]);
