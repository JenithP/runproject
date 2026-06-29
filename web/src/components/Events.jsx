import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Events() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      setList(await api.listEvents());
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.createEvent(form);
      setForm({ title: '', content: '' });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx];
    const b = list[j];
    // order 값 교환
    await Promise.all([
      api.updateEvent(a.id, { order: b.order }),
      api.updateEvent(b.id, { order: a.order }),
    ]);
    await load();
  }

  async function toggle(ev) {
    await api.updateEvent(ev.id, { active: !ev.active });
    await load();
  }

  async function remove(id) {
    if (!confirm('이 이벤트를 삭제할까요?')) return;
    await api.deleteEvent(id);
    await load();
  }

  async function broadcast() {
    if (!confirm('현재 최상단 활성 이벤트를 전체 사용자에게 지금 발송할까요?')) return;
    setMsg('');
    try {
      const r = await api.broadcast();
      setMsg(r.event ? `발송 완료: "${r.event.title}" (성공 ${r.sent}, 실패 ${r.failed})` : '활성 이벤트가 없습니다.');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="head-row">
          <h2>🎯 이벤트</h2>
          <button className="btn outline" onClick={broadcast}>지금 공지 발송</button>
        </div>
        <p className="muted">
          매주 월요일 09:00에 <strong>맨 위 활성 이벤트</strong>가 전체 사용자에게 자동 공지됩니다.
          위/아래 버튼으로 순서를 바꾸세요.
        </p>
        {msg && <div className="success">{msg}</div>}
        {err && <div className="error">{err}</div>}

        <form className="form" onSubmit={submit}>
          <label>
            이벤트 제목
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예) 이번주 5km 챌린지" />
          </label>
          <label>
            이벤트 내용
            <textarea rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="이벤트 설명" />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? '등록 중...' : '이벤트 추가 (맨 위로)'}</button>
        </form>
      </section>

      <section className="card">
        <h2>이벤트 목록 (위 = 다음 자동 공지)</h2>
        {list.length === 0 ? (
          <p className="muted">등록된 이벤트가 없습니다.</p>
        ) : (
          <div className="event-list">
            {list.map((ev, i) => (
              <div className={`event-row ${ev.active ? '' : 'inactive'}`} key={ev.id}>
                <div className="order-btns">
                  <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                  <button className="btn ghost sm" disabled={i === list.length - 1} onClick={() => move(i, 1)}>▼</button>
                </div>
                <div className="event-main">
                  <div className="event-title">
                    {i === 0 && ev.active && <span className="pin">📌 다음 공지</span>}
                    {ev.title}
                  </div>
                  <div className="event-content">{ev.content}</div>
                </div>
                <div className="event-actions">
                  <button className={`btn sm ${ev.active ? 'outline' : 'ghost'}`} onClick={() => toggle(ev)}>
                    {ev.active ? '활성' : '비활성'}
                  </button>
                  <button className="btn ghost sm" onClick={() => remove(ev.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
