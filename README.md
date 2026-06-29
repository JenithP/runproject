# 🏃 강동 러닝프로젝트

텔레그램 러닝 인증 챗봇 + 웹 관리자 대시보드.
러닝 앱 스크린샷을 보내면 **Google Gemini Vision(무료) OCR**이 거리·시간·날짜·칼로리를 자동 인식해
Firestore에 누적 기록하고, 배지·등급·랭킹을 관리합니다.

## 주요 기능

### 텔레그램 봇
- **회원가입**: 이름 → 부서(자문회/장년회/여청년/남청년/부녀회/중진교역) → 몇부 몇팀 몇구역 → 성별
- **러닝 인증**: `🏃 러닝 기록하기` → 스크린샷 전송 → OCR 자동 인식 → 기록 저장
- **내 기록**: `/내기록` — 누적 인증·거리·시간·칼로리, 이번주 횟수, 다음 등급까지, 부서/전체 순위
- **배지**: 첫 인증 · 첫 5km · 7일 연속 · 30회 인증 · 100km 달성 · PB 갱신 · 완주자
- **자동 공지**: 매주 월요일 09:00, 웹에서 등록한 최상단 이벤트를 전체 발송

### 웹 관리자 (`/`)
- **통계 대시보드**: 기간 선택 → 일별 추이, 부서별 통계, 개인 랭킹(거리/시간/횟수순), 성별·부서 필터
- **공지 관리**: 제목·내용·기간 카드형 등록
- **이벤트 관리**: 순서 변경(맨 위 = 다음 자동 공지), 활성/비활성, 즉시 발송
- **등급 설정**: 등급 임계값(브론즈/실버/골드/플래티넘 등), 주간 목표 횟수

## 기술 스택
- 백엔드: Node.js (ESM), Telegraf, Express, Firebase Admin(Firestore), node-cron
- OCR: Google Gemini Vision — 무료 (`@google/genai`)
- 프론트엔드: React + Vite

## 로컬 실행

```bash
# 1) 환경변수 준비
cp .env.example .env       # 값 채우기 (토큰/키/비밀번호)

# 2) 의존성 설치 (백엔드 + 웹)
npm install

# 3) 웹 관리자 빌드 (또는 개발 중엔 npm run dev:web 따로)
npm run build:web

# 4) 서버 실행 (봇 polling + 웹 + 스케줄러)
npm run dev
```

- 웹 관리자: http://localhost:3000
- 개발 중 프론트 핫리로드: 별도 터미널에서 `npm run dev:web` (http://localhost:5173, /api 프록시됨)

## 환경변수
| 변수 | 설명 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather 토큰 |
| `GEMINI_API_KEY` | Google Gemini API 키 (무료, aistudio.google.com/apikey) |
| `GEMINI_MODEL` | 비전 모델 (기본 `gemini-2.5-flash`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | 서비스 계정 JSON 경로(로컬) |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | 서비스 계정 JSON을 base64로(배포) |
| `ADMIN_PASSWORD` | 웹 관리자 비밀번호 |
| `PUBLIC_URL` | 배포 공개 URL(설정 시 webhook 모드) |
| `PORT` / `TZ` | 포트 / 시간대(`Asia/Seoul`) |

## Netlify 배포 (무료·카드 불필요)

구조: **정적 React 관리자**(`web/dist`) + **함수 2개**
- `netlify/functions/api.js` — 관리자 REST API + 텔레그램 webhook (Express를 `serverless-http`로 래핑)
- `netlify/functions/announce-scheduled.js` — 매주 월요일 자동 공지 (Netlify Scheduled Function, `0 0 * * 1` UTC = 월 09:00 KST)

라우팅은 `netlify.toml`이 처리: `/api/*` 와 `/telegram-webhook` → api 함수, 그 외 → SPA.

### 배포 절차
1. 저장소를 GitHub에 푸시 (`new-membership-*.json`, `.env` 는 `.gitignore`로 제외 — **절대 커밋 금지**)
2. Netlify → **Add new site → Import an existing project** → 이 리포 연결 (`netlify.toml` 자동 인식)
3. **Site configuration → Environment variables** 에 입력:
   - `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `ADMIN_PASSWORD`
   - `FIREBASE_SERVICE_ACCOUNT_BASE64` — `firebase-base64.txt` 내용 통째로 붙여넣기
     (또는 PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("new-membership-e4a2c-firebase-adminsdk-fbsvc-6911fa7682.json"))`)
   - `TZ` = `Asia/Seoul`
4. 배포 완료 후, 사이트 주소(예: `https://kdrunners.netlify.app`)를 `.env` 의 `PUBLIC_URL` 에 넣고 **한 번만** webhook 등록:
   ```bash
   npm run set-webhook          # 등록
   npm run set-webhook delete   # 해제(필요시)
   ```
5. 텔레그램에서 봇에게 `/start` → 동작 확인. 관리자 웹은 사이트 주소 그대로 접속.

> 로컬 테스트는 `.env` 의 `PUBLIC_URL` 을 **비워두고** `npm run dev` (polling 모드).

### (대안) Render 배포
`render.yaml` 도 포함돼 있어 Render Web Service로도 배포 가능. 단 무료 플랜은 15분 미사용 시 인스턴스가 잠들어 첫 응답이 느리고, 인스턴스가 자는 동안 월요일 자동 공지(node-cron)가 누락될 수 있음.

## Firestore 데이터 모델
- `users/{telegramId}` — 프로필 + `totals`(누적 통계·배지)
- `records/{id}` — 개별 러닝 기록(거리·시간·날짜·칼로리, 부서/성별 비정규화)
- `events/{id}` — 이벤트(자동 공지 대상, `order`로 정렬)
- `announcements/{id}` — 공지(제목·내용·기간)
- `config/settings` — 등급·주간목표 설정
