import 'dotenv/config';
import { createBot } from './bot/index.js';
import { createWebApp } from './web/server.js';
import { setupScheduler } from './bot/announce.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const WEBHOOK_PATH = '/telegram-webhook';

async function main() {
  const bot = createBot();
  const app = createWebApp(bot);

  if (PUBLIC_URL) {
    // ── Webhook 모드 (Render 등 배포 환경) ──
    app.use(await bot.createWebhook({ domain: PUBLIC_URL, path: WEBHOOK_PATH }));
    app.listen(PORT, () => {
      console.log(`🌐 웹/웹훅 서버 실행: ${PORT}`);
      console.log(`🤖 텔레그램 webhook: ${PUBLIC_URL}${WEBHOOK_PATH}`);
    });
  } else {
    // ── Polling 모드 (로컬 개발) ──
    app.listen(PORT, () => console.log(`🌐 웹 서버 실행: http://localhost:${PORT}`));
    await bot.launch();
    console.log('🤖 텔레그램 봇 실행 (polling 모드)');
  }

  setupScheduler(bot);

  // graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('💥 시작 실패:', err);
  process.exit(1);
});
