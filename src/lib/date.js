import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

export const TZ = process.env.TZ || 'Asia/Seoul';
dayjs.tz.setDefault(TZ);

/** 현재 시각 (KST) */
export const now = () => dayjs().tz(TZ);

/** YYYY-MM-DD 문자열로 정규화 (날짜 키). 입력이 없거나 파싱 실패시 오늘. */
export function toDateKey(input) {
  if (!input) return now().format('YYYY-MM-DD');
  const d = dayjs(input);
  return d.isValid() ? d.tz(TZ).format('YYYY-MM-DD') : now().format('YYYY-MM-DD');
}

/** 이번 주(월요일 시작) 시작/끝 날짜 키 */
export function thisWeekRange(ref = now()) {
  const start = ref.startOf('isoWeek'); // 월요일
  const end = ref.endOf('isoWeek'); // 일요일
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

/** 두 날짜키(YYYY-MM-DD)가 연속인지 (b가 a의 다음날) */
export function isNextDay(a, b) {
  return dayjs(a).add(1, 'day').format('YYYY-MM-DD') === b;
}

/** 초 단위 시간을 "1시간 23분 45초" 형태로 */
export function formatDuration(sec) {
  if (!sec || sec <= 0) return '0분';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts = [];
  if (h) parts.push(`${h}시간`);
  if (m) parts.push(`${m}분`);
  if (!h && s) parts.push(`${s}초`);
  return parts.join(' ') || '0분';
}

/** 평균 페이스: 초/km → "5'42"/km" */
export function formatPace(secPerKm) {
  if (!secPerKm || secPerKm <= 0 || !isFinite(secPerKm)) return '-';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, '0')}"/km`;
}

export { dayjs };
