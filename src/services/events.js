import { db, FieldValue } from '../config/firebase.js';
import { COL } from '../config/constants.js';

const events = () => db.collection(COL.EVENTS);
const announcements = () => db.collection(COL.ANNOUNCEMENTS);

// ── 이벤트 (월요일 자동 공지 대상) ──────────────────────
// order 오름차순으로 정렬, 가장 위(min order)가 자동 공지됨.

export async function listEvents() {
  const snap = await events().orderBy('order', 'asc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent({ title, content, active = true }) {
  // 새 이벤트는 맨 위로 (현재 최소 order - 1)
  const existing = await listEvents();
  const minOrder = existing.length ? Math.min(...existing.map((e) => e.order ?? 0)) : 0;
  const ref = await events().add({
    title,
    content,
    active,
    order: minOrder - 1,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, title, content, active, order: minOrder - 1 };
}

export async function updateEvent(id, patch) {
  await events().doc(id).set(patch, { merge: true });
}

export async function deleteEvent(id) {
  await events().doc(id).delete();
}

/** 자동 공지용 최상단 활성 이벤트. 인메모리 필터로 복합 인덱스 불필요. */
export async function getTopEvent() {
  const all = await listEvents(); // order 오름차순 (단일 필드 정렬 → 인덱스 불필요)
  return all.find((e) => e.active) || null;
}

// ── 공지 (카드형, 기간 있음) ────────────────────────────

export async function listAnnouncements() {
  const snap = await announcements().orderBy('createdAt', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAnnouncement({ title, content, startDate, endDate }) {
  const ref = await announcements().add({
    title,
    content,
    startDate: startDate || null,
    endDate: endDate || null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, title, content, startDate, endDate };
}

export async function deleteAnnouncement(id) {
  await announcements().doc(id).delete();
}
