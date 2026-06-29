import { db, FieldValue } from '../config/firebase.js';
import { COL } from '../config/constants.js';

const col = () => db.collection(COL.USERS);

const EMPTY_TOTALS = {
  totalCount: 0,
  totalDistance: 0, // km
  totalTime: 0, // sec
  totalCalories: 0,
  maxDistance: 0, // PB
  currentStreak: 0,
  longestStreak: 0,
  lastRunDate: null, // YYYY-MM-DD
  badges: [], // 획득한 배지 id 목록
};

/** 텔레그램 id로 사용자 조회 (없으면 null) */
export async function getUser(telegramId) {
  const snap = await col().doc(String(telegramId)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/** 신규 사용자 셸 생성 (가입 시작) */
export async function ensureUser(telegramId, telegramName = '') {
  const ref = col().doc(String(telegramId));
  const snap = await ref.get();
  if (snap.exists) return { id: snap.id, ...snap.data() };
  const data = {
    telegramId: String(telegramId),
    telegramName,
    name: null,
    department: null,
    unit: null,
    gender: null,
    registered: false,
    state: { step: 'name' },
    totals: { ...EMPTY_TOTALS },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

/** 임의 필드 업데이트 */
export async function updateUser(telegramId, patch) {
  await col()
    .doc(String(telegramId))
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** 대화 상태만 갱신 */
export async function setState(telegramId, state) {
  await updateUser(telegramId, { state });
}

/** 전체 사용자 (공지 발송용) */
export async function getAllUsers() {
  const snap = await col().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 등록 완료된 사용자만 */
export async function getRegisteredUsers() {
  const snap = await col().where('registered', '==', true).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { EMPTY_TOTALS };
