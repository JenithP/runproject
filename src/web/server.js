import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { rangeLeaderboard, departmentStats, dailySeries } from '../services/stats.js';
import { getSettings, saveSettings } from '../services/config.js';
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../services/events.js';
import { broadcastTopEvent } from '../bot/announce.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, '../../web/dist');

/** 간단 비밀번호 인증 미들웨어 */
function adminAuth(req, res, next) {
  const pw = req.get('x-admin-password') || req.query.pw;
  if (!process.env.ADMIN_PASSWORD) return next(); // 미설정시 통과(개발 편의)
  if (pw === process.env.ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: '인증 실패' });
}

const asyncH = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error('[api]', e);
    res.status(500).json({ error: e.message });
  });

export function createWebApp(bot) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const api = express.Router();

  // ── 인증 ──
  api.post('/login', (req, res) => {
    const { password } = req.body || {};
    if (!process.env.ADMIN_PASSWORD || password === process.env.ADMIN_PASSWORD) {
      return res.json({ ok: true });
    }
    res.status(401).json({ ok: false, error: '비밀번호가 올바르지 않습니다.' });
  });

  api.use(adminAuth);

  // ── 통계 ──
  api.get(
    '/stats/leaderboard',
    asyncH(async (req, res) => {
      const { start, end, gender, department, sortBy } = req.query;
      res.json(await rangeLeaderboard({ start, end, gender, department, sortBy }));
    })
  );
  api.get(
    '/stats/departments',
    asyncH(async (req, res) => {
      const { start, end } = req.query;
      res.json(await departmentStats({ start, end }));
    })
  );
  api.get(
    '/stats/daily',
    asyncH(async (req, res) => {
      const { start, end } = req.query;
      res.json(await dailySeries({ start, end }));
    })
  );

  // ── 이벤트 ──
  api.get('/events', asyncH(async (_req, res) => res.json(await listEvents())));
  api.post(
    '/events',
    asyncH(async (req, res) => res.json(await createEvent(req.body)))
  );
  api.patch(
    '/events/:id',
    asyncH(async (req, res) => {
      await updateEvent(req.params.id, req.body);
      res.json({ ok: true });
    })
  );
  api.delete(
    '/events/:id',
    asyncH(async (req, res) => {
      await deleteEvent(req.params.id);
      res.json({ ok: true });
    })
  );
  // 수동 공지 발송
  api.post(
    '/events/broadcast',
    asyncH(async (_req, res) => {
      if (!bot) return res.status(503).json({ error: '봇이 실행 중이 아닙니다.' });
      res.json(await broadcastTopEvent(bot));
    })
  );

  // ── 공지 ──
  api.get('/announcements', asyncH(async (_req, res) => res.json(await listAnnouncements())));
  api.post(
    '/announcements',
    asyncH(async (req, res) => res.json(await createAnnouncement(req.body)))
  );
  api.delete(
    '/announcements/:id',
    asyncH(async (req, res) => {
      await deleteAnnouncement(req.params.id);
      res.json({ ok: true });
    })
  );

  // ── 설정(등급/주간목표) ──
  api.get('/config', asyncH(async (_req, res) => res.json(await getSettings())));
  api.put(
    '/config',
    asyncH(async (req, res) => res.json(await saveSettings(req.body)))
  );

  app.use('/api', api);
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // ── 프론트엔드(빌드 결과) 정적 서빙 + SPA fallback ──
  if (fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(WEB_DIST, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) =>
      res.send('웹 관리자 빌드가 없습니다. `npm run build:web` 후 다시 시작하세요.')
    );
  }

  return app;
}
