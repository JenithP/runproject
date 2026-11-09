/**
 * [건강 프로젝트 인증] 글 일괄 등록.
 *
 * 다른 텔레그램 방에서 여러 건을 한 번에 복사해 관리자가 봇에 붙여넣으면
 *  1) parseHealthPosts  : 텍스트 → 인증 항목 배열
 *  2) importHealthEntries: 이름(+부서/반구역)으로 회원 매칭 → 기록 저장 → 누적 재계산
 * 매칭 안 되는 사람은 임시(offline) 회원으로 만들고, 나중에 같은 이름으로 봇 가입하면
 * mergeOfflineInto 로 기록을 합친다.
 */
import { db, FieldValue } from '../config/firebase.js';
import { COL, DEPARTMENTS } from '../config/constants.js';
import { dayjs, now } from '../lib/date.js';
import { EMPTY_TOTALS } from './users.js';
import { refreshUserTotals } from './records.js';

const usersCol = () => db.collection(COL.USERS);
const recordsCol = () => db.collection(COL.RECORDS);

// ── 정규화 ─────────────────────────────────────────────

/** 이름: 공백/괄호 제거 + 영문 대문자 ("김알곡 (a)" → "김알곡A") */
export const normName = (s = '') =>
  String(s).replace(/\s+/g, '').replace(/[()（）[\]<>]/g, '').toUpperCase();

const normPlain = (s = '') => String(s).replace(/\s+/g, '');

