import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { todayStr } from '../lib.js';

export default function Announcements() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', startDate: todayStr(), endDate: todayStr(7) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setList(await api.listAnnouncements());
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
      await api.createAnnouncement(form);
      setForm({ title: '', content: '', startDate: todayStr(), endDate: todayStr(7) });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('이 공지를 삭제할까요?')) return;
    await api.deleteAnnouncement(id);
    await load();
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>📢 새 공지 등록</h2>
        <form className="form" onSubmit={submit}>
          <label>
            공지 제목
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예) 7월 단체 러닝 안내"
            />
          </label>
          <label>
            공지 내용
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="공지 내용을 입력하세요"
            />
          </label>
          <div className="row">
            <label>
              시작일
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>
            <label>
              종료일
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </label>
          </div>
          {err && <div className="error">{err}</div>}
          <button className="btn primary" disabled={busy}>{busy ? '등록 중...' : '공지 등록'}</button>
        </form>
      </section>

      <section className="card">
        <h2>등록된 공지</h2>
        {list.length === 0 ? (
          <p className="muted">등록된 공지가 없습니다.</p>
        ) : (
          <div className="card-grid">
            {list.map((a) => (
              <div className="notice-card" key={a.id}>
                <div className="notice-head">
                  <h3>{a.title}</h3>
                  <button className="btn ghost sm" onClick={() => remove(a.id)}>삭제</button>
                </div>
                <p className="notice-body">{a.content}</p>
                {(a.startDate || a.endDate) && (
                  <div className="notice-period">🗓 {a.startDate} ~ {a.endDate}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
