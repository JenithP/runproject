import { Markup } from 'telegraf';
import { DEPARTMENTS, GENDERS } from '../config/constants.js';
import { dayjs, now } from '../lib/date.js';

export const BTN = {
  RECORD: '🏃 러닝 기록하기',
  MY_RECORD: '📊 내 기록',
  INFO: 'ℹ️ 내 정보',
};

/** 하단 상시 메뉴 (persistent: 항상 키보드 자리에 고정 표시) */
export const mainMenu = () =>
  Markup.keyboard([[BTN.RECORD], [BTN.MY_RECORD, BTN.INFO]])
    .resize()
    .persistent()
    .placeholder('메뉴를 선택하세요 🏃');

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

// 빈 칸/비활성 버튼용 (텍스트가 비어있으면 텔레그램이 거부하므로 점자 공백 U+2800 사용)
const BLANK = '⠀';
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 날짜 선택 캘린더 (인라인). 미래 날짜는 선택 불가.
 * @param {string} [ym] 표시할 달 'YYYY-MM' (기본: 이번 달)
 * callback: cal:day:YYYY-MM-DD | cal:nav:YYYY-MM | cal:ignore | cancel
 */
export const calendarInline = (ym) => {
  const today = now();
  const base = (ym ? dayjs.tz(`${ym}-01`) : today).startOf('month');
  const year = base.year();
  const month = base.month(); // 0-11
  const daysInMonth = base.daysInMonth();
  const startWeekday = base.day(); // 0(일)~6(토)

  const rows = [];

  // 헤더: ◀ YYYY년 M월 ▶ (다음 달이 미래면 ▶ 비활성)
  const prevYm = base.subtract(1, 'month').format('YYYY-MM');
  const nextMonth = base.add(1, 'month');
  const nextDisabled = nextMonth.isAfter(today, 'month');
  rows.push([
    Markup.button.callback('◀', `cal:nav:${prevYm}`),
    Markup.button.callback(`${year}년 ${month + 1}월`, 'cal:ignore'),
    nextDisabled
      ? Markup.button.callback(BLANK, 'cal:ignore')
      : Markup.button.callback('▶', `cal:nav:${nextMonth.format('YYYY-MM')}`),
  ]);

  // 요일 헤더
  rows.push(WEEK.map((w) => Markup.button.callback(w, 'cal:ignore')));

  // 날짜 그리드
  let cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(Markup.button.callback(BLANK, 'cal:ignore'));
  for (let d = 1; d <= daysInMonth; d++) {
    const date = base.date(d);
    const key = date.format('YYYY-MM-DD');
    const isFuture = date.isAfter(today, 'day');
    const label = date.isSame(today, 'day') ? `[${d}]` : String(d);
    cells.push(
      isFuture
        ? Markup.button.callback(BLANK, 'cal:ignore')
        : Markup.button.callback(label, `cal:day:${key}`)
    );
    if (cells.length === 7) {
      rows.push(cells);
      cells = [];
    }
  }
  if (cells.length) {
    while (cells.length < 7) cells.push(Markup.button.callback(BLANK, 'cal:ignore'));
    rows.push(cells);
  }

  rows.push([Markup.button.callback('취소', 'cancel')]);

  return Markup.inlineKeyboard(rows);
};
