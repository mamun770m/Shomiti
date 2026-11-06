import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.SNAPSHOT_SOURCE_URL || 'http://localhost:3000';
const HEADERS = {
  'x-society-role': 'SUPER_ADMIN',
  'x-society-member-id': '09',
};

async function fetchJson(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${res.status}`);
  }
  return res.json();
}

async function generateSnapshot() {
  console.log('Generating static database snapshot for Netlify / Static Hosting...');
  const [
    bootstrap,
    societyHome,
    dashboardAll,
    membersRes,
    downPayments,
    incomeExpense,
    loansInvestments,
    receiptsRes,
    ledger,
    auditSecurity,
    appUsers,
    quickAccounts,
    smartFeatures2026,
    backupFull,
  ] = await Promise.all([
    fetchJson('/api/bootstrap'),
    fetchJson('/api/society-home'),
    fetchJson('/api/dashboard?year=0&memberId=ALL'),
    fetchJson('/api/members'),
    fetchJson('/api/down-payments'),
    fetchJson('/api/income-expense'),
    fetchJson('/api/loans-investments'),
    fetchJson('/api/receipts'),
    fetchJson('/api/ledger'),
    fetchJson('/api/audit-security'),
    fetchJson('/api/app-users'),
    fetchJson('/api/auth/quick-accounts'),
    fetchJson('/api/smart-features?year=2026'),
    fetchJson('/api/backup/full'),
  ]);

  // De-duplicate member photos in secondary arrays to keep JSON compact;
  // netlifyStaticEngine re-hydrates them from `members` by `memberId`.
  const stripPhotos = (arr) =>
    Array.isArray(arr)
      ? arr.map((item) => ({
          ...item,
          photoUrl: item.memberId ? `__MEMBER_PHOTO_${item.memberId}__` : item.photoUrl,
          nomineePhotoUrl: item.memberId
            ? `__NOMINEE_PHOTO_${item.memberId}__`
            : item.nomineePhotoUrl,
        }))
      : arr;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    version: '2026.11.06',
    societyHome,
    dashboardAll,
    members: membersRes.members || [],
    downPayments,
    incomeExpense,
    loansInvestments,
    receipts: receiptsRes.receipts || [],
    ledger,
    auditSecurity: {
      ...auditSecurity,
      profiles: stripPhotos(auditSecurity.profiles),
    },
    appUsers: {
      ...appUsers,
      users: stripPhotos(appUsers.users),
    },
    quickAccounts,
    smartFeatures: {
      ...smartFeatures2026,
      heatmap: Array.isArray(smartFeatures2026.heatmap)
        ? smartFeatures2026.heatmap.map((h) => ({
            ...h,
            photoUrl: h.memberId ? `__MEMBER_PHOTO_${h.memberId}__` : h.photoUrl,
          }))
        : [],
    },
    bootstrap: {
      ...bootstrap,
      members: stripPhotos(bootstrap.members),
      allMembersList: stripPhotos(bootstrap.allMembersList),
    },
    rawTables: {
      monthlyObligations: backupFull?.data?.monthlyObligations || [],
      annualAccountSummaries: backupFull?.data?.annualAccountSummaries || [],
      paymentTransactions: backupFull?.data?.paymentTransactions || [],
    },
  };

  const outDir = path.resolve(__dirname, '../public/api-snapshot');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'society-db.json');
  const jsonString = JSON.stringify(snapshot);
  fs.writeFileSync(outFile, jsonString, 'utf8');
  console.log(
    `Successfully wrote ${outFile} (${(jsonString.length / 1024).toFixed(1)} KB)`
  );
}

generateSnapshot().catch((err) => {
  console.warn('Skipping snapshot regeneration (server not reachable):', err.message);
  process.exit(0);
});
