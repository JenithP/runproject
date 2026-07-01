import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api.js';
import { todayStr, fmtDuration, DEPARTMENTS, GENDERS } from '../lib.js';

export default function Dashboard() {
  const [start, setStart] = useState(todayStr(-6));
  const [end, setEnd] = useState(todayStr(0));
  const [gender, setGender] = useState('');
  const [department, setDepartment] = useState('');
  const [sortBy, setSortBy] = useState('distance');

  const [board, setBoard] = useState([]);
  const [depts, setDepts] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const q = { start, end };
      const [b, d, day] = await Promise.all([
        api.leaderboard({ ...q, gender, department, sortBy }),
        api.departments(q),
        api.daily(q),
      ]);
      setBoard(b);
      setDepts(d);
      setDaily(day);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preset = (days) => {
    setStart(todayStr(-days + 1));
    setEnd(todayStr(0));
  };

  const [exporting, setExporting] = useState(false);
  async function downloadExcel() {
    setExporting(true);
    setErr('');
    try {
      const rows = await api.records({ start, end, gender, department });
      const data = rows.map((r) => ({
        날짜: r.date,
        이름: r.name,
        부서: r.department,
        성별: r.gender,
        종류: r.type,
        '거리(km)': r.distance,
        '시간(분)': r.durationMin,
        걸음수: r.steps,
        칼로리: r.calories,
        페이스: r.pace,
        인정여부: r.certified,
        사유: r.certReason,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '러닝기록');
      XLSX.writeFile(wb, `강동러닝_${start}_${end}.xlsx`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setExporting(false);
    }
  }

  const maxDaily = Math.max(1, ...daily.map((d) => d.distance));
  const maxDept = Math.max(1, ...depts.map((d) => d.distance));

  return (
    <div className="stack">
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
            성별
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">전체</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
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
              <option value="distance">거리순</option>
              <option value="time">시간순</option>
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

      {/* 일별 추이 */}
      <section className="card">
        <h2>📈 일별 추이</h2>
        {daily.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <div className="bars">
            {daily.map((d) => (
              <div className="bar-col" key={d.date} title={`${d.date} · ${d.distance}km · ${d.count}회`}>
                <div className="bar" style={{ height: `${(d.distance / maxDaily) * 100}%` }} />
                <span className="bar-val">{d.distance}</span>
                <span className="bar-label">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 부서별 통계 */}
      <section className="card">
        <h2>🏢 부서별 통계</h2>
        {depts.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>부서</th><th>인원</th><th>인증</th><th>거리(km)</th><th>시간</th><th></th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.department}>
                  <td>{d.department}</td>
                  <td>{d.memberCount}</td>
                  <td>{d.count}</td>
                  <td>{d.distance}</td>
                  <td>{fmtDuration(d.durationSec)}</td>
                  <td className="barcell">
                    <div className="minibar" style={{ width: `${(d.distance / maxDept) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 개인 랭킹 */}
      <section className="card">
        <h2>🏅 랭킹 ({sortBy === 'distance' ? '거리순' : sortBy === 'time' ? '시간순' : '횟수순'})</h2>
        {board.length === 0 ? (
          <p className="muted">데이터가 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>이름</th><th>부서</th><th>성별</th>
                <th>인증</th><th>거리(km)</th><th>시간</th><th>칼로리</th>
              </tr>
            </thead>
            <tbody>
              {board.map((u, i) => (
                <tr key={u.userId} className={i < 3 ? 'top' : ''}>
                  <td>{i + 1}</td>
                  <td>{u.name}</td>
                  <td>{u.department}</td>
                  <td>{u.gender}</td>
                  <td>{u.count}</td>
                  <td><strong>{u.distance}</strong></td>
                  <td>{fmtDuration(u.durationSec)}</td>
                  <td>{Math.round(u.calories)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
