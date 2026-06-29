// 배포 후 1회 실행: 텔레그램 webhook 을 Netlify 주소로 등록.
// 사용: PUBLIC_URL 과 TELEGRAM_BOT_TOKEN 을 .env 에 넣고  `npm run set-webhook`
import 'dotenv/config';
import { Telegraf } from 'telegraf';

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN 이 없습니다 (.env 확인).');
  process.exit(1);
}
if (!url) {
  console.error('PUBLIC_URL 이 없습니다. 예: https://kdrunners.netlify.app');
  process.exit(1);
}

const webhookUrl = `${url}/telegram-webhook`;
const bot = new Telegraf(token);

const action = process.argv[2];

try {
  if (action === 'delete') {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('🗑️  webhook 삭제 완료');
  } else {
    await bot.telegram.setWebhook(webhookUrl);
    const info = await bot.telegram.getWebhookInfo();
    console.log('✅ webhook 등록 완료:', webhookUrl);
    console.log('   상태:', JSON.stringify(info, null, 2));
  }
} catch (err) {
  console.error('❌ 실패:', err.message);
  process.exit(1);
}
