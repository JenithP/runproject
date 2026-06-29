import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

const SYSTEM = `너는 러닝 앱(나이키 런 클럽, 스트라바, 삼성헬스, 애플 피트니스, 가민 등) 스크린샷에서
운동 기록 수치를 정확히 읽어내는 OCR 추출기다. 반드시 아래 JSON 스키마 하나만 출력한다.
설명, 마크다운, 코드펜스 없이 순수 JSON만 출력한다.

{
  "distance_km": number|null,      // 거리(km). 마일(mi)이면 km로 환산(1mi=1.60934km).
  "duration_seconds": number|null, // 총 운동 시간(초). "32:15"=1935, "1:02:33"=3753.
  "date": "YYYY-MM-DD"|null,       // 스크린샷에 보이는 운동 날짜. 없으면 null.
  "calories": number|null,         // 소모 칼로리(kcal).
  "pace": string|null,             // 평균 페이스 표시값 그대로 (예: "5'42\"/km").
  "app": string|null,              // 추정 앱 이름.
  "confidence": "high"|"medium"|"low" // 수치 판독 신뢰도.
}

규칙:
- 화면에 명확히 보이는 값만 채운다. 추측 금지. 안 보이면 null.
- 큰 글씨로 강조된 메인 거리 숫자를 distance_km로 본다.
- 시간은 시:분:초 또는 분:초 형태를 초로 변환.
- 러닝 기록 화면이 아니거나 수치를 못 읽으면 모든 값 null, confidence "low".`;

/**
 * 이미지 버퍼에서 러닝 기록 추출.
 * @param {Buffer} buffer
 * @param {string} mediaType  e.g. 'image/jpeg'
 * @returns 추출 객체 (위 스키마)
 */
export async function extractRunningData(buffer, mediaType = 'image/jpeg') {
  const base64 = buffer.toString('base64');
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: '이 러닝 기록 스크린샷에서 수치를 추출해 JSON으로만 답해줘.' },
        ],
      },
    ],
  });

  const text = res.content?.map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
  return parseJson(text);
}

function parseJson(text) {
  if (!text) return emptyResult();
  // 코드펜스/잡텍스트 제거 후 첫 JSON 블록 추출
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return emptyResult();
  try {
    const obj = JSON.parse(match[0]);
    return {
      distance_km: numOrNull(obj.distance_km),
      duration_seconds: numOrNull(obj.duration_seconds),
      date: obj.date || null,
      calories: numOrNull(obj.calories),
      pace: obj.pace || null,
      app: obj.app || null,
      confidence: obj.confidence || 'low',
    };
  } catch {
    return emptyResult();
  }
}

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const emptyResult = () => ({
  distance_km: null,
  duration_seconds: null,
  date: null,
  calories: null,
  pace: null,
  app: null,
  confidence: 'low',
});
