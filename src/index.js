import 'dotenv/config';
import { createBot } from './bot/index.js';
import { createWebApp, WEBHOOK_PATH } from './web/server.js';
import { setupScheduler } from './bot/announce.js';

// 로컬 개발 / 단일 서버(예: Render) 진입점.
// Netlify 배포는 이 파일이 아니라 netlify/functions/* 를 사용합니다.

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

async function main() {
  const bot = createBot();
  const app = createWebApp(bot); // /api + webhook 콜백 + 정적 서빙 포함

  app.listen(PORT, () => console.log(`🌐 웹 서버 실행: http://localhost:${PORT}`));

  if (PUBLIC_URL) {
    // webhook 모드: 텔레그램이 PUBLIC_URL 로 업데이트를 보냄
    await bot.telegram.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
    console.log(`🤖 webhook 등록: ${PUBLIC_URL}${WEBHOOK_PATH}`);
  } else {
    // polling 모드 (로컬 테스트 기본값)
    await bot.telegram.deleteWebhook().catch(() => {});
    await bot.launch();
    console.log('🤖 텔레그램 봇 실행 (polling 모드)');
  }

  setupScheduler(bot);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('💥 시작 실패:', err);
  process.exit(1);
});
