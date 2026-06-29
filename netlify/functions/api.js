// Netlify Function: 텔레그램 webhook + 관리자 REST API 를 한 함수로 처리.
// netlify.toml 의 redirect 로 /api/* 와 /telegram-webhook 가 이 함수로 들어온다.
import serverless from 'serverless-http';
import express from 'express';
import { createBot } from '../../src/bot/index.js';
import { createWebApp } from '../../src/web/server.js';

// 콜드스타트당 1회 생성 (모듈 스코프 → 동일 인스턴스 재사용)
const bot = createBot();
const appCore = createWebApp(bot); // /api + webhook 콜백 포함

// Netlify는 event.path 를 "/.netlify/functions/api/..." 로 전달한다.
// Express 라우트(/api/..., /telegram-webhook)에 맞게 접두어 제거.
const wrapper = express();
wrapper.use((req, _res, next) => {
  req.url = req.url.replace(/^\/\.netlify\/functions\/api/, '') || '/';
  next();
});
wrapper.use(appCore);

const sl = serverless(wrapper);
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return sl(event, context);
};
