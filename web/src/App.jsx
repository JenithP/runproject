import { useState } from 'react';
import { api, getPw, setPw, clearPw } from './api.js';
import Dashboard from './components/Dashboard.jsx';
import Events from './components/Events.jsx';
import Announcements from './components/Announcements.jsx';
import Settings from './components/Settings.jsx';

const TABS = [
  { id: 'dashboard', label: '📊 통계 대시보드' },
  { id: 'announcements', label: '📢 공지' },
  { id: 'events', label: '🎯 이벤트' },
  { id: 'settings', label: '⚙️ 등급 설정' },
];

export default function App() {
  const [authed, setAuthed] = useState(!!getPw());
  const [tab, setTab] = useState('dashboard');

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🏃 강동 러닝프로젝트 <span>관리자</span></div>
        <button
          className="btn ghost"
          onClick={() => {
            clearPw();
            setAuthed(false);
          }}
        >
          로그아웃
        </button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'announcements' && <Announcements />}
        {tab === 'events' && <Events />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [pw, setPwInput] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      setPw(pw);
      await api.login(pw);
      onLogin();
    } catch (e) {
      clearPw();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>🏃 강동 러닝프로젝트</h1>
        <p className="muted">관리자 로그인</p>
        <input
          type="password"
          placeholder="관리자 비밀번호"
          value={pw}
          onChange={(e) => setPwInput(e.target.value)}
          autoFocus
        />
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? '확인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
