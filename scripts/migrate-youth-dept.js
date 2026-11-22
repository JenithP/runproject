// 여청년/남청년 → 청년회 통합 마이그레이션 (users + records). 여러 번 실행해도 안전.
// 사용: node scripts/migrate-youth-dept.js          (미리보기)
//       node scripts/migrate-youth-dept.js --apply  (실제 반영)
import 'dotenv/config';

process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  './new-membership-e4a2c-firebase-adminsdk-fbsvc-6911fa7682.json';

const { db } = await import('../src/config/firebase.js');
const { LEGACY_DEPARTMENTS } = await import('../src/config/constants.js');

const apply = process.argv.includes('--apply');
const legacy = Object.keys(LEGACY_DEPARTMENTS);

let total = 0;
for (const colName of ['users', 'records']) {
  const snap = await db.collection(colName).where('department', 'in', legacy).get();
  const byDept = {};
  for (const d of snap.docs) byDept[d.data().department] = (byDept[d.data().department] || 0) + 1;
  console.log(`${colName}: ${snap.size}건`, byDept);
  total += snap.size;
  if (!apply) continue;
  // Firestore batch 최대 500건
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) {
      batch.update(d.ref, {
        department: LEGACY_DEPARTMENTS[d.data().department],
        legacyDepartment: d.data().department,
      });
    }
    await batch.commit();
  }
}
console.log(apply ? `✅ ${total}건 청년회로 변경 완료` : `미리보기 끝 (${total}건). 반영하려면 --apply`);
process.exit(0);
