import admin from 'firebase-admin';
import fs from 'fs';
import 'dotenv/config';

/**
 * Firebase Admin 초기화.
 * 우선순위:
 *  1) FIREBASE_SERVICE_ACCOUNT_BASE64  (배포 환경 권장 — 파일 없이 환경변수로)
 *  2) GOOGLE_APPLICATION_CREDENTIALS    (로컬 개발 — JSON 파일 경로)
 */
function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  throw new Error(
    'Firebase 서비스 계정을 찾을 수 없습니다. ' +
      'FIREBASE_SERVICE_ACCOUNT_BASE64 또는 GOOGLE_APPLICATION_CREDENTIALS 를 설정하세요.'
  );
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export { admin };
