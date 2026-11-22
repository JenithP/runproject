import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api.js';
import { todayStr, DEPARTMENTS, sportCategories } from '../lib.js';

// 'YYYY-MM-DD' → '11.9'
const shortDate = (d = '') => {
  const [, m, day] = d.split('-');
  return m ? `${Number(m)}.${Number(day)}` : d;
};

// [{sport, count}] → "헬스 3 · 달리기 1"
const sportsText = (list = [], max = 4) => {
  const head = list.slice(0, max).map((s) => `${s.sport} ${s.count}`);
  if (list.length > max) head.push(`외 ${list.length - max}`);
  return head.join(' · ');
};

const SPORT_SUGGEST = ['달리기', '걷기', '헬스', '필라테스', '요가', '수영', '등산', '자전거', '홈트', '스트레칭'];

/** 인증 기록 한 줄 (보기/수정 모드) */
function RecordRow({ r, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const startEdit = () => {
    setForm({
      date: r.date,
      department: r.department,
      unit: r.unit,
      name: r.name,
      sport: r.sport,
      certified: r.certified,
    });
    setErr('');
    setEditing(true);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.updateRecord(r.id, form);
      setEditing(false);
      onSaved({ ...r, ...form, edited: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`${shortDate(r.date)} ${r.name} (${r.sport}) 기록을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
    setBusy(true);
    try {
      await api.deleteRecord(r.id);
      onDeleted(r.id);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <tr className={r.certified === '불인정' ? 'muted' : ''}>
        <td>{shortDate(r.date)}</td>
        <td>{r.department}</td>
        <td className="cell-wrap">{r.unit}</td>
        <td className="cell-wrap">{r.name}</td>
        <td className="cell-wrap">
          {r.sport}
          {r.certified === '불인정' ? ' (불인정)' : ''}
          {r.edited ? <span className="tag">수정됨</span> : null}
        </td>
        <td className="row-actions">
          <button className="btn ghost sm" onClick={startEdit} disabled={busy}>수정</button>
          <button className="btn ghost sm danger" onClick={remove} disabled={busy}>삭제</button>
          {err && <div className="error">{err}</div>}
        </td>
      </tr>
    );
  }

  const deptOptions = DEPARTMENTS.includes(form.department) || !form.department
    ? DEPARTMENTS
    : [form.department, ...DEPARTMENTS];

  return (
    <tr className="editing">
      <td><input type="date" value={form.date} onChange={set('date')} /></td>
      <td>
        <select value={form.department || ''} onChange={set('department')}>
          <option value="">-</option>
          {deptOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </td>
      <td><input value={form.unit || ''} onChange={set('unit')} placeholder="2-18" /></td>
      <td><input value={form.name || ''} onChange={set('name')} /></td>
      <td>
        <input value={form.sport || ''} onChange={set('sport')} list="sport-suggest" />
        <select value={form.certified} onChange={set('certified')}>
          <option value="인정">인정</option>
          <option value="불인정">불인정</option>
        </select>
      </td>
      <td className="row-actions">
        <button className="btn primary sm" onClick={save} disabled={busy}>{busy ? '저장 중' : '저장'}</button>
        <button className="btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>취소</button>
        {err && <div className="error">{err}</div>}
      </td>
    </tr>
  );
}

/** 부서별 출결재적 입력 (월별) */
function RosterEditor({ month: initMonth, roster, onSaved, onClose }) {
  const [month, setMonth] = useState(initMonth);
  const [counts, setCounts] = useState(() => ({ ...(roster.months[initMonth] || {}) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const changeMonth = (m) => {
    setMonth(m);
    setCounts({ ...(roster.months[m] || {}) });
  };

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const r = await api.saveRoster(month, counts);
      onSaved(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="roster-editor">
      <div className="roster-grid">
        <label>
          월
          <input type="month" value={month} onChange={(e) => changeMonth(e.target.value)} />
        </label>
        {DEPARTMENTS.map((d) => (
          <label key={d}>
            {d} 재적
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={counts[d] ?? ''}
              onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="roster-actions">
        <button className="btn primary sm" onClick={save} disabled={busy}>{busy ? '저장 중' : '저장'}</button>
        <button className="btn ghost sm" onClick={onClose} disabled={busy}>닫기</button>
      </div>
      {err && <div className="error">{err}</div>}
    </div>
  );
}

const SORT_LABEL = { date: '날짜순', name: '이름순', count: '횟수순' };

export default function Dashboard() {
  const [start, setStart] = useState(todayStr(-6));
  const [end, setEnd] = useState(todayStr(0));
  const [department, setDepartment] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const [board, setBoard] = useState([]);
  const [depts, setDepts] = useState([]);
  const [daily, setDaily] = useState([]);
  const [recs, setRecs] = useState([]);
  const [roster, setRoster] = useState({ months: {} });
  const [editRoster, setEditRoster] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const q = { start, end };
      const [b, d, day, rs, ro] = await Promise.all([
        api.leaderboard({ ...q, department, sortBy: 'count' }),
        api.departments(q),
        api.daily(q),
        api.records({ ...q, department }),
        api.getRoster(),
      ]);
      setBoard(b);
      setDepts(d);
      setDaily(day);
      setRecs(rs);
      setRoster(ro);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  // 수정/삭제 후 집계(랭킹·부서·추이)만 다시 불러옴
  async function reloadStats() {
    try {
      const q = { start, end };
      const [b, d, day] = await Promise.all([
        api.leaderboard({ ...q, department, sortBy: 'count' }),
        api.departments(q),
        api.daily(q),
      ]);
      setBoard(b);
      setDepts(d);
      setDaily(day);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 랭킹: 이름순이면 이름, 그 외엔 인증 횟수순 (정렬만 바꿔도 즉시 반영)
  const boardByName = sortBy === 'name';
  const sortedBoard = [...board].sort((a, b) =>
    boardByName ? a.name.localeCompare(b.name, 'ko') : b.count - a.count || b.dayCount - a.dayCount
  );

  // 인증 기록 정렬: 날짜순 / 이름순 / 횟수순(많이 올린 사람 먼저)
  const countByUser = {};
  for (const r of recs) countByUser[r.userId] = (countByUser[r.userId] || 0) + 1;
  const sortedRecs = [...recs].sort((a, b) => {
    const byDate = a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    const byName = a.name.localeCompare(b.name, 'ko');
    if (sortBy === 'name') return byName || byDate;
    if (sortBy === 'count') return countByUser[b.userId] - countByUser[a.userId] || byName || byDate;
    return byDate || byName;
  });

  const preset = (days) => {
    setStart(todayStr(-days + 1));
    setEnd(todayStr(0));
  };

  const [exporting, setExporting] = useState(false);
  async function downloadExcel() {
    setExporting(true);
    setErr('');
    try {
      const rows = await api.records({ start, end, department });
      const data = rows.map((r) => ({
        날짜: r.date,
        부서: r.department,
        '지역-구역': r.unit,
        이름: r.name,
        종목: r.sport,
        종목분류: sportCategories(r.sport).join(', '),
        인정여부: r.certified,
        사유: r.certReason,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '인증기록');
      XLSX.writeFile(wb, `강동건강프로젝트_${start}_${end}.xlsx`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setExporting(false);
    }
  }

  const maxDaily = Math.max(1, ...daily.map((d) => d.count));

  // 부서별: 기간 참여 인원 vs 종료일이 속한 달의 출결재적
  const rosterMonth = end.slice(0, 7);
  const monthRoster = roster.months[rosterMonth] || {};
  const deptMap = new Map(depts.map((d) => [d.department, d]));
  const deptNames = [
    ...DEPARTMENTS.filter((d) => deptMap.has(d) || monthRoster[d]),
    ...depts.map((d) => d.department).filter((d) => !DEPARTMENTS.includes(d)),
  ];
  const deptRows = deptNames.map((name) => {
    const d = deptMap.get(name) || { memberCount: 0, count: 0 };
    const total = monthRoster[name] || 0;
    const rate = total ? Math.round((d.memberCount / total) * 1000) / 10 : null;
    return { department: name, memberCount: d.memberCount, count: d.count, total, rate };
  });

  // 종목 선호도 (자동 분류, 인정 기록만)
  const catCount = {};
  const etcSamples = {};
  let catTotal = 0;
  for (const r of recs) {
    if (r.certified === '불인정') continue;
    catTotal += 1;
    for (const c of sportCategories(r.sport)) {
      catCount[c] = (catCount[c] || 0) + 1;
      if (c === '기타') etcSamples[r.sport] = (etcSamples[r.sport] || 0) + 1;
    }
  }
  const cats = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...cats.map((c) => c[1]));
  const etcList = Object.entries(etcSamples).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="stack">
      <datalist id="sport-suggest">
        {SPORT_SUGGEST.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* 필터 */}
      <section className="card">
        <div className="filters">
          <label>
            시작일
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            종료일
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label>
            부서
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">전체</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            정렬
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">날짜순</option>
              <option value="name">이름순</option>
              <option value="count">횟수순</option>
            </select>
          </label>
          <button className="btn primary" onClick={load} disabled={loading}>
            {loading ? '조회 중...' : '조회'}
          </button>
          <button className="btn outline" onClick={downloadExcel} disabled={exporting}>
            {exporting ? '내려받는 중...' : '⬇ 엑셀 다운로드'}
          </button>
        </div>
        <div className="presets">
          <button className="chip" onClick={() => preset(1)}>오늘</button>
          <button className="chip" onClick={() => preset(7)}>최근 7일</button>
          <button className="chip" onClick={() => preset(30)}>최근 30일</button>
        </div>
        {err && <div className="error">{err}</div>}
      </section>

      {/* 인증 기록 (날짜/부서/지역-구역/이름/종목) — 관리자 수정/삭제 */}
      <section className="card">
        <h2>📋 인증 기록 ({recs.length}건 · {SORT_LABEL[sortBy]})</h2>
        {recs.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>날짜</th><th>부서</th><th>지역-구역</th><th>이름</th><th>종목</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRecs.map((r) => (
                  <RecordRow
                    key={r.id}
                    r={r}
                    onSaved={(nr) => {
                      setRecs((list) => list.map((x) => (x.id === nr.id ? nr : x)));
                      reloadStats();
                    }}
                    onDeleted={(id) => {
                      setRecs((list) => list.filter((x) => x.id !== id));
                      reloadStats();
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 일별 인증 횟수 */}
      <section className="card">
        <h2>📈 일별 인증 횟수</h2>
        {daily.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <div className="bars">
            {daily.map((d) => (
              <div className="bar-col" key={d.date} title={`${d.date} · ${d.count}회 · ${d.memberCount}명`}>
                <div className="bar" style={{ height: `${(d.count / maxDaily) * 100}%` }} />
                <span className="bar-val">{d.count}회</span>
                <span className="bar-label">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 부서별 통계 + 출결재적 대비 참여율 */}
      <section className="card">
        <div className="card-head">
          <h2>🏢 부서별 통계</h2>
          {!editRoster && (
            <button className="btn ghost sm" onClick={() => setEditRoster(true)}>✏️ 출결재적 입력</button>
          )}
        </div>
        {editRoster && (
          <RosterEditor
            month={rosterMonth}
            roster={roster}
            onSaved={(r) => {
              setRoster(r);
              setEditRoster(false);
            }}
            onClose={() => setEditRoster(false)}
          />
        )}
        <p className="muted">
          참여율 = 조회 기간에 1회 이상 인증한 인원 ÷ {Number(rosterMonth.slice(5))}월 출결재적
          {!Object.keys(monthRoster).length && ' (이 달 재적이 아직 입력되지 않았어요)'}
        </p>
        {deptRows.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>부서</th><th>참여 인원</th><th>인증</th><th>재적</th><th>참여율</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map((d) => (
                <tr key={d.department}>
                  <td>{d.department}</td>
                  <td>{d.memberCount}명</td>
                  <td>{d.count}회</td>
                  <td>{d.total ? `${d.total}명` : '-'}</td>
                  <td className="ratecell">
                    {d.rate == null ? (
                      <span className="muted">-</span>
                    ) : (
                      <div className="rate">
                        <div className="rate-track">
                          <div className="rate-fill" style={{ width: `${Math.min(100, d.rate)}%` }} />
                        </div>
                        <span>{d.rate}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 종목 선호도 */}
      <section className="card">
        <h2>🏷 종목별 통계</h2>
        <p className="muted">
          올린 종목 글자로 자동 분류했어요. 한 기록에 여러 운동이 적혀 있으면 각각 1번씩 셉니다.
          '기타'로 잡힌 건 인증 기록에서 종목을 고치면 반영돼요.
        </p>
        {cats.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <div className="hbars">
            {cats.map(([name, n]) => (
              <div className="hbar-row" key={name}>
                <span className="hbar-label">{name}</span>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(n / maxCat) * 100}%` }} />
                </div>
                <span className="hbar-val">
                  {n}회 · {Math.round((n / catTotal) * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
        {etcList.length > 0 && (
          <p className="muted small">기타로 분류된 종목: {etcList.map(([t, n]) => `${t}(${n})`).join(', ')}</p>
        )}
      </section>

      {/* 개인 랭킹 */}
      <section className="card">
        <h2>🏅 랭킹 ({boardByName ? '이름순' : '인증 횟수순'})</h2>
        {sortedBoard.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>이름</th><th>부서</th><th>인증</th><th>일수</th><th>종목</th>
              </tr>
            </thead>
            <tbody>
              {sortedBoard.map((u, i) => (
                <tr key={u.userId} className={!boardByName && i < 3 ? 'top' : ''}>
                  <td>{i + 1}</td>
                  <td className="cell-wrap">{u.name}</td>
                  <td>{u.department}</td>
                  <td><strong>{u.count}회</strong></td>
                  <td>{u.dayCount}일</td>
                  <td className="cell-wrap">{sportsText(u.sports, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
