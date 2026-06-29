# 🏃 강동 러닝프로젝트

텔레그램 러닝 인증 챗봇 + 웹 관리자 대시보드.
러닝 앱 스크린샷을 보내면 **Claude Vision OCR**이 거리·시간·날짜·칼로리를 자동 인식해
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
- OCR: Claude Vision (`@anthropic-ai/sdk`)
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
| `ANTHROPIC_API_KEY` | Claude Vision API 키 |
| `ANTHROPIC_MODEL` | 비전 모델 (기본 `claude-opus-4-8`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | 서비스 계정 JSON 경로(로컬) |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | 서비스 계정 JSON을 base64로(배포) |
| `ADMIN_PASSWORD` | 웹 관리자 비밀번호 |
| `PUBLIC_URL` | 배포 공개 URL(설정 시 webhook 모드) |
| `PORT` / `TZ` | 포트 / 시간대(`Asia/Seoul`) |

## Render 배포
1. 이 저장소를 GitHub에 푸시 (`new-membership-*.json`은 `.gitignore`로 제외됨 — **절대 커밋 금지**)
2. Render에서 **New Web Service** → 이 리포 연결 (`render.yaml` 자동 인식)
3. 환경변수 입력:
   - `TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`
   - `FIREBASE_SERVICE_ACCOUNT_BASE64` — 서비스 계정 JSON을 base64로 변환해 입력
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("new-membership-e4a2c-firebase-adminsdk-fbsvc-6911fa7682.json"))
     ```
   - `PUBLIC_URL` — Render가 발급한 주소(예: `https://gangdong-running.onrender.com`)
4. 배포 후 `PUBLIC_URL`이 설정되면 자동으로 텔레그램 **webhook 모드**로 동작

## Firestore 데이터 모델
- `users/{telegramId}` — 프로필 + `totals`(누적 통계·배지)
- `records/{id}` — 개별 러닝 기록(거리·시간·날짜·칼로리, 부서/성별 비정규화)
- `events/{id}` — 이벤트(자동 공지 대상, `order`로 정렬)
- `announcements/{id}` — 공지(제목·내용·기간)
- `config/settings` — 등급·주간목표 설정