/** 문서 ID 안전 문자열 */
const idSafe = (s = '') => String(s).replace(/[\s/\\.#$[\]]/g, '');

// 부서 별칭 → 실제 부서 후보
const DEPT_ALIASES = {
  자문: ['자문회'],
  장년: ['장년회'],
  여청: ['여청년'],
  남청: ['남청년'],
  청년: ['여청년', '남청년'],
  청년회: ['여청년', '남청년'],
  부녀: ['부녀회'],
  중진: ['중진교역'],
};

/** 입력 부서 문자열 → 실제 부서 후보 목록 (모르면 []) */
export function deptCandidates(raw) {
  const d = normPlain(raw);
  if (!d) return [];
  if (DEPARTMENTS.includes(d)) return [d];
  if (DEPT_ALIASES[d]) return DEPT_ALIASES[d];
  for (const [k, v] of Object.entries(DEPT_ALIASES)) if (d.startsWith(k)) return v;
  return [];
}

const genderFromDept = (dept) => (dept === '여청년' || dept === '부녀회' ? '여' : dept === '남청년' ? '남' : null);

const nums = (s = '') => (String(s).match(/\d+/g) || []).map(Number);

/** 반구역 "2-18" 이 회원 소속 "1부 2팀 18구역" 과 맞는지 (숫자열 끝부분 일치) */
function unitMatches(pasteUnit, userUnit) {
  const a = nums(pasteUnit);
  const b = nums(userUnit);
  if (!a.length || !b.length) return false;
  if (a.length > b.length) return false;
  return a.every((n, i) => b[b.length - a.length + i] === n);
}

// ── 날짜 ───────────────────────────────────────────────

/**
 * "26.11.19" / "2026.11.19" / "26-11-19" / "11.19" / "11월 19일" → 'YYYY-MM-DD' (실패시 null)
 * 연도 없는 경우 올해(미래가 되면 작년).
 */
export function parseKoDate(raw, ref = now()) {
  const s = String(raw || '').trim();
  let y;
  let m;
  let d;
  let mt = s.match(/(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (mt) {
    y = Number(mt[1]);
    if (y < 100) y += 2000;
    m = Number(mt[2]);
    d = Number(mt[3]);
  } else if ((mt = s.match(/(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/))) {
    m = Number(mt[1]);
    d = Number(mt[2]);
    y = ref.year();
    const cand = dayjs(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    if (cand.isAfter(ref, 'day')) y -= 1;
  } else {
    return null;
  }
  const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = dayjs(key, 'YYYY-MM-DD', true);
  return dt.isValid() ? key : null;
}

// ── 파싱 ───────────────────────────────────────────────

const FIELD_KEYS = {
  날짜: 'date',
  일자: 'date',
  부서: 'department',
  반구역: 'unit',
  구역: 'unit',
  이름: 'name',
  성명: 'name',
  종목: 'sport',
  운동: 'sport',
};
const FIELD_RE = /^\s*[-·•*]?\s*(날\s*짜|일\s*자|부\s*서|반\s*구\s*역|구\s*역|이\s*름|성\s*명|종\s*목|운\s*동)\s*[:：]\s*(.*?)\s*$/;
const HEADER_RE = /건강\s*프로젝트\s*인증/;

/**
 * 붙여넣은 텍스트 → { entries, errors }
 *  entries: [{ date, department, unit, name, sport, key }]
 *  errors : [{ text, reason }]
 * 블록 구분: "[건강 프로젝트 인증]" 헤더, 또는 같은 필드가 다시 나오면 새 글로 간주.
 */
export function parseHealthPosts(text, ref = now()) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let cur = null;
  const flush = () => {
    if (cur && Object.keys(cur.fields).length) blocks.push(cur);
    cur = null;
  };
  for (const line of lines) {
    if (HEADER_RE.test(line)) {
      flush();
      cur = { fields: {}, lines: [] };
      continue;
    }
    const m = line.match(FIELD_RE);
    if (!m) continue;
    const key = FIELD_KEYS[m[1].replace(/\s+/g, '')];
    if (!cur || cur.fields[key] != null) {
      flush();
      cur = { fields: {}, lines: [] };
    }
    cur.fields[key] = m[2];
    cur.lines.push(line.trim());
  }
  flush();

  const entries = [];
  const errors = [];
  const seen = new Set();
  for (const b of blocks) {
    const f = b.fields;
    const preview = b.lines.join(' / ');
    if (!f.name) {
      errors.push({ text: preview, reason: '이름 없음' });
      continue;
    }
    const date = parseKoDate(f.date, ref);
    if (!date) {
      errors.push({ text: preview, reason: '날짜 형식 오류' });
      continue;
    }
    if (dayjs(date).isAfter(ref, 'day')) {
      errors.push({ text: preview, reason: `미래 날짜(${date})` });
      continue;
    }
    const sport = (f.sport || '').trim() || '기타';
    const entry = {
      date,
      department: (f.department || '').trim(),
      unit: (f.unit || '').trim(),
      name: f.name.trim(),
      sport,
    };
    entry.key = entryKey(entry);
    if (seen.has(entry.key)) continue; // 같은 글 중복 붙여넣기
    seen.add(entry.key);
    entries.push(entry);
  }
  return { entries, errors };
}

/** 중복 판정 키 = 이름 + 날짜 + 종목 (기록 문서 ID 로도 사용) */
export const entryKey = (e) => `hp_${e.date}_${idSafe(normName(e.name))}_${idSafe(normPlain(e.sport))}`;

// ── 매칭 ───────────────────────────────────────────────

/**
 * 한 항목을 회원 목록에서 찾기.
 * @returns {{user?:object, ambiguous?:object[], mismatch?:boolean}}
 */
export function matchUser(entry, allUsers) {
  const n = normName(entry.name);
  const sameName = allUsers.filter((u) => u.name && normName(u.name) === n);
  if (sameName.length === 0) return {};
  const cands = deptCandidates(entry.department);
  const deptOk = (u) => !cands.length || cands.includes(u.department) || normPlain(u.department) === normPlain(entry.department);
  if (sameName.length === 1) {
    return { user: sameName[0], mismatch: !deptOk(sameName[0]) };
  }
  // 동명이인: 부서 → 반구역 순으로 좁힘. 정식 회원 우선.
  let pool = sameName.filter(deptOk);
  if (pool.length > 1 && entry.unit) {
    const byUnit = pool.filter((u) => unitMatches(entry.unit, u.unit));
    if (byUnit.length) pool = byUnit;
  }
  if (pool.length > 1) {
    const registered = pool.filter((u) => u.registered);
    if (registered.length === 1) pool = registered;
  }
  if (pool.length === 1) return { user: pool[0] };
  return { ambiguous: pool.length ? pool : sameName };
}

// ── 일괄 등록 ──────────────────────────────────────────

async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/**
 * 인증 항목 저장.
 * @returns {{saved, duplicates, ambiguous, mismatched, newUsers, matchedUsers}}
 */
export async function importHealthEntries(entries, { importedBy = null } = {}) {
  const snap = await usersCol().get();
  const allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const result = {
    saved: [],
    duplicates: [],
    ambiguous: [],
    mismatched: [],
    newUsers: [],
    matchedUsers: new Set(),
  };

  // 1) 매칭 (임시 회원 생성 포함 — 같은 붙여넣기 안 신규 동일인은 한 명으로)
  const plan = [];
  for (const e of entries) {
    const m = matchUser(e, allUsers);
    if (m.ambiguous) {
      result.ambiguous.push({ entry: e, candidates: m.ambiguous });
      continue;
    }
    let user = m.user;
    if (!user) {
      const cands = deptCandidates(e.department);
      const dept = cands.length === 1 ? cands[0] : e.department || null;
      const ref = usersCol().doc();
      user = {
        id: ref.id,
        telegramId: null,
        telegramName: '',
        name: e.name,
        department: dept,
        unit: e.unit || null,
        gender: genderFromDept(dept),
        registered: false,
        offline: true,
        source: 'health_import',
        state: null,
        totals: { ...EMPTY_TOTALS },
      };
      await ref.set({
        ...user,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      delete user.id;
      user = { id: ref.id, ...user };
      allUsers.push(user);
      result.newUsers.push(user);
    } else if (m.mismatch) {
      result.mismatched.push({ entry: e, user });
    }
    plan.push({ entry: e, user });
  }

  // 2) 기록 저장 (문서 ID = 이름+날짜+종목 → 재붙여넣기 중복 방지)
  await inChunks(plan, 10, async ({ entry: e, user }) => {
    const doc = {
      userId: String(user.id),
      name: user.name || e.name,
      department: user.department || e.department || null,
      gender: user.gender || null,
      unit: e.unit || user.unit || null,
      date: e.date,
      type: 'health',
      sport: e.sport,
      distance: 0,
      durationSec: 0,
      calories: 0,
      steps: 0,
      pace: null,
      certified: true,
      certReason: null,
      photoFileId: null,
      source: 'health_import',
      importedBy: importedBy ? String(importedBy) : null,
      raw: { department: e.department, unit: e.unit, name: e.name },
      createdAt: FieldValue.serverTimestamp(),
    };
    try {
      await recordsCol().doc(e.key).create(doc);
      result.saved.push({ entry: e, user });
      result.matchedUsers.add(String(user.id));
    } catch (err) {
      if (err?.code === 6 || /already exists/i.test(err?.message || '')) {
        result.duplicates.push({ entry: e, user });
      } else {
        throw err;
      }
    }
  });

  // 3) 영향받은 회원 누적 재계산
  await inChunks([...result.matchedUsers], 10, (id) => refreshUserTotals(id));

  return result;
}

// ── 봇 가입 시 임시 회원 병합 ──────────────────────────

/**
 * 방금 가입 완료한 회원(user)과 이름이 같은 임시 회원을 찾아 기록을 합친다.
 * 임시 회원이 정확히 1명일 때만 병합 (부서가 다르면 병합하지 않음).
 * @returns 병합된 기록 수 (없으면 0)
 */
export async function mergeOfflineInto(userId, user) {
  if (!user?.name) return 0;
  const snap = await usersCol().where('offline', '==', true).get();
  const n = normName(user.name);
  const matches = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => normName(o.name) === n)
    .filter((o) => {
      if (!o.department) return true;
      const c = deptCandidates(o.department);
      return c.length ? c.includes(user.department) : normPlain(o.department) === normPlain(user.department);
    });
  if (matches.length !== 1) return 0;
  const offline = matches[0];

  const recs = await recordsCol().where('userId', '==', offline.id).get();
  const batch = db.batch();
  for (const d of recs.docs) {
    batch.update(d.ref, {
      userId: String(userId),
      name: user.name,
      department: user.department || d.data().department || null,
      gender: user.gender || d.data().gender || null,
    });
  }
  batch.delete(usersCol().doc(offline.id));
  await batch.commit();
  await refreshUserTotals(userId);
  return recs.size;
}
