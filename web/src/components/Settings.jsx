import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings() {
  const [tiers, setTiers] = useState([]);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    try {
      const c = await api.getConfig();
      setTiers(c.tiers || []);
      setWeeklyGoal(c.weeklyGoal ?? 3);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function updateTier(i, key, val) {
    const next = [...tiers];
    next[i] = { ...next[i], [key]: key === 'minCount' ? Number(val) : val };
    setTiers(next);
  }
  function addTier() {
    setTiers([...tiers, { id: `tier${tiers.length + 1}`, name: '새 등급', emoji: '🎖', minCount: 0 }]);
  }
  function removeTier(i) {
    setTiers(tiers.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const sorted = [...tiers].sort((a, b) => a.minCount - b.minCount);
      await api.saveConfig({ tiers: sorted, weeklyGoal: Number(weeklyGoal) });
      setTiers(sorted);
      setMsg('저장되었습니다.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>⚙️ 등급 설정</h2>
        <p className="muted">누적 인증 횟수 기준으로 등급이 결정됩니다. (예: 골드 40회)</p>
        <table className="table">
          <thead>
            <tr><th>이모지</th><th>등급명</th><th>최소 인증 횟수</th><th></th></tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i}>
                <td><input className="w60" value={t.emoji || ''} onChange={(e) => updateTier(i, 'emoji', e.target.value)} /></td>
                <td><input value={t.name || ''} onChange={(e) => updateTier(i, 'name', e.target.value)} /></td>
                <td><input type="number" className="w100" value={t.minCount ?? 0} onChange={(e) => updateTier(i, 'minCount', e.target.value)} /></td>
                <td><button className="btn ghost sm" onClick={() => removeTier(i)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn outline" onClick={addTier}>+ 등급 추가</button>
      </section>

      <section className="card">
        <h2>🎯 주간 목표</h2>
        <label className="inline">
          이번주 목표 인증 횟수
          <input type="number" className="w100" value={weeklyGoal} onChange={(e) => setWeeklyGoal(e.target.value)} />
        </label>
      </section>

      <section className="card">
        {msg && <div className="success">{msg}</div>}
        {err && <div className="error">{err}</div>}
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? '저장 중...' : '설정 저장'}</button>
      </section>
    </div>
  );
}
