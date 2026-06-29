const PW_KEY = 'admin_pw';

export const getPw = () => localStorage.getItem(PW_KEY) || '';
export const setPw = (pw) => localStorage.setItem(PW_KEY, pw);
export const clearPw = () => localStorage.removeItem(PW_KEY);

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': getPw(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearPw();
    throw new Error('인증이 만료되었습니다. 다시 로그인하세요.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export const api = {
  login: (password) => req('POST', '/api/login', { password }),

  leaderboard: (q) => req('GET', `/api/stats/leaderboard?${new URLSearchParams(clean(q))}`),
  departments: (q) => req('GET', `/api/stats/departments?${new URLSearchParams(clean(q))}`),
  daily: (q) => req('GET', `/api/stats/daily?${new URLSearchParams(clean(q))}`),

  listEvents: () => req('GET', '/api/events'),
  createEvent: (b) => req('POST', '/api/events', b),
  updateEvent: (id, b) => req('PATCH', `/api/events/${id}`, b),
  deleteEvent: (id) => req('DELETE', `/api/events/${id}`),
  broadcast: () => req('POST', '/api/events/broadcast'),

  listAnnouncements: () => req('GET', '/api/announcements'),
  createAnnouncement: (b) => req('POST', '/api/announcements', b),
  deleteAnnouncement: (id) => req('DELETE', `/api/announcements/${id}`),

  getConfig: () => req('GET', '/api/config'),
  saveConfig: (b) => req('PUT', '/api/config', b),
};

function clean(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}
