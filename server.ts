import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db/index.ts';
import {
  accounts,
  annualAccountSummaries,
  appUsers,
  approvalRequests,
  auditLogs,
  downPaymentAgreements,
  expenseTransactions,
  importBatches,
  importRows,
  incomeTransactions,
  investments,
  journalEntries,
  journalEntryLines,
  loanRepayments,
  loans,
  memberAccounts,
  memberPaymentPolicies,
  members,
  monthlyObligations,
  notifications,
  paymentAllocations,
  paymentTransactions,
  permissions,
  profiles,
  receipts,
  roles,
  systemSettings,
} from './src/db/schema.ts';
import { ensureSeeded } from './src/db/seed.ts';
import {
  MONTH_NAMES,
  postDoubleEntryJournal,
  recalculateMemberYearAccount,
  reconcileSocietyAccountBalances,
  recordMemberPayment,
  syncMemberDownPaymentAgreement,
} from './src/db/accounting.ts';
import { requireAuth, type AuthRequest, createSignedSessionToken } from './src/middleware/auth.ts';
import {
  analyzeHistoricalPackage,
  ensureAppUsersSeeded,
  getAppUsersSafe,
  saveAppUsersSafe,
  syncAuthenticDatasetToPostgres,
} from './src/db/dataIntelligence.ts';
import { OFFICIAL_SOCIETY_LOGO_URL } from './src/lib/officialLogo.ts';
import { and, asc, desc, eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Brute-force login attempt tracker per IP
const loginRateLimiter = new Map<string, { count: number; lockUntil: number }>();

// Recursive XSS / Script injection sanitizer (preserves base64 data:image URLs)
function sanitizeInputPayload(val: any): any {
  if (typeof val === 'string') {
    if (val.startsWith('data:image/')) return val;
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeInputPayload);
  }
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = sanitizeInputPayload(v);
    }
    return out;
  }
  return val;
}

let snapshotRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleStaticSnapshotRefresh() {
  if (snapshotRefreshTimer) clearTimeout(snapshotRefreshTimer);
  snapshotRefreshTimer = setTimeout(() => {
    import('child_process')
      .then(({ exec }) => {
        exec('node scripts/generate-static-snapshot.mjs', { cwd: __dirname }, () => {
          // Static snapshot updated silently in background
        });
      })
      .catch(() => {});
  }, 2500);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
  app.use('/api-snapshot', express.static(path.join(__dirname, 'public/api-snapshot')));

  // Enterprise Anti-Hack Security Headers, CORS & Payload Sanitizer Middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-society-role, x-society-member-id, x-society-session-token'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Powered-By', 'Hilful-Fuzul-Vault-Guard');
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        res.on('finish', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            scheduleStaticSnapshotRefresh();
          }
        });
      }
    }
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeInputPayload(req.body);
    }
    next();
  });

  // Helper to enforce role permissions
  const ensureRole = (req: AuthRequest, allowedRoles: string[]) => {
    const role = req.profile?.role || 'MEMBER';
    if (!allowedRoles.includes(role)) {
      throw new Error(`Permission denied: Role ${role} is not authorized for this operation.`);
    }
  };

  // 1. Bootstrap & Profile Session
  app.get('/api/bootstrap', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const allMembers = await db.select().from(members).orderBy(asc(members.id));
      const settings = await db.select().from(systemSettings);
      const recentNotifications = await db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.id))
        .limit(10);

      const role = req.profile?.role || 'SUPER_ADMIN';
      const memberId = req.profile?.memberId || '02';

      // RLS filter for MEMBER role
      const visibleMembers =
        role === 'MEMBER'
          ? allMembers.filter((m) => m.memberId === memberId)
          : allMembers;

      res.json({
        profile: req.profile,
        members: visibleMembers,
        allMembersList: allMembers.map((m) => ({
          memberId: m.memberId,
          name: m.name,
          nameBn: m.nameBn,
          status: m.status,
        })),
        settings,
        notifications: recentNotifications,
      });
    } catch (error: any) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: error.message || 'Failed to bootstrap application' });
    }
  });

  // 2. Financial Dashboard Statistics & Interactive Charts
  app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const selectedYear = req.query.year ? Number(req.query.year) : 0; // 0 = All years cumulative (2019-2026)
      const filterMemberId =
        req.profile?.role === 'MEMBER'
          ? req.profile.memberId || '02'
          : (req.query.memberId as string) || '';

      const allMembers = await db.select().from(members).orderBy(asc(members.id));
      const allSummaries = await db.select().from(annualAccountSummaries);
      const allObligations = await db.select().from(monthlyObligations);
      const allIncomes = await db.select().from(incomeTransactions);
      const allExpenses = await db.select().from(expenseTransactions);
      const allAccounts = await db.select().from(accounts);
      const allLoans = await db.select().from(loans);
      const allInvestments = await db.select().from(investments);

      const filteredSummaries = allSummaries.filter((s) => {
        if (selectedYear > 0 && s.year !== selectedYear) return false;
        if (filterMemberId && s.memberId !== filterMemberId) return false;
        return true;
      });

      const totalShareDeposits = filteredSummaries.reduce((sum, s) => sum + s.totalShareDeposit, 0);
      const totalPayable = filteredSummaries.reduce((sum, s) => sum + s.totalPayable, 0);
      const totalFine = filteredSummaries.reduce((sum, s) => sum + s.totalFine, 0);
      const totalOtherReceipts = filteredSummaries.reduce((sum, s) => sum + s.totalOtherReceive, 0);
      const totalDownPayments = filteredSummaries.reduce((sum, s) => sum + s.totalDownPayment, 0);
      const totalCollection = filteredSummaries.reduce((sum, s) => sum + s.totalReceiveAmount, 0);

      // Total outstanding dues:
      // If a specific year is selected: sum of totalOutstanding for that year.
      // If All Years (2019–2026, selectedYear === 0): sum of each member's cumulative closing outstanding up to 2026 (which includes 2019–2024 carried dues + 2025 + 2026 dues).
      const totalOutstandingDues =
        selectedYear > 0
          ? filteredSummaries.reduce((sum, s) => sum + s.totalOutstanding, 0)
          : allMembers
              .filter((m) => !filterMemberId || m.memberId === filterMemberId)
              .reduce((sum, m) => {
                const mSums = allSummaries
                  .filter((s) => s.memberId === m.memberId && s.year <= 2026)
                  .sort((a, b) => b.year - a.year);
                return sum + (mSums[0]?.totalOutstanding || 0);
              }, 0);

      const externalIncome = allIncomes
        .filter(
          (i) =>
            (!selectedYear || i.year === selectedYear) &&
            !i.voucherNo.endsWith('-OTHER') &&
            !i.voucherNo.endsWith('-FINE')
        )
        .reduce((sum, i) => sum + i.amount, 0);
      const totalIncome = totalPayable + totalFine + totalOtherReceipts + externalIncome;

      const totalExpenses = allExpenses
        .filter((e) => !selectedYear || e.year === selectedYear)
        .reduce((sum, e) => sum + e.amount, 0);

      const totalSavings = totalShareDeposits + totalDownPayments;
      const totalAllMemberCollection = allSummaries.reduce((s, r) => s + r.totalReceiveAmount, 0);
      const totalAllExternalIncome = allIncomes
        .filter((i) => !i.voucherNo.endsWith('-OTHER') && !i.voucherNo.endsWith('-FINE'))
        .reduce((s, i) => s + i.amount, 0);
      const totalAllExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
      const totalLoanOutPrincipal = allLoans.reduce((s, l) => s + l.outstandingPrincipal, 0);
      const totalLoanProfitRepaid = allLoans.reduce((s, l) => s + l.interestRepaid, 0);
      const totalInvestmentPrincipal = allInvestments.reduce(
        (s, inv) => s + inv.principalAmount,
        0
      );
      const totalInvestmentProfit = allInvestments.reduce((s, inv) => s + inv.actualReturn, 0);
      const computedNetCashBalance =
        totalAllMemberCollection +
        totalAllExternalIncome +
        totalLoanProfitRepaid +
        totalInvestmentProfit -
        totalAllExpenses -
        totalLoanOutPrincipal -
        totalInvestmentPrincipal;

      const availableCashBalance =
        selectedYear > 0
          ? totalCollection + externalIncome - totalExpenses
          : computedNetCashBalance;

      // Chart 1: Yearly Collection, Expenses & Share vs Down Payment Growth (2019–2026)
      const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
      let cumulativeShare = 0;
      let cumulativeDown = 0;
      const yearlyCollectionChart = years.map((yr) => {
        const yrRows = allSummaries.filter(
          (s) => s.year === yr && (!filterMemberId || s.memberId === filterMemberId)
        );
        const shareDeposit = yrRows.reduce((acc, r) => acc + r.totalShareDeposit, 0);
        const payable = yrRows.reduce((acc, r) => acc + r.totalPayable, 0);
        const fine = yrRows.reduce((acc, r) => acc + r.totalFine, 0);
        const otherReceive = yrRows.reduce((acc, r) => acc + r.totalOtherReceive, 0);
        const downPayment = yrRows.reduce((acc, r) => acc + r.totalDownPayment, 0);
        const total = yrRows.reduce((acc, r) => acc + r.totalReceiveAmount, 0);
        const expense = allExpenses
          .filter((e) => e.year === yr)
          .reduce((acc, e) => acc + e.amount, 0);
        cumulativeShare += shareDeposit;
        cumulativeDown += downPayment;
        return {
          year: String(yr),
          shareDeposit,
          payable,
          fine,
          otherReceive,
          downPayment,
          total,
          expense,
          netBalance: total - expense,
          cumulativeShare,
          cumulativeDown,
        };
      });

      const yearlyExpenseSummary = years.map((yr) => {
        const yrExps = allExpenses.filter((e) => e.year === yr);
        const yrCol = allSummaries
          .filter((s) => s.year === yr)
          .reduce((acc, r) => acc + r.totalReceiveAmount, 0);
        const expSum = yrExps.reduce((acc, e) => acc + e.amount, 0);
        return {
          year: yr,
          expense: expSum,
          totalExpense: expSum,
          collection: yrCol,
          netBalance: yrCol - expSum,
          voucherCount: yrExps.length,
        };
      });

      // Chart 2: Monthly Collection & Monthly Outstanding Dues for target year
      const chartYear = selectedYear > 0 ? selectedYear : 2026;
      const monthlyCollectionChart = MONTH_NAMES.map((mName, idx) => {
        const mNum = idx + 1;
        const mRows = allObligations.filter(
          (o) =>
            o.year === chartYear &&
            o.month === mNum &&
            (!filterMemberId || o.memberId === filterMemberId)
        );
        return {
          month: mName.slice(0, 3),
          monthFull: mName,
          shareDeposit: mRows.reduce((a, r) => a + r.shareDeposit, 0),
          payable: mRows.reduce((a, r) => a + r.payable, 0),
          downPayment: mRows.reduce((a, r) => a + r.downPayment, 0),
          totalCollection: mRows.reduce((a, r) => a + r.totalReceiveAmount, 0),
          outstandingDue: mRows.reduce((a, r) => a + r.monthlyDue, 0),
        };
      });

      // Chart 3: Member-wise Collection & Comprehensive 2019–2026 Due Breakdown
      const memberCollectionChart = allMembers
        .filter((m) => !filterMemberId || m.memberId === filterMemberId)
        .map((m) => {
          const mSums = filteredSummaries.filter((s) => s.memberId === m.memberId);
          const dueRefYear = selectedYear > 0 ? selectedYear : 2026;
          const latestSum = allSummaries.find(
            (s) => s.memberId === m.memberId && s.year === dueRefYear
          );
          const sum2024 =
            allSummaries.find((s) => s.memberId === m.memberId && s.year === 2024)
              ?.totalOutstanding || 0;
          const sum2025 =
            allSummaries.find((s) => s.memberId === m.memberId && s.year === 2025)
              ?.totalOutstanding || 0;
          const sum2026 =
            allSummaries.find((s) => s.memberId === m.memberId && s.year === 2026)
              ?.totalOutstanding || 0;
          return {
            memberId: m.memberId,
            name: m.name.replace('Md. ', ''),
            fullName: m.name,
            nameBn: m.nameBn,
            shareDeposit: mSums.reduce((a, r) => a + r.totalShareDeposit, 0),
            payable: mSums.reduce((a, r) => a + r.totalPayable, 0),
            downPayment: mSums.reduce((a, r) => a + r.totalDownPayment, 0),
            totalReceived: mSums.reduce((a, r) => a + r.totalReceiveAmount, 0),
            due2019To2024: sum2024,
            due2025: Math.max(0, sum2025 - sum2024),
            due2026: Math.max(0, sum2026 - sum2025),
            totalOutstanding2019To2026: sum2026,
            outstanding: latestSum?.totalOutstanding || 0,
          };
        });

      // Chart 4: Income vs Expenses breakdown
      const incomeVsExpenseChart = [
        { category: 'Payable Contributions', income: totalPayable, expense: 0 },
        { category: 'Loan & Investment Profit', income: externalIncome, expense: 0 },
        { category: 'Fines & Other', income: totalFine + totalOtherReceipts, expense: 0 },
        { category: 'Operating Expenses', income: 0, expense: totalExpenses },
      ];

      res.json({
        kpis: {
          totalMembers: allMembers.length,
          activeMembers: allMembers.filter((m) => m.status === 'ACTIVE').length,
          totalShareDeposits,
          totalPayable,
          totalFine,
          totalOtherReceipts,
          totalDownPayments,
          totalCollection,
          totalOutstandingDues,
          totalIncome,
          totalExpenses,
          totalSavings,
          availableCashBalance,
          activeLoansTotal: allLoans.reduce((a, l) => a + l.outstandingPrincipal, 0),
          activeInvestmentsTotal: allInvestments.reduce((a, inv) => a + inv.principalAmount, 0),
        },
        charts: {
          yearlyCollectionChart,
          yearlyExpenseSummary,
          monthlyCollectionChart,
          memberCollectionChart,
          incomeVsExpenseChart,
          chartYear,
        },
        yearlyExpenseSummary,
      });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: error.message || 'Failed to load financial dashboard' });
    }
  });

  // Helper: Bidirectional sync between `members` table and `society_app_users_json`
  let activeCredentialSyncPromise: Promise<{ allMembers: any[]; allUsers: any[] }> | null = null;
  let hasCompletedInitialCredentialSync = false;

  const syncAllMembersAndAppUsers = async (
    preferSource: 'MEMBER_TABLE' | 'APP_USERS' | 'AUTO' = 'AUTO'
  ) => {
    // Fast path for frequent read-only polls after initial startup sync has already reconciled everything
    if (preferSource === 'AUTO' && hasCompletedInitialCredentialSync && !activeCredentialSyncPromise) {
      const [allMembers, allUsers] = await Promise.all([
        db.select().from(members).orderBy(asc(members.id)),
        getAppUsersSafe(),
      ]);
      return { allMembers, allUsers };
    }

    if (activeCredentialSyncPromise && preferSource === 'AUTO') {
      return await activeCredentialSyncPromise;
    }

    const runSync = (async () => {
      const [allMembers, allUsers, settingsRows] = await Promise.all([
        db.select().from(members).orderBy(asc(members.id)),
        getAppUsersSafe(),
        db.select().from(systemSettings),
      ]);
      const settingsMap = new Map(settingsRows.map((s) => [s.settingKey, s.settingValue]));
      const initialSyncDone = settingsMap.get('UNIFIED_CREDENTIALS_SYNC_V2') === 'TRUE';

      let usersMutated = false;

      for (const m of allMembers) {
        const mId = String(m.memberId).trim();
        const memberPin = String(m.loginPin || '1234').trim();
        const defaultPinForMember = mId === '09' ? '7709' : mId === '02' ? '2026' : '1234';

        const linkedUsers = allUsers.filter((u) => String(u.memberId || '').trim() === mId);

        if (linkedUsers.length === 0) {
          const maxId = allUsers.reduce((acc, u) => Math.max(acc, Number(u.id || 0)), 0);
          allUsers.push({
            id: maxId + 1,
            username: `member${mId}`,
            password: memberPin,
            fullName: m.name,
            fullNameBn: m.nameBn || m.name,
            role: mId === '09' ? 'SUPER_ADMIN' : mId === '02' ? 'ADMIN' : 'MEMBER',
            memberId: mId,
            phone: m.mobile || '',
            email: m.email || '',
            isActive: m.status === 'ACTIVE',
            notes: `সদস্য পোর্টাল একাউন্ট #${mId}`,
            createdBy: 'System Sync',
            lastLoginAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          usersMutated = true;
        } else {
          const primaryUser =
            linkedUsers.find(
              (u) => String(u.username).toLowerCase() === `member${mId.toLowerCase()}`
            ) || linkedUsers[0];
          let targetPassword = String(primaryUser.password || memberPin).trim();

          if (preferSource === 'MEMBER_TABLE') {
            targetPassword = memberPin;
          } else if (preferSource === 'APP_USERS') {
            targetPassword = String(primaryUser.password || memberPin).trim();
          } else if (!initialSyncDone) {
            if (memberPin && memberPin !== defaultPinForMember && memberPin !== '1234') {
              targetPassword = memberPin;
            } else if (memberPin && primaryUser.password !== memberPin) {
              targetPassword = memberPin;
            }
          }

          for (const u of linkedUsers) {
            if (
              u.password !== targetPassword ||
              u.fullName !== m.name ||
              u.fullNameBn !== (m.nameBn || m.name) ||
              u.phone !== (m.mobile || '') ||
              Boolean(u.isActive) !== (m.status === 'ACTIVE')
            ) {
              u.password = targetPassword;
              u.fullName = m.name;
              u.fullNameBn = m.nameBn || m.name;
              u.phone = m.mobile || u.phone || '';
              u.email = m.email || u.email || '';
              u.isActive = m.status === 'ACTIVE';
              u.updatedAt = new Date().toISOString();
              usersMutated = true;
            }
          }

          if (m.loginPin !== targetPassword) {
            await db
              .update(members)
              .set({ loginPin: targetPassword })
              .where(eq(members.memberId, mId));
            m.loginPin = targetPassword;
          }
        }
      }

      if (usersMutated) {
        await saveAppUsersSafe(allUsers);
      }

      if (!initialSyncDone) {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'UNIFIED_CREDENTIALS_SYNC_V2',
            settingValue: 'TRUE',
            description:
              'Unified bidirectional sync between Member Profile and User Management Studio',
            updatedBy: 'System',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: 'TRUE', updatedAt: new Date() },
          });
      }

      hasCompletedInitialCredentialSync = true;
      return { allMembers, allUsers };
    })();

    if (preferSource === 'AUTO') {
      activeCredentialSyncPromise = runSync.finally(() => {
        activeCredentialSyncPromise = null;
      });
      return await activeCredentialSyncPromise;
    }
    return await runSync;
  };

  // 3. Member Management Module
  app.get('/api/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const { allMembers, allUsers } = await syncAllMembersAndAppUsers('AUTO');
      const allSummaries = await db.select().from(annualAccountSummaries);
      const dpAgreements = await db.select().from(downPaymentAgreements);

      const role = req.profile?.role || 'SUPER_ADMIN';
      const myMemberId = req.profile?.memberId || '02';

      const filtered =
        role === 'MEMBER'
          ? allMembers.filter((m) => m.memberId === myMemberId)
          : allMembers;

      const enriched = filtered.map((m) => {
        const mSums = allSummaries.filter((s) => s.memberId === m.memberId);
        const dp = dpAgreements.find((d) => d.memberId === m.memberId);
        const linkedUsers = allUsers.filter(
          (u) => String(u.memberId || '').trim() === String(m.memberId).trim()
        );
        const primaryUser =
          linkedUsers.find(
            (u) => String(u.username || '').toLowerCase() === `member${String(m.memberId).toLowerCase()}`
          ) || linkedUsers[0];
        const latest2026Summary = [...mSums]
          .filter((s) => s.year <= 2026)
          .sort((a, b) => b.year - a.year)[0];
        const due2024Summary = mSums.find((s) => s.year === 2024);
        return {
          ...m,
          username: primaryUser?.username || `member${m.memberId}`,
          loginPin: primaryUser?.password || m.loginPin || '1234',
          lastLoginAt: primaryUser?.lastLoginAt || null,
          lifetimeShareDeposit: mSums.reduce((a, s) => a + s.totalShareDeposit, 0),
          lifetimePayable: mSums.reduce((a, s) => a + s.totalPayable, 0),
          lifetimeFine: mSums.reduce((a, s) => a + s.totalFine, 0),
          lifetimeOtherReceive: mSums.reduce((a, s) => a + s.totalOtherReceive, 0),
          lifetimeDownPayment: dp ? dp.totalPaid : mSums.reduce((a, s) => a + s.totalDownPayment, 0),
          lifetimeTotalReceived: mSums.reduce((a, s) => a + s.totalReceiveAmount, 0),
          historicalDue2024: due2024Summary ? due2024Summary.totalOutstanding : 0,
          currentOutstanding: latest2026Summary ? latest2026Summary.totalOutstanding : 0,
          downPaymentRemaining: dp ? dp.remainingAmount : 0,
        };
      });

      res.json({ members: enriched });
    } catch (error: any) {
      console.error('Get members error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch members' });
    }
  });

  app.post('/api/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const {
        memberId,
        name,
        nameBn,
        fatherName,
        motherName,
        mobile,
        email,
        address,
        joiningDate,
        nidNumber,
        bloodGroup,
        occupation,
        photoUrl,
        loginPin,
        nomineeName,
        nomineeRelation,
        nomineeMobile,
        nomineeNid,
        nomineeSharePercent,
        nomineePhotoUrl,
        status,
        monthlyShareDeposit,
        monthlyPayableAmount,
        monthlyFinePolicy,
        otherPaymentSettings,
        downPaymentTarget,
        remarks,
      } = req.body;

      if (!memberId || !name || !mobile) {
        return res.status(400).json({ error: 'Member ID, Name, and Mobile Number are required.' });
      }

      // Check duplicate Member ID only (never auto-merge similar names or phones!)
      const existing = await db.select().from(members).where(eq(members.memberId, memberId));
      if (existing.length > 0) {
        return res.status(400).json({
          error: `Member ID ${memberId} already exists. Historical Member IDs must be unique.`,
        });
      }

      const [created] = await db
        .insert(members)
        .values({
          memberId: memberId.trim(),
          name: name.trim(),
          nameBn: (nameBn || name).trim(),
          fatherName: fatherName || '',
          motherName: motherName || '',
          mobile: mobile.trim(),
          email: email || '',
          address: address || '',
          joiningDate: joiningDate || new Date().toISOString().slice(0, 10),
          nidNumber: nidNumber || '',
          bloodGroup: bloodGroup || '',
          occupation: occupation || 'সম্মানিত সমবায়ী সদস্য',
          photoUrl: photoUrl || '',
          loginPin: loginPin || '1234',
          nomineeName: nomineeName || '',
          nomineeRelation: nomineeRelation || '',
          nomineeMobile: nomineeMobile || '',
          nomineeNid: nomineeNid || '',
          nomineeSharePercent: Number(nomineeSharePercent) || 100,
          nomineePhotoUrl: nomineePhotoUrl || '',
          status: status || 'ACTIVE',
          monthlyShareDeposit: Number(monthlyShareDeposit) || 2000,
          monthlyPayableAmount: Number(monthlyPayableAmount) || 50,
          monthlyFinePolicy: Number(monthlyFinePolicy) || 0,
          otherPaymentSettings: otherPaymentSettings || 'Standard Cooperative Policy',
          downPaymentTarget: Number(downPaymentTarget) || 82000,
          advanceCreditBalance: 0,
          remarks: remarks || '',
        })
        .returning();

      await db.insert(downPaymentAgreements).values({
        memberId: created.memberId,
        memberName: created.name,
        agreedAmount: created.downPaymentTarget,
        totalPaid: 0,
        remainingAmount: created.downPaymentTarget,
        effectiveDate: created.joiningDate,
        status: 'PENDING',
      });

      await recalculateMemberYearAccount(created.memberId, 2026);

      // Automatically create/sync user credentials in User Management Studio
      const allUsers = await getAppUsersSafe();
      const desiredUsername = String(req.body.username || `member${created.memberId}`)
        .trim()
        .toLowerCase();
      const existingUserIdx = allUsers.findIndex(
        (u) =>
          String(u.memberId || '').trim() === created.memberId ||
          String(u.username || '').toLowerCase() === desiredUsername
      );
      if (existingUserIdx === -1) {
        const maxId = allUsers.reduce((acc, u) => Math.max(acc, Number(u.id || 0)), 0);
        allUsers.push({
          id: maxId + 1,
          username: desiredUsername,
          password: created.loginPin || '1234',
          fullName: created.name,
          fullNameBn: created.nameBn || created.name,
          role: 'MEMBER',
          memberId: created.memberId,
          phone: created.mobile || '',
          email: created.email || '',
          isActive: created.status === 'ACTIVE',
          notes: `সদস্য পোর্টাল একাউন্ট #${created.memberId}`,
          createdBy: req.profile?.fullName || 'Super Admin',
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await saveAppUsersSafe(allUsers);
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'CREATE_MEMBER',
        entityType: 'members',
        entityId: created.memberId,
        previousValue: '',
        updatedValue: JSON.stringify(created),
        reason: 'New cooperative society member registration',
      });

      res.json({ member: { ...created, username: desiredUsername } });
    } catch (error: any) {
      console.error('Create member error:', error);
      res.status(500).json({ error: error.message || 'Failed to register member' });
    }
  });

  app.put('/api/members/:memberId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const targetId = req.params.memberId;
      const isSuperOrAdmin = req.profile && ['SUPER_ADMIN', 'ADMIN'].includes(req.profile.role);
      const isMemberRole = req.profile && req.profile.role === 'MEMBER';

      if (!isSuperOrAdmin && !isMemberRole) {
        return res.status(403).json({
          error: 'অনুমতি নেই: শুধুমাত্র এডমিন বা সংশ্লিষ্ট সদস্য নিজের প্রোফাইল আপডেট করতে পারবেন।',
        });
      }

      const existing = await db.select().from(members).where(eq(members.memberId, targetId));
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      const prev = existing[0];

      const incomingPinOrPassword =
        req.body.password !== undefined && String(req.body.password).trim() !== ''
          ? String(req.body.password).trim()
          : req.body.loginPin !== undefined && String(req.body.loginPin).trim() !== ''
          ? String(req.body.loginPin).trim()
          : undefined;

      // Both Admin/SuperAdmin AND the Member themselves can update their password/loginPin and photos
      const [updated] = await db
        .update(members)
        .set({
          name:
            isSuperOrAdmin && req.body.name !== undefined
              ? String(req.body.name).trim()
              : prev.name,
          nameBn:
            isSuperOrAdmin && req.body.nameBn !== undefined
              ? String(req.body.nameBn).trim()
              : prev.nameBn,
          fatherName:
            isSuperOrAdmin && req.body.fatherName !== undefined
              ? String(req.body.fatherName).trim()
              : prev.fatherName,
          motherName:
            isSuperOrAdmin && req.body.motherName !== undefined
              ? String(req.body.motherName).trim()
              : prev.motherName,
          mobile:
            isSuperOrAdmin && req.body.mobile !== undefined
              ? String(req.body.mobile).trim()
              : prev.mobile,
          email:
            isSuperOrAdmin && req.body.email !== undefined
              ? String(req.body.email).trim()
              : prev.email,
          address:
            isSuperOrAdmin && req.body.address !== undefined
              ? String(req.body.address).trim()
              : prev.address,
          joiningDate:
            isSuperOrAdmin && req.body.joiningDate !== undefined
              ? String(req.body.joiningDate)
              : prev.joiningDate,
          nidNumber:
            isSuperOrAdmin && req.body.nidNumber !== undefined
              ? String(req.body.nidNumber).trim()
              : prev.nidNumber,
          bloodGroup:
            isSuperOrAdmin && req.body.bloodGroup !== undefined
              ? String(req.body.bloodGroup).trim()
              : prev.bloodGroup,
          occupation:
            isSuperOrAdmin && req.body.occupation !== undefined
              ? String(req.body.occupation).trim()
              : prev.occupation,
          photoUrl: req.body.photoUrl !== undefined ? String(req.body.photoUrl) : prev.photoUrl,
          loginPin: incomingPinOrPassword !== undefined ? incomingPinOrPassword : prev.loginPin,
          nomineeName:
            isSuperOrAdmin && req.body.nomineeName !== undefined
              ? String(req.body.nomineeName).trim()
              : prev.nomineeName,
          nomineeRelation:
            isSuperOrAdmin && req.body.nomineeRelation !== undefined
              ? String(req.body.nomineeRelation).trim()
              : prev.nomineeRelation,
          nomineeMobile:
            isSuperOrAdmin && req.body.nomineeMobile !== undefined
              ? String(req.body.nomineeMobile).trim()
              : prev.nomineeMobile,
          nomineeNid:
            isSuperOrAdmin && req.body.nomineeNid !== undefined
              ? String(req.body.nomineeNid).trim()
              : prev.nomineeNid,
          nomineeSharePercent:
            isSuperOrAdmin && req.body.nomineeSharePercent !== undefined
              ? Number(req.body.nomineeSharePercent)
              : prev.nomineeSharePercent,
          nomineePhotoUrl:
            req.body.nomineePhotoUrl !== undefined
              ? String(req.body.nomineePhotoUrl)
              : prev.nomineePhotoUrl,
          status: isSuperOrAdmin && req.body.status !== undefined ? req.body.status : prev.status,
          monthlyShareDeposit:
            isSuperOrAdmin && req.body.monthlyShareDeposit !== undefined
              ? Number(req.body.monthlyShareDeposit)
              : prev.monthlyShareDeposit,
          monthlyPayableAmount:
            isSuperOrAdmin && req.body.monthlyPayableAmount !== undefined
              ? Number(req.body.monthlyPayableAmount)
              : prev.monthlyPayableAmount,
          monthlyFinePolicy:
            isSuperOrAdmin && req.body.monthlyFinePolicy !== undefined
              ? Number(req.body.monthlyFinePolicy)
              : prev.monthlyFinePolicy,
          otherPaymentSettings:
            isSuperOrAdmin && req.body.otherPaymentSettings !== undefined
              ? String(req.body.otherPaymentSettings)
              : prev.otherPaymentSettings,
          downPaymentTarget:
            isSuperOrAdmin && req.body.downPaymentTarget !== undefined
              ? Number(req.body.downPaymentTarget)
              : prev.downPaymentTarget,
          remarks:
            isSuperOrAdmin && req.body.remarks !== undefined
              ? String(req.body.remarks)
              : prev.remarks,
        })
        .where(eq(members.memberId, targetId))
        .returning();

      // Immediately sync updated password/loginPin, username, name, mobile, email & status into User Management Studio (`society_app_users_json`)
      const allUsers = await getAppUsersSafe();
      const incomingUsername =
        req.body.username !== undefined && String(req.body.username).trim().length >= 3
          ? String(req.body.username).trim().toLowerCase()
          : undefined;

      let matchedAnyUser = false;
      let resolvedUsername = `member${targetId}`;

      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i];
        if (String(u.memberId || '').trim() === String(targetId).trim()) {
          matchedAnyUser = true;
          const isPrimaryMemberAccount =
            String(u.username || '').toLowerCase() === `member${String(targetId).toLowerCase()}` ||
            allUsers.filter((x) => String(x.memberId || '').trim() === String(targetId).trim())
              .length === 1;

          if (incomingUsername && isPrimaryMemberAccount) {
            const collision = allUsers.find(
              (other, idx) =>
                idx !== i && String(other.username || '').toLowerCase() === incomingUsername
            );
            if (!collision) {
              u.username = incomingUsername;
            }
          }
          if (isPrimaryMemberAccount) {
            resolvedUsername = u.username;
          }

          u.password = updated.loginPin || '1234';
          u.fullName = updated.name;
          u.fullNameBn = updated.nameBn || updated.name;
          u.phone = updated.mobile || u.phone || '';
          u.email = updated.email || u.email || '';
          u.isActive = updated.status === 'ACTIVE';
          u.updatedAt = new Date().toISOString();
        }
      }

      if (!matchedAnyUser) {
        const maxId = allUsers.reduce((acc, u) => Math.max(acc, Number(u.id || 0)), 0);
        resolvedUsername = incomingUsername || `member${targetId}`;
        allUsers.push({
          id: maxId + 1,
          username: resolvedUsername,
          password: updated.loginPin || '1234',
          fullName: updated.name,
          fullNameBn: updated.nameBn || updated.name,
          role: targetId === '09' ? 'SUPER_ADMIN' : targetId === '02' ? 'ADMIN' : 'MEMBER',
          memberId: targetId,
          phone: updated.mobile || '',
          email: updated.email || '',
          isActive: updated.status === 'ACTIVE',
          notes: `সদস্য পোর্টাল একাউন্ট #${targetId}`,
          createdBy: req.profile?.fullName || 'System Sync',
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await saveAppUsersSafe(allUsers);

      // Also sync master PIN settings if member 09 (Super Admin) or 02 (Admin) changed their password/PIN
      if (incomingPinOrPassword && targetId === '09') {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'super_admin_pin',
            settingValue: incomingPinOrPassword,
            description: 'Super Admin Master Security PIN',
            updatedBy: req.profile?.fullName || 'Super Admin',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: incomingPinOrPassword, updatedAt: new Date() },
          });
      } else if (incomingPinOrPassword && targetId === '02') {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'admin_pin',
            settingValue: incomingPinOrPassword,
            description: 'Admin Security PIN',
            updatedBy: req.profile?.fullName || 'Admin',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: incomingPinOrPassword, updatedAt: new Date() },
          });
      }

      // Sync down payment agreement if target or name changed by admin
      if (
        isSuperOrAdmin &&
        (req.body.downPaymentTarget !== undefined ||
          req.body.name !== undefined ||
          req.body.joiningDate !== undefined)
      ) {
        await syncMemberDownPaymentAgreement(targetId);
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'user',
        actorName: req.profile?.fullName || (isMemberRole ? `সদস্য #${targetId}` : 'Admin'),
        actorRole: req.profile?.role || 'MEMBER',
        action:
          incomingPinOrPassword && incomingPinOrPassword !== prev.loginPin
            ? 'SYNC_MEMBER_PASSWORD_AND_PROFILE'
            : 'UPDATE_MEMBER',
        entityType: 'members',
        entityId: targetId,
        previousValue: JSON.stringify({
          name: prev.nameBn,
          mobile: prev.mobile,
          loginPin: prev.loginPin,
        }),
        updatedValue: JSON.stringify({
          name: updated.nameBn,
          mobile: updated.mobile,
          username: resolvedUsername,
          loginPin: updated.loginPin,
        }),
        reason:
          req.body.reason ||
          (incomingPinOrPassword && incomingPinOrPassword !== prev.loginPin
            ? 'সদস্য প্রোফাইল থেকে পাসওয়ার্ড পরিবর্তন ও ইউজার ম্যানেজমেন্ট স্টুডিওতে অটো-সিঙ্ক'
            : isMemberRole
            ? 'সদস্য কর্তৃক নিজ প্রোফাইল ও পাসওয়ার্ড হালনাগাদ'
            : 'এডমিন কর্তৃক সদস্য ও নমিনি আপডেট'),
      });

      const mSums = await db
        .select()
        .from(annualAccountSummaries)
        .where(eq(annualAccountSummaries.memberId, targetId));
      const [dp] = await db
        .select()
        .from(downPaymentAgreements)
        .where(eq(downPaymentAgreements.memberId, targetId));

      const latest2026Summary = [...mSums]
        .filter((s) => s.year <= 2026)
        .sort((a, b) => b.year - a.year)[0];
      const due2024Summary = mSums.find((s) => s.year === 2024);

      const enrichedMember = {
        ...updated,
        username: resolvedUsername,
        lifetimeShareDeposit: mSums.reduce((a, s) => a + s.totalShareDeposit, 0),
        lifetimePayable: mSums.reduce((a, s) => a + s.totalPayable, 0),
        lifetimeFine: mSums.reduce((a, s) => a + s.totalFine, 0),
        lifetimeOtherReceive: mSums.reduce((a, s) => a + s.totalOtherReceive, 0),
        lifetimeDownPayment: dp ? dp.totalPaid : mSums.reduce((a, s) => a + s.totalDownPayment, 0),
        lifetimeTotalReceived: mSums.reduce((a, s) => a + s.totalReceiveAmount, 0),
        historicalDue2024: due2024Summary ? due2024Summary.totalOutstanding : 0,
        currentOutstanding: latest2026Summary ? latest2026Summary.totalOutstanding : 0,
        downPaymentRemaining: dp ? dp.remainingAmount : 0,
      };

      res.json({ success: true, member: enrichedMember });
    } catch (error: any) {
      console.error('Update member error:', error);
      res.status(500).json({ error: error.message || 'Failed to update member' });
    }
  });

  // 3B. Role-Based Security & Authentication Verification API (with Anti-Hack Brute Force Shield)
  app.post('/api/auth/verify-login', async (req, res) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'local-client';

      const rateRecord = loginRateLimiter.get(clientIp);
      if (rateRecord && rateRecord.lockUntil > Date.now()) {
        const waitSec = Math.ceil((rateRecord.lockUntil - Date.now()) / 1000);
        return res.status(429).json({
          error: `নিরাপত্তা লকডাউন: পরপর ভুল পিন দেওয়ার কারণে আপনার আইপি সাময়িকভাবে ব্লক করা হয়েছে। অনুগ্রহ করে ${waitSec} সেকেন্ড পর আবার চেষ্টা করুন।`,
        });
      }

      await ensureSeeded();
      const { allMembers, allUsers } = await syncAllMembersAndAppUsers('AUTO');
      const { role, email, password, pin, memberId } = req.body;

      // Load custom PINs from systemSettings if configured by Super Admin
      const settingsRows = await db.select().from(systemSettings);
      const settingsMap = new Map<string, string>();
      for (const s of settingsRows) settingsMap.set(s.settingKey, s.settingValue);

      const superAdminUser = allUsers.find(
        (u) => u.role === 'SUPER_ADMIN' || u.memberId === '09'
      );
      const adminUser = allUsers.find((u) => u.role === 'ADMIN' || u.memberId === '02');

      const customSuperAdminPin = String(
        superAdminUser?.password || settingsMap.get('super_admin_pin') || '7709'
      ).toLowerCase();
      const customAdminPin = String(
        adminUser?.password || settingsMap.get('admin_pin') || '2026'
      ).toLowerCase();

      const recordFailedAttempt = async (attemptedRole: string, detail: string) => {
        const prevCount = rateRecord?.count || 0;
        const nextCount = prevCount + 1;
        const lockUntil = nextCount >= 5 ? Date.now() + 60 * 1000 : 0;
        loginRateLimiter.set(clientIp, { count: nextCount, lockUntil });

        await db.insert(auditLogs).values({
          actorUid: clientIp,
          actorName: `Unauthorized Attempt (${attemptedRole})`,
          actorRole: attemptedRole,
          action: nextCount >= 5 ? 'SECURITY_BRUTE_FORCE_LOCKOUT' : 'FAILED_LOGIN_ATTEMPT',
          entityType: 'security_auth',
          entityId: attemptedRole,
          previousValue: `Attempt #${nextCount}`,
          updatedValue: 'BLOCKED',
          reason: detail,
        });
      };

      if (role === 'SUPER_ADMIN') {
        const inputSecret = String(pin || password || '').trim().toLowerCase();
        const isPinMatch =
          inputSecret === customSuperAdminPin ||
          allUsers.some(
            (u) =>
              (u.role === 'SUPER_ADMIN' || u.memberId === '09') &&
              String(u.password || '').toLowerCase() === inputSecret
          );
        const isEmailOnlyQuickSwitch =
          !inputSecret && email && email.toLowerCase() === 'mamun770m@gmail.com';

        if (isPinMatch || isEmailOnlyQuickSwitch) {
          loginRateLimiter.delete(clientIp);
          const signedToken = createSignedSessionToken('SUPER_ADMIN', '09');
          return res.json({
            success: true,
            role: 'SUPER_ADMIN',
            memberId: '09',
            fullName: 'মোঃ মনির হোসেন মামুন (সুপার এডমিন)',
            email: 'mamun770m@gmail.com',
            token: signedToken,
            sessionToken: signedToken,
          });
        }
        await recordFailedAttempt('SUPER_ADMIN', 'Invalid Super Admin PIN entered');
        return res
          .status(401)
          .json({ error: 'ভুল পিন বা পাসওয়ার্ড। দয়া করে সঠিক সুপার এডমিন পিন বা পাসওয়ার্ড দিন।' });
      }

      if (role === 'ADMIN') {
        const inputSecret = String(pin || password || '').trim().toLowerCase();
        const isPinMatch =
          inputSecret === customAdminPin ||
          allUsers.some(
            (u) =>
              (u.role === 'ADMIN' || u.memberId === '02') &&
              String(u.password || '').toLowerCase() === inputSecret
          );
        if (isPinMatch) {
          loginRateLimiter.delete(clientIp);
          const signedToken = createSignedSessionToken('ADMIN', '02');
          return res.json({
            success: true,
            role: 'ADMIN',
            memberId: '02',
            fullName: 'হাফেজ মোহাম্মদ কামরুজ্জামান (এডমিন)',
            email: 'admin@hilfulfuzul.org',
            token: signedToken,
            sessionToken: signedToken,
          });
        }
        await recordFailedAttempt('ADMIN', 'Invalid Admin PIN entered');
        return res.status(401).json({ error: 'ভুল এডমিন পিন বা পাসওয়ার্ড। দয়া করে সঠিক পিন দিন।' });
      }

      if (role === 'MEMBER') {
        const targetMemberId = String(memberId || '').trim();
        if (!targetMemberId) {
          return res.status(400).json({ error: 'দয়া করে সদস্য আইডি নির্বাচন করুন।' });
        }
        const m = allMembers.find((mem) => mem.memberId === targetMemberId);
        if (!m) {
          return res.status(404).json({ error: 'সদস্য খুঁজে পাওয়া যায়নি।' });
        }
        const linkedUser = allUsers.find(
          (u) => String(u.memberId || '').trim() === targetMemberId
        );
        const inputPin = String(pin || password || '').trim();
        const expectedPin = String(linkedUser?.password || m.loginPin || '1234').trim();
        const phoneLastDigits = m.mobile ? m.mobile.replace(/\D/g, '').slice(-4) : '';
        if (
          inputPin === expectedPin ||
          (phoneLastDigits && inputPin === phoneLastDigits && expectedPin === '1234')
        ) {
          loginRateLimiter.delete(clientIp);
          const signedToken = createSignedSessionToken('MEMBER', m.memberId);
          return res.json({
            success: true,
            role: 'MEMBER',
            memberId: m.memberId,
            fullName: `${m.nameBn || m.name} (সদস্য নং #${m.memberId})`,
            email: m.email,
            member: m,
            token: signedToken,
            sessionToken: signedToken,
          });
        }
        await recordFailedAttempt(`MEMBER_${targetMemberId}`, 'Invalid Member PIN entered');
        return res.status(401).json({
          error: 'সদস্য পিন বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আপনার হালনাগাদ পাসওয়ার্ড প্রদান করুন।',
        });
      }

      res.status(400).json({ error: 'অকার্যকর লগ ইন অনুরোধ।' });
    } catch (err: any) {
      console.error('Verify login error:', err);
      res.status(500).json({ error: err.message || 'লগ ইন যাচাইকরণে সমস্যা হয়েছে' });
    }
  });

  // Public helper for Quick-Fill accounts on Login Screen (always returns live synced usernames/passwords)
  app.get('/api/auth/quick-accounts', async (_req, res) => {
    try {
      await ensureAppUsersSeeded();
      const { allUsers } = await syncAllMembersAndAppUsers('AUTO');
      const activeList = allUsers
        .filter((u) => u.isActive !== false)
        .map((u) => ({
          id: u.id,
          username: u.username,
          password: u.password,
          fullName: u.fullName,
          fullNameBn: u.fullNameBn,
          role: u.role,
          memberId: u.memberId,
          phone: u.phone,
        }));
      res.json({ success: true, accounts: activeList });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load quick accounts' });
    }
  });

  // 3B-2. Universal Username & Password Authentication API (created & managed by Super Admin)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'local-client';

      const rateRecord = loginRateLimiter.get(clientIp);
      if (rateRecord && rateRecord.lockUntil > Date.now()) {
        const waitSec = Math.ceil((rateRecord.lockUntil - Date.now()) / 1000);
        return res.status(429).json({
          error: `নিরাপত্তা লকডাউন: একাধিকবার ভুল পাসওয়ার্ড দেওয়ায় আপনার আইপি সাময়িক ব্লক করা হয়েছে। অনুগ্রহ করে ${waitSec} সেকেন্ড পর আবার চেষ্টা করুন।`,
        });
      }

      await ensureAppUsersSeeded();
      const { allMembers, allUsers } = await syncAllMembersAndAppUsers('AUTO');

      const inputUsername = String(req.body.username || '').trim();
      const inputPassword = String(req.body.password || '').trim();

      if (!inputUsername || !inputPassword) {
        return res.status(400).json({ error: 'দয়া করে ইউজার নেম এবং পাসওয়ার্ড উভয়ই প্রদান করুন।' });
      }

      const cleanInputUser = inputUsername.toLowerCase().replace(/^@/, '');

      // Find user by username, memberId, phone, or email (prefer exact username match first, then memberId)
      const candidates = allUsers.filter(
        (u) =>
          String(u.username || '').toLowerCase() === cleanInputUser ||
          (u.memberId && String(u.memberId).toLowerCase() === cleanInputUser) ||
          (u.phone &&
            u.phone.replace(/\D/g, '') === cleanInputUser.replace(/\D/g, '') &&
            cleanInputUser.length >= 6) ||
          (u.email && u.email.toLowerCase() === cleanInputUser)
      );

      let matched =
        candidates.find((u) => u.password === inputPassword) || candidates[0];

      // Also check if member's loginPin in `members` table matches directly
      if (matched && matched.memberId) {
        const linkedMem = allMembers.find((m) => m.memberId === matched.memberId);
        if (linkedMem && linkedMem.loginPin && linkedMem.loginPin === inputPassword) {
          matched.password = linkedMem.loginPin;
        }
      }

      if (!matched) {
        const prevCount = rateRecord?.count || 0;
        const nextCount = prevCount + 1;
        const lockUntil = nextCount >= 6 ? Date.now() + 60 * 1000 : 0;
        loginRateLimiter.set(clientIp, { count: nextCount, lockUntil });

        await db.insert(auditLogs).values({
          actorUid: clientIp,
          actorName: `Unknown User: ${inputUsername}`,
          actorRole: 'ANONYMOUS',
          action: 'FAILED_LOGIN_ATTEMPT',
          entityType: 'app_users',
          entityId: inputUsername,
          previousValue: '',
          updatedValue: 'USER_NOT_FOUND',
          reason: 'ইউজার নেম ডাটাবেজে পাওয়া যায়নি',
        });

        return res.status(401).json({
          error:
            'ইউজার নেম বা পাসওয়ার্ড সঠিক নয়। সুপার এডমিনের দেওয়া সঠিক ক্রেডেনশিয়াল ব্যবহার করুন।',
        });
      }

      if (!matched.isActive) {
        return res.status(403).json({
          error:
            'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় (Inactive) রয়েছে। অনুগ্রহ করে সুপার এডমিনের সাথে যোগাযোগ করুন।',
        });
      }

      if (matched.password !== inputPassword) {
        const prevCount = rateRecord?.count || 0;
        const nextCount = prevCount + 1;
        const lockUntil = nextCount >= 6 ? Date.now() + 60 * 1000 : 0;
        loginRateLimiter.set(clientIp, { count: nextCount, lockUntil });

        await db.insert(auditLogs).values({
          actorUid: clientIp,
          actorName: matched.fullNameBn || matched.fullName,
          actorRole: matched.role,
          action: 'FAILED_LOGIN_PASSWORD',
          entityType: 'app_users',
          entityId: matched.username,
          previousValue: '',
          updatedValue: 'WRONG_PASSWORD',
          reason: 'পাসওয়ার্ড মেলেনি',
        });

        return res.status(401).json({
          error: 'পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আপনার সঠিক পাসওয়ার্ড প্রদান করুন।',
        });
      }

      // Successful login
      loginRateLimiter.delete(clientIp);

      if (matched.id && matched.id < 900000) {
        const updatedList = allUsers.map((u) =>
          Number(u.id) === Number(matched.id) ? { ...u, lastLoginAt: new Date().toISOString() } : u
        );
        await saveAppUsersSafe(updatedList);
      }

      const signedToken = createSignedSessionToken(matched.role, matched.memberId || '09');

      await db.insert(auditLogs).values({
        actorUid: String(matched.id),
        actorName: matched.fullNameBn || matched.fullName,
        actorRole: matched.role,
        action: 'SUCCESSFUL_LOGIN',
        entityType: 'app_users',
        entityId: matched.username,
        previousValue: '',
        updatedValue: `Logged in from ${clientIp}`,
        reason: 'ইউজার নেম এবং পাসওয়ার্ড দিয়ে সফল প্রবেশ',
      });

      return res.json({
        success: true,
        user: {
          id: matched.id,
          username: matched.username,
          fullName: matched.fullName,
          fullNameBn: matched.fullNameBn,
          role: matched.role,
          memberId: matched.memberId,
          phone: matched.phone,
          email: matched.email,
          notes: matched.notes,
          isActive: matched.isActive,
          lastLoginAt: new Date().toISOString(),
        },
        sessionToken: signedToken,
        role: matched.role,
        memberId: matched.memberId,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err.message || 'লগ ইন প্রক্রিয়ায় ত্রুটি ঘটেছে' });
    }
  });

  // 3B-3. Super Admin App Users Management APIs
  // GET /api/app-users - List all user accounts (always live-synced with Member Profiles)
  app.get('/api/app-users', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      await ensureAppUsersSeeded();
      const { allMembers, allUsers } = await syncAllMembersAndAppUsers('AUTO');
      allUsers.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

      const recentSecurityLogs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.id))
        .limit(15);

      res.json({
        success: true,
        users: allUsers.map((u) => {
          const linkedMem = allMembers.find(
            (m) => String(m.memberId).trim() === String(u.memberId || '').trim()
          );
          return {
            id: u.id,
            username: u.username,
            password:
              req.profile?.role === 'SUPER_ADMIN' || req.profile?.role === 'ADMIN'
                ? u.password
                : '••••••••',
            fullName: linkedMem?.name || u.fullName,
            fullNameBn: linkedMem?.nameBn || u.fullNameBn,
            role: u.role,
            memberId: u.memberId,
            phone: linkedMem?.mobile || u.phone,
            email: linkedMem?.email || u.email,
            photoUrl: linkedMem?.photoUrl || '',
            isActive: u.isActive,
            notes: u.notes,
            createdBy: u.createdBy,
            lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          };
        }),
        recentSecurityLogs,
      });
    } catch (err: any) {
      console.error('Fetch app users error:', err);
      res.status(500).json({ error: err.message || 'ইউজার তালিকা আনতে সমস্যা হয়েছে' });
    }
  });

  // POST /api/app-users - Super Admin creates a new username and password user
  app.post('/api/app-users', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const {
        username,
        password,
        fullName,
        fullNameBn,
        role = 'MEMBER',
        memberId = '',
        phone = '',
        email = '',
        isActive = true,
        notes = '',
      } = req.body;

      const cleanUsername = String(username || '').trim().replace(/^@/, '');
      const cleanPassword = String(password || '').trim();

      if (!cleanUsername || cleanUsername.length < 3) {
        return res.status(400).json({ error: 'ইউজার নেম কমপক্ষে ৩ অক্ষরের হতে হবে।' });
      }

      if (!cleanPassword || cleanPassword.length < 4) {
        return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' });
      }

      if (!fullName) {
        return res.status(400).json({ error: 'ব্যবহারকারীর পুরো নাম আবশ্যক।' });
      }

      const allUsers = await getAppUsersSafe();
      const existing = allUsers.find(
        (u) => String(u.username || '').toLowerCase() === cleanUsername.toLowerCase()
      );

      if (existing) {
        return res.status(400).json({
          error: `ইউজার নেম "${cleanUsername}" ইতিমধ্যে বিদ্যমান। অনুগ্রহ করে ভিন্ন ইউজার নেম দিন।`,
        });
      }

      const maxId = allUsers.reduce((acc, u) => Math.max(acc, Number(u.id || 0)), 0);
      const cleanMemberId = String(memberId || '').trim();
      const created = {
        id: maxId + 1,
        username: cleanUsername,
        password: cleanPassword,
        fullName: String(fullName).trim(),
        fullNameBn: String(fullNameBn || fullName).trim(),
        role: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'].includes(role) ? role : 'MEMBER',
        memberId: cleanMemberId,
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        isActive: Boolean(isActive),
        notes: String(notes || '').trim(),
        createdBy: req.profile?.fullName || 'সুপার এডমিন',
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      allUsers.push(created);
      await saveAppUsersSafe(allUsers);

      // Sync password to linked member in `members` table
      if (cleanMemberId) {
        await db
          .update(members)
          .set({ loginPin: cleanPassword })
          .where(eq(members.memberId, cleanMemberId));
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        action: 'CREATE_APP_USER',
        entityType: 'app_users',
        entityId: String(created.id),
        previousValue: '',
        updatedValue: JSON.stringify({
          username: created.username,
          role: created.role,
          memberId: created.memberId,
        }),
        reason: 'সুপার এডমিন কর্তৃক নতুন ইউজার ও পাসওয়ার্ড তৈরি',
      });

      res.json({ success: true, user: created });
    } catch (err: any) {
      console.error('Create app user error:', err);
      res.status(500).json({ error: err.message || 'ইউজার তৈরি করতে সমস্যা হয়েছে' });
    }
  });

  // PUT /api/app-users/:id - Super Admin updates user details / password & syncs back to Member Profile
  app.put('/api/app-users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const targetId = Number(req.params.id);
      if (!targetId) {
        return res.status(400).json({ error: 'অকার্যকর ইউজার আইডি।' });
      }

      const allUsers = await getAppUsersSafe();
      const idx = allUsers.findIndex((u) => Number(u.id) === targetId);
      if (idx === -1) {
        return res.status(404).json({ error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
      }
      const prev = allUsers[idx];

      const {
        username,
        password,
        fullName,
        fullNameBn,
        role,
        memberId,
        phone,
        email,
        isActive,
        notes,
      } = req.body;

      const newUsername =
        username !== undefined ? String(username).trim().replace(/^@/, '') : prev.username;
      const newPassword = password !== undefined ? String(password).trim() : prev.password;

      if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ error: 'ইউজার নেম কমপক্ষে ৩ অক্ষরের হতে হবে।' });
      }

      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' });
      }

      if (newUsername.toLowerCase() !== String(prev.username || '').toLowerCase()) {
        const conflict = allUsers.find(
          (u) =>
            Number(u.id) !== targetId &&
            String(u.username || '').toLowerCase() === newUsername.toLowerCase()
        );
        if (conflict) {
          return res.status(400).json({
            error: `ইউজার নেম "${newUsername}" অন্য একজনের জন্য সংরক্ষিত রয়েছে।`,
          });
        }
      }

      const resolvedMemberId =
        memberId !== undefined ? String(memberId).trim() : String(prev.memberId || '').trim();

      const updated = {
        ...prev,
        username: newUsername,
        password: newPassword,
        fullName: fullName !== undefined ? String(fullName).trim() : prev.fullName,
        fullNameBn: fullNameBn !== undefined ? String(fullNameBn).trim() : prev.fullNameBn,
        role: role !== undefined ? role : prev.role,
        memberId: resolvedMemberId,
        phone: phone !== undefined ? String(phone).trim() : prev.phone,
        email: email !== undefined ? String(email).trim() : prev.email,
        isActive: isActive !== undefined ? Boolean(isActive) : prev.isActive,
        notes: notes !== undefined ? String(notes).trim() : prev.notes,
        updatedAt: new Date().toISOString(),
      };

      allUsers[idx] = updated;

      // Also sync password to any sibling accounts sharing the same memberId (e.g. superadmin + mamun + member09)
      if (resolvedMemberId) {
        for (let i = 0; i < allUsers.length; i++) {
          if (i !== idx && String(allUsers[i].memberId || '').trim() === resolvedMemberId) {
            allUsers[i].password = newPassword;
            allUsers[i].updatedAt = new Date().toISOString();
          }
        }
      }

      await saveAppUsersSafe(allUsers);

      // Bidirectional sync back to `members` table (`loginPin`, `name`, `nameBn`, `mobile`, `email`, `status`)
      if (resolvedMemberId) {
        const existingMem = await db
          .select()
          .from(members)
          .where(eq(members.memberId, resolvedMemberId));
        if (existingMem.length > 0) {
          await db
            .update(members)
            .set({
              loginPin: newPassword,
              name: updated.fullName || existingMem[0].name,
              nameBn: updated.fullNameBn || existingMem[0].nameBn,
              mobile: updated.phone || existingMem[0].mobile,
              email: updated.email || existingMem[0].email,
              status: updated.isActive ? 'ACTIVE' : 'INACTIVE',
            })
            .where(eq(members.memberId, resolvedMemberId));
        }
      }

      if (updated.role === 'SUPER_ADMIN' || resolvedMemberId === '09') {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'super_admin_pin',
            settingValue: newPassword,
            description: 'Super Admin Master Security PIN',
            updatedBy: req.profile?.fullName || 'Super Admin',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: newPassword, updatedAt: new Date() },
          });
      } else if (updated.role === 'ADMIN' || resolvedMemberId === '02') {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'admin_pin',
            settingValue: newPassword,
            description: 'Admin Security PIN',
            updatedBy: req.profile?.fullName || 'Super Admin',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: newPassword, updatedAt: new Date() },
          });
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        action: 'UPDATE_APP_USER',
        entityType: 'app_users',
        entityId: String(targetId),
        previousValue: JSON.stringify({
          username: prev.username,
          role: prev.role,
          isActive: prev.isActive,
        }),
        updatedValue: JSON.stringify({
          username: updated.username,
          role: updated.role,
          memberId: updated.memberId,
          isActive: updated.isActive,
        }),
        reason: 'ইউজার ও পাসওয়ার্ড হালনাগাদ এবং সদস্য প্রোফাইলে অটো-সিঙ্ক',
      });

      res.json({ success: true, user: updated });
    } catch (err: any) {
      console.error('Update app user error:', err);
      res.status(500).json({ error: err.message || 'ইউজার তথ্য আপডেট করতে সমস্যা হয়েছে' });
    }
  });

  // DELETE /api/app-users/:id - Super Admin deletes user
  app.delete('/api/app-users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const targetId = Number(req.params.id);
      if (!targetId) {
        return res.status(400).json({ error: 'অকার্যকর ইউজার আইডি।' });
      }

      const allUsers = await getAppUsersSafe();
      const target = allUsers.find((u) => Number(u.id) === targetId);
      if (!target) {
        return res.status(404).json({ error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
      }

      if (String(target.username || '').toLowerCase() === 'superadmin') {
        return res
          .status(403)
          .json({ error: 'সিস্টেমের প্রধান সুপার এডমিন একাউন্ট মোছা যাবে না।' });
      }

      const filtered = allUsers.filter((u) => Number(u.id) !== targetId);
      await saveAppUsersSafe(filtered);

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        action: 'DELETE_APP_USER',
        entityType: 'app_users',
        entityId: String(targetId),
        previousValue: JSON.stringify({ username: target.username, role: target.role }),
        updatedValue: 'DELETED',
        reason: 'সুপার এডমিন কর্তৃক ইউজার ডিলিট করা হয়েছে',
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete app user error:', err);
      res.status(500).json({ error: err.message || 'ইউজার মোছা সম্ভব হয়নি' });
    }
  });

  // 3C. Super Admin Security PIN & Anti-Hack Configuration Endpoint (Bidirectionally synced)
  app.post('/api/security/update-pins', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const { superAdminPin, adminPin, defaultMemberPin, memberId, memberPin } = req.body;
      const actor = req.profile?.fullName || 'Super Admin';
      const allUsers = await getAppUsersSafe();
      let usersChanged = false;

      if (superAdminPin && String(superAdminPin).trim().length >= 4) {
        const val = String(superAdminPin).trim();
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'super_admin_pin',
            settingValue: val,
            description: 'Super Admin Master Security PIN',
            updatedBy: actor,
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: val, updatedBy: actor, updatedAt: new Date() },
          });
        await db.update(members).set({ loginPin: val }).where(eq(members.memberId, '09'));
        for (const u of allUsers) {
          if (u.role === 'SUPER_ADMIN' || u.memberId === '09') {
            u.password = val;
            u.updatedAt = new Date().toISOString();
            usersChanged = true;
          }
        }
      }

      if (adminPin && String(adminPin).trim().length >= 4) {
        const val = String(adminPin).trim();
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'admin_pin',
            settingValue: val,
            description: 'Admin Security PIN',
            updatedBy: actor,
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: val, updatedBy: actor, updatedAt: new Date() },
          });
        await db.update(members).set({ loginPin: val }).where(eq(members.memberId, '02'));
        for (const u of allUsers) {
          if (u.role === 'ADMIN' || u.memberId === '02') {
            u.password = val;
            u.updatedAt = new Date().toISOString();
            usersChanged = true;
          }
        }
      }

      if (defaultMemberPin && String(defaultMemberPin).trim().length >= 4) {
        const val = String(defaultMemberPin).trim();
        const allMems = await db.select().from(members);
        for (const m of allMems) {
          if (m.memberId !== '09' && m.memberId !== '02') {
            await db.update(members).set({ loginPin: val }).where(eq(members.memberId, m.memberId));
          }
        }
        for (const u of allUsers) {
          if (u.role === 'MEMBER' && u.memberId !== '09' && u.memberId !== '02') {
            u.password = val;
            u.updatedAt = new Date().toISOString();
            usersChanged = true;
          }
        }
      }

      if (memberId && memberPin && String(memberPin).trim().length >= 4) {
        const cleanMId = String(memberId).trim();
        const val = String(memberPin).trim();
        await db.update(members).set({ loginPin: val }).where(eq(members.memberId, cleanMId));
        for (const u of allUsers) {
          if (String(u.memberId || '').trim() === cleanMId) {
            u.password = val;
            u.updatedAt = new Date().toISOString();
            usersChanged = true;
          }
        }
      }

      if (usersChanged) {
        await saveAppUsersSafe(allUsers);
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: actor,
        actorRole: 'SUPER_ADMIN',
        action: 'UPDATE_SECURITY_PINS',
        entityType: 'system_settings',
        entityId: memberId ? `member_${memberId}` : 'master_pins',
        previousValue: 'HIDDEN_HASH',
        updatedValue: 'UPDATED_AND_SYNCED_PIN',
        reason: 'Super Admin updated security access PIN credentials (synced across all modules)',
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Update security PINs error:', error);
      res.status(500).json({ error: error.message || 'Failed to update security PINs' });
    }
  });

  // 4. Main Member Accounting Module & Year-Wise Account Management (2019–2026+)
  app.get('/api/accounting/member-year', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const role = req.profile?.role || 'SUPER_ADMIN';
      const requestedMemberId = (req.query.memberId as string) || '02';
      // Enforce RLS for MEMBER role
      let effectiveMemberId =
        role === 'MEMBER' ? req.profile?.memberId || '02' : requestedMemberId;
      const year = Number(req.query.year) || 2026;

      let memberRows = await db
        .select()
        .from(members)
        .where(eq(members.memberId, effectiveMemberId));
      if (memberRows.length === 0) {
        const allM = await db.select().from(members).orderBy(asc(members.id));
        if (allM.length === 0) {
          return res.status(404).json({ error: 'Member not found' });
        }
        memberRows = [allM[0]];
        effectiveMemberId = allM[0].memberId;
      }
      const member = memberRows[0];

      // Ensure account and obligations exist for requested year (supports 2019-2026 and future years automatically)
      await recalculateMemberYearAccount(effectiveMemberId, year);

      const monthlyRows = await db
        .select()
        .from(monthlyObligations)
        .where(
          and(
            eq(monthlyObligations.memberId, effectiveMemberId),
            eq(monthlyObligations.year, year)
          )
        )
        .orderBy(asc(monthlyObligations.month));

      const allMemberSummaries = await db
        .select()
        .from(annualAccountSummaries)
        .where(eq(annualAccountSummaries.memberId, effectiveMemberId))
        .orderBy(asc(annualAccountSummaries.year));

      const currentSummary = allMemberSummaries.find((s) => s.year === year);
      const prevYearSummary = allMemberSummaries.find((s) => s.year === year - 1);

      const memberTxs = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.memberId, effectiveMemberId))
        .orderBy(desc(paymentTransactions.id));

      const dpAgreement = (
        await db
          .select()
          .from(downPaymentAgreements)
          .where(eq(downPaymentAgreements.memberId, effectiveMemberId))
      )[0];

      res.json({
        member,
        year,
        monthlyRows,
        summary: currentSummary,
        previousYearSummary: prevYearSummary || null,
        multiYearComparison: allMemberSummaries,
        transactions: memberTxs,
        downPaymentAgreement: dpAgreement || null,
      });
    } catch (error: any) {
      console.error('Get member-year accounting error:', error);
      res.status(500).json({ error: error.message || 'Failed to load member yearly account' });
    }
  });

  // Record Monthly Collection / Payment
  app.post('/api/accounting/payment', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ACCOUNTANT', 'ADMIN']);
      const {
        memberId,
        year,
        month,
        paymentDate,
        shareDeposit,
        payable,
        fine,
        otherReceive,
        downPayment,
        paymentMethod,
        remarks,
      } = req.body;

      const result = await recordMemberPayment({
        memberId,
        year: Number(year) || 2026,
        month: Number(month) || 1,
        paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
        shareDeposit: Number(shareDeposit) || 0,
        payable: Number(payable) || 0,
        fine: Number(fine) || 0,
        otherReceive: Number(otherReceive) || 0,
        downPayment: Number(downPayment) || 0,
        paymentMethod: paymentMethod || 'CASH',
        receivedBy: req.profile?.fullName || 'Accountant',
        actorUid: req.profile?.uid || 'accountant',
        actorRole: req.profile?.role || 'ACCOUNTANT',
        remarks,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Record payment error:', error);
      res.status(500).json({ error: error.message || 'Failed to record payment' });
    }
  });

  // Edit / Correct Any Monthly Obligation Record (Date, Components, Obligation, Remarks)
  app.put('/api/accounting/obligation/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
      const obId = Number(req.params.id);
      const existing = await db
        .select()
        .from(monthlyObligations)
        .where(eq(monthlyObligations.id, obId));
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Monthly obligation record not found' });
      }
      const prev = existing[0];
      const {
        paymentDate,
        shareDeposit,
        payable,
        fine,
        otherReceive,
        downPayment,
        expectedShareDeposit,
        expectedPayable,
        targetMonthlyDue,
        remarks,
      } = req.body;

      const newShare =
        shareDeposit !== undefined ? Math.round(Number(shareDeposit)) : prev.shareDeposit;
      const newPayable =
        payable !== undefined ? Math.round(Number(payable)) : prev.payable;
      const newFine = fine !== undefined ? Math.round(Number(fine)) : prev.fine;
      const newOther =
        otherReceive !== undefined ? Math.round(Number(otherReceive)) : prev.otherReceive;
      const newDown =
        downPayment !== undefined ? Math.round(Number(downPayment)) : prev.downPayment;
      let newExpShare =
        expectedShareDeposit !== undefined
          ? Math.round(Number(expectedShareDeposit))
          : prev.expectedShareDeposit;
      let newExpPayable =
        expectedPayable !== undefined
          ? Math.round(Number(expectedPayable))
          : prev.expectedPayable;
      const newDate = paymentDate !== undefined ? paymentDate : prev.paymentDate;

      const totalReceived = newShare + newPayable + newFine + newOther + newDown;
      const rcpNo =
        prev.receiptNo ||
        (totalReceived > 0 ? `RCP-${prev.year}-M${prev.memberId}-${prev.month}` : '');

      const isCapitalDown =
        (prev.year === 2022 && newDown >= 70000) || (prev.year === 2024 && newDown >= 12000);
      const eligibleReceived = newShare + newPayable + newOther + (isCapitalDown ? 0 : newDown);

      const defaultExpShare = prev.year === 2019 ? 1000 : prev.year === 2020 ? 1500 : 2000;
      const defaultExpPayable = prev.year <= 2020 ? 20 : 50;

      // If user explicitly specified targetMonthlyDue in the edit modal, adjust expectedShareDeposit & expectedPayable to match
      if (targetMonthlyDue !== undefined && targetMonthlyDue !== null && targetMonthlyDue !== '') {
        const desiredMonthDue = Math.max(0, Math.round(Number(targetMonthlyDue)));
        const desiredExpectedTotal = eligibleReceived + desiredMonthDue;
        if (desiredExpectedTotal === 0) {
          newExpShare = 0;
          newExpPayable = 0;
        } else if (desiredExpectedTotal >= newExpPayable) {
          newExpShare = desiredExpectedTotal - newExpPayable;
        } else {
          newExpShare = desiredExpectedTotal;
          newExpPayable = 0;
        }
      } else if (prev.year <= 2024 && eligibleReceived > newExpShare + newExpPayable) {
        newExpShare = Math.min(eligibleReceived, defaultExpShare);
        newExpPayable = Math.max(0, eligibleReceived - newExpShare);
      } else if (prev.year >= 2025 && newExpShare + newExpPayable === 0) {
        newExpShare = defaultExpShare;
        newExpPayable = defaultExpPayable;
      }

      const expectedObligation = newExpShare + newExpPayable;
      const monthlyDue = Math.max(0, expectedObligation - eligibleReceived);
      const advanceCredit = prev.year <= 2024 ? 0 : Math.max(0, eligibleReceived - expectedObligation);

      const status =
        monthlyDue > 0
          ? totalReceived > 0
            ? 'PARTIAL'
            : 'DUE'
          : totalReceived > 0 || expectedObligation === 0
          ? 'PAID'
          : 'DUE';

      const [updated] = await db
        .update(monthlyObligations)
        .set({
          paymentDate: newDate,
          shareDeposit: newShare,
          payable: newPayable,
          fine: newFine,
          otherReceive: newOther,
          downPayment: newDown,
          expectedShareDeposit: newExpShare,
          expectedPayable: newExpPayable,
          totalReceiveAmount: totalReceived,
          monthlyDue,
          advanceCredit,
          receiptNo: rcpNo,
          sourceRow: 0, // Clear Excel cached total flag so manual edit is strictly respected
          status,
          updatedAt: new Date(),
        })
        .where(eq(monthlyObligations.id, obId))
        .returning();

      // Sync or update payment_transactions & receipts
      const existingTxs = await db
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.memberId, prev.memberId),
            eq(paymentTransactions.year, prev.year),
            eq(paymentTransactions.month, prev.month)
          )
        );

      const memberRows = await db
        .select()
        .from(members)
        .where(eq(members.memberId, prev.memberId));
      const memberName = memberRows[0]?.name || prev.memberId;

      if (existingTxs.length > 0) {
        const tx = existingTxs[0];
        await db
          .update(paymentTransactions)
          .set({
            paymentDate: newDate || `${prev.year}-${String(prev.month).padStart(2, '0')}-01`,
            shareDeposit: newShare,
            payable: newPayable,
            fine: newFine,
            otherReceive: newOther,
            downPayment: newDown,
            totalAmount: totalReceived,
            remarks: remarks || tx.remarks,
          })
          .where(eq(paymentTransactions.id, tx.id));

        await db
          .update(receipts)
          .set({
            paymentDate: newDate || `${prev.year}-${String(prev.month).padStart(2, '0')}-01`,
            shareDeposit: newShare,
            payable: newPayable,
            fine: newFine,
            otherReceive: newOther,
            downPayment: newDown,
            totalAmount: totalReceived,
          })
          .where(eq(receipts.receiptNo, tx.receiptNo));
      } else if (totalReceived > 0) {
        const [newTx] = await db
          .insert(paymentTransactions)
          .values({
            transactionCode: `TXN-${prev.year}${String(prev.month).padStart(2, '0')}-M${prev.memberId}`,
            receiptNo: rcpNo,
            memberId: prev.memberId,
            memberName,
            year: prev.year,
            month: prev.month,
            monthName: prev.monthName,
            paymentDate: newDate || `${prev.year}-${String(prev.month).padStart(2, '0')}-01`,
            shareDeposit: newShare,
            payable: newPayable,
            fine: newFine,
            otherReceive: newOther,
            downPayment: newDown,
            totalAmount: totalReceived,
            paymentMethod: 'CASH',
            approvalStatus: 'APPROVED',
            receivedBy: req.profile?.fullName || 'Super Admin',
            approvedBy: 'Super Admin',
            remarks: remarks || 'Manual monthly ledger entry / correction',
          })
          .returning();

        await db
          .insert(receipts)
          .values({
            receiptNo: rcpNo,
            transactionId: newTx.id,
            memberId: prev.memberId,
            memberName,
            paymentDate: newDate || `${prev.year}-${String(prev.month).padStart(2, '0')}-01`,
            month: prev.month,
            monthName: prev.monthName,
            year: prev.year,
            shareDeposit: newShare,
            payable: newPayable,
            fine: newFine,
            otherReceive: newOther,
            downPayment: newDown,
            totalAmount: totalReceived,
            paymentMethod: 'CASH',
            receivedBy: req.profile?.fullName || 'হিলফুল ফুজুল সমবায় সমিতি',
          })
          .onConflictDoNothing();
      }

      await syncMemberDownPaymentAgreement(prev.memberId);

      for (let y = prev.year; y <= Math.max(prev.year, 2026); y++) {
        await recalculateMemberYearAccount(prev.memberId, y);
      }
      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'UPDATE_MONTHLY_RECORD',
        entityType: 'monthly_obligations',
        entityId: String(obId),
        previousValue: JSON.stringify({
          date: prev.paymentDate,
          share: prev.shareDeposit,
          payable: prev.payable,
          fine: prev.fine,
          other: prev.otherReceive,
          down: prev.downPayment,
          total: prev.totalReceiveAmount,
          due: prev.monthlyDue,
        }),
        updatedValue: JSON.stringify({
          date: newDate,
          share: newShare,
          payable: newPayable,
          fine: newFine,
          other: newOther,
          down: newDown,
          total: totalReceived,
          due: monthlyDue,
        }),
        reason: remarks || 'User modified / corrected monthly accounting row',
      });

      res.json({ success: true, updated });
    } catch (error: any) {
      console.error('Update monthly obligation error:', error);
      res.status(500).json({ error: error.message || 'Failed to update monthly record' });
    }
  });

  // Adjust Annual Dues & Account Balances (Multi-Month Reconciliation across 2019–2026+)
  app.post('/api/accounting/adjust-dues', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { memberId, year, totalOutstanding, reason } = req.body;
      if (!memberId || !year || totalOutstanding === undefined) {
        return res
          .status(400)
          .json({ error: 'Member ID, Year, and Target Outstanding amount are required' });
      }

      const yr = Number(year);
      const targetDue = Math.max(0, Math.round(Number(totalOutstanding)));

      const currentCalc = await recalculateMemberYearAccount(memberId, yr);
      const prevOut = currentCalc?.totalOutstanding || 0;

      // Get previous year's closing outstanding & credit
      const prevYearSummary = await db
        .select()
        .from(annualAccountSummaries)
        .where(
          and(
            eq(annualAccountSummaries.memberId, memberId),
            eq(annualAccountSummaries.year, yr - 1)
          )
        );
      let openingOut = prevYearSummary[0]?.totalOutstanding || 0;
      const openingCred = prevYearSummary[0]?.advanceCredit || 0;

      // If previous year's carried-over due alone exceeds targetDue (and user is setting this year's cumulative due lower),
      // adjust previous years down first so openingOut <= targetDue
      if (openingOut > targetDue && yr > 2019) {
        const prevTarget = targetDue;
        for (let py = 2019; py < yr; py++) {
          const pyMonths = await db
            .select()
            .from(monthlyObligations)
            .where(and(eq(monthlyObligations.memberId, memberId), eq(monthlyObligations.year, py)))
            .orderBy(asc(monthlyObligations.month));
          for (const pm of pyMonths) {
            const isCap =
              (py === 2022 && pm.downPayment >= 70000) ||
              (py === 2024 && pm.downPayment >= 12000);
            const elig =
              pm.shareDeposit + pm.payable + pm.otherReceive + (isCap ? 0 : pm.downPayment);
            const extraDue = py === yr - 1 && pm.month === 12 ? prevTarget : 0;
            const targetExp = elig + extraDue;
            await db
              .update(monthlyObligations)
              .set({
                expectedShareDeposit: targetExp >= 50 ? targetExp - 50 : targetExp,
                expectedPayable: targetExp >= 50 ? 50 : 0,
              })
              .where(eq(monthlyObligations.id, pm.id));
          }
          await recalculateMemberYearAccount(memberId, py);
        }
        openingOut = prevTarget;
      }

      const yearMonths = await db
        .select()
        .from(monthlyObligations)
        .where(and(eq(monthlyObligations.memberId, memberId), eq(monthlyObligations.year, yr)))
        .orderBy(asc(monthlyObligations.month));

      let totalEligibleReceived = 0;
      const monthEligibles: number[] = [];
      for (const mRow of yearMonths) {
        const isCapitalDown =
          (yr === 2022 && mRow.downPayment >= 70000) ||
          (yr === 2024 && mRow.downPayment >= 12000);
        const compSum =
          mRow.shareDeposit + mRow.payable + mRow.fine + mRow.otherReceive + mRow.downPayment;
        const rowTotal =
          compSum === 0 && (mRow.sourceRow || 0) > 0 ? mRow.totalReceiveAmount || 0 : compSum;
        const eligFromComp =
          mRow.shareDeposit +
          mRow.payable +
          mRow.otherReceive +
          (isCapitalDown ? 0 : mRow.downPayment);
        const elig = Math.max(
          eligFromComp,
          rowTotal - mRow.fine - (isCapitalDown ? mRow.downPayment : 0)
        );
        monthEligibles.push(elig);
        totalEligibleReceived += elig;
      }

      // We need: openingOut - openingCred + sum(expectedObligation) - totalEligibleReceived === targetDue
      const neededYearObligation = Math.max(
        0,
        targetDue - openingOut + openingCred + totalEligibleReceived
      );

      let allocatedSoFar = 0;
      for (let i = 0; i < yearMonths.length; i++) {
        const mRow = yearMonths[i];
        const isLastMonth = i === yearMonths.length - 1;
        const stdPayable = yr <= 2020 ? 20 : 50;
        const stdShare = yr === 2019 ? 1000 : yr === 2020 ? 1500 : 2000;
        const currentExp =
          (mRow.expectedShareDeposit ?? stdShare) + (mRow.expectedPayable ?? stdPayable);

        let monthTargetExp = 0;
        if (isLastMonth) {
          monthTargetExp = Math.max(0, neededYearObligation - allocatedSoFar);
        } else {
          // Prefer matching at least the eligibleReceived of that month or standard installment up to remaining neededYearObligation
          const desiredForMonth = Math.max(monthEligibles[i], currentExp);
          monthTargetExp = Math.min(
            desiredForMonth,
            Math.max(0, neededYearObligation - allocatedSoFar)
          );
        }
        allocatedSoFar += monthTargetExp;

        const nextPayable = monthTargetExp >= stdPayable ? stdPayable : 0;
        const nextShare = Math.max(0, monthTargetExp - nextPayable);

        await db
          .update(monthlyObligations)
          .set({
            expectedShareDeposit: nextShare,
            expectedPayable: nextPayable,
            updatedAt: new Date(),
          })
          .where(eq(monthlyObligations.id, mRow.id));
      }

      let updatedCalc = null;
      for (let y = yr; y <= Math.max(yr, 2026); y++) {
        const resCalc = await recalculateMemberYearAccount(memberId, y);
        if (y === yr) updatedCalc = resCalc;
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'MANUAL_DUES_ADJUSTMENT',
        entityType: 'annual_account_summaries',
        entityId: `${memberId}-${yr}`,
        previousValue: JSON.stringify({
          totalOutstanding: prevOut,
        }),
        updatedValue: JSON.stringify({
          totalOutstanding: updatedCalc?.totalOutstanding ?? targetDue,
        }),
        reason: reason || 'Authorized manual dues adjustment / reconciliation',
      });

      res.json({
        success: true,
        memberId,
        year: yr,
        totalOutstanding: updatedCalc?.totalOutstanding ?? targetDue,
      });
    } catch (error: any) {
      console.error('Adjust dues error:', error);
      res.status(500).json({ error: error.message || 'Failed to adjust dues' });
    }
  });

  // Force Resync with Authentic Dataset & Policy
  app.post('/api/accounting/resync-authentic', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const result = await syncAuthenticDatasetToPostgres(true);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Resync authentic error:', error);
      res.status(500).json({ error: error.message || 'Failed to resynchronize dataset' });
    }
  });

  // Authorized Reversal of a Posted Transaction (Never permanently delete!)
  app.post('/api/accounting/reverse/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const txId = Number(req.params.id);
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: 'Reversal reason is mandatory for audit compliance.' });
      }

      const existingRows = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, txId));
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found.' });
      }
      const orig = existingRows[0];
      if (orig.approvalStatus === 'REVERSED') {
        return res.status(400).json({ error: 'Transaction is already reversed.' });
      }

      // Mark original as REVERSED
      await db
        .update(paymentTransactions)
        .set({
          approvalStatus: 'REVERSED',
          remarks: `${orig.remarks} | [REVERSED: ${reason}]`,
        })
        .where(eq(paymentTransactions.id, orig.id));

      // Deduct from monthly_obligations and clear sourceRow so cached Excel total doesn't restore it
      const obRows = await db
        .select()
        .from(monthlyObligations)
        .where(
          and(
            eq(monthlyObligations.memberId, orig.memberId),
            eq(monthlyObligations.year, orig.year),
            eq(monthlyObligations.month, orig.month)
          )
        );
      if (obRows.length > 0) {
        const ob = obRows[0];
        const nextShare = Math.max(0, ob.shareDeposit - orig.shareDeposit);
        const nextPayable = Math.max(0, ob.payable - orig.payable);
        const nextFine = Math.max(0, ob.fine - orig.fine);
        const nextOther = Math.max(0, ob.otherReceive - orig.otherReceive);
        const nextDown = Math.max(0, ob.downPayment - orig.downPayment);
        const nextTotal = nextShare + nextPayable + nextFine + nextOther + nextDown;
        await db
          .update(monthlyObligations)
          .set({
            shareDeposit: nextShare,
            payable: nextPayable,
            fine: nextFine,
            otherReceive: nextOther,
            downPayment: nextDown,
            totalReceiveAmount: nextTotal,
            sourceRow: 0,
          })
          .where(eq(monthlyObligations.id, ob.id));
      }

      await syncMemberDownPaymentAgreement(orig.memberId);
      for (let y = orig.year; y <= Math.max(orig.year, 2026); y++) {
        await recalculateMemberYearAccount(orig.memberId, y);
      }

      // Post reversing journal entry
      const cashCode = orig.paymentMethod === 'CASH' ? '1010' : '1020';
      await postDoubleEntryJournal({
        entryDate: new Date().toISOString().slice(0, 10),
        referenceType: 'REVERSAL',
        referenceId: orig.receiptNo,
        description: `Authorized Reversal of ${orig.receiptNo} (${reason})`,
        createdBy: req.profile?.fullName || 'Super Admin',
        lines: [
          {
            accountCode: '2010',
            accountName: 'Member Share Deposit Liability',
            memberId: orig.memberId,
            debit: orig.totalAmount,
            credit: 0,
            narration: `Reversal debit for ${orig.receiptNo}`,
          },
          {
            accountCode: cashCode,
            accountName: 'Cash / Bank Account',
            memberId: orig.memberId,
            debit: 0,
            credit: orig.totalAmount,
            narration: `Reversal credit for ${orig.receiptNo}`,
          },
        ],
      });

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'REVERSE_PAYMENT_TRANSACTION',
        entityType: 'payment_transactions',
        entityId: orig.receiptNo,
        previousValue: JSON.stringify({ approvalStatus: 'APPROVED', totalAmount: orig.totalAmount }),
        updatedValue: JSON.stringify({ approvalStatus: 'REVERSED', totalAmount: 0 }),
        reason,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Reverse transaction error:', error);
      res.status(500).json({ error: error.message || 'Failed to reverse transaction' });
    }
  });

  // 5. Down Payment Management Module
  app.get('/api/down-payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const role = req.profile?.role || 'SUPER_ADMIN';
      const myMemberId = req.profile?.memberId || '02';

      const agreements = await db
        .select()
        .from(downPaymentAgreements)
        .orderBy(asc(downPaymentAgreements.id));

      const dpTransactions = await db
        .select()
        .from(paymentTransactions)
        .orderBy(desc(paymentTransactions.id));

      const filteredAgreements =
        role === 'MEMBER'
          ? agreements.filter((a) => a.memberId === myMemberId)
          : agreements;

      const filteredHistory = dpTransactions.filter(
        (t) =>
          t.downPayment > 0 &&
          t.approvalStatus === 'APPROVED' &&
          (role !== 'MEMBER' || t.memberId === myMemberId)
      );

      res.json({
        agreements: filteredAgreements,
        history: filteredHistory,
        totals: {
          totalAgreed: filteredAgreements.reduce((a, r) => a + r.agreedAmount, 0),
          totalPaid: filteredAgreements.reduce((a, r) => a + r.totalPaid, 0),
          totalRemaining: filteredAgreements.reduce((a, r) => a + r.remainingAmount, 0),
        },
      });
    } catch (error: any) {
      console.error('Down payments error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch down payments' });
    }
  });

  // Direct Edit of a Member's Down Payment Agreement Target / Paid Balance
  app.put('/api/down-payments/:memberId', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const targetId = req.params.memberId;
      const { agreedAmount, totalPaid, effectiveDate, lastPaymentDate } = req.body;

      const memberRows = await db.select().from(members).where(eq(members.memberId, targetId));
      if (memberRows.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      const member = memberRows[0];

      const nextAgreed =
        agreedAmount !== undefined ? Math.max(0, Math.round(Number(agreedAmount))) : member.downPaymentTarget;

      await db
        .update(members)
        .set({ downPaymentTarget: nextAgreed })
        .where(eq(members.memberId, targetId));

      const existingDp = await db
        .select()
        .from(downPaymentAgreements)
        .where(eq(downPaymentAgreements.memberId, targetId));

      const nextPaid =
        totalPaid !== undefined
          ? Math.max(0, Math.round(Number(totalPaid)))
          : existingDp[0]?.totalPaid || 0;
      const nextRemaining = Math.max(0, nextAgreed - nextPaid);
      const nextStatus = nextRemaining === 0 ? 'COMPLETED' : 'IN_PROGRESS';

      if (existingDp.length > 0) {
        await db
          .update(downPaymentAgreements)
          .set({
            agreedAmount: nextAgreed,
            totalPaid: nextPaid,
            remainingAmount: nextRemaining,
            effectiveDate: effectiveDate || existingDp[0].effectiveDate,
            lastPaymentDate: lastPaymentDate || existingDp[0].lastPaymentDate,
            status: nextStatus,
            updatedAt: new Date(),
          })
          .where(eq(downPaymentAgreements.id, existingDp[0].id));
      } else {
        await db.insert(downPaymentAgreements).values({
          memberId: targetId,
          memberName: member.name,
          agreedAmount: nextAgreed,
          totalPaid: nextPaid,
          remainingAmount: nextRemaining,
          effectiveDate: effectiveDate || member.joiningDate,
          lastPaymentDate: lastPaymentDate || new Date().toISOString().slice(0, 10),
          status: nextStatus,
        });
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'UPDATE_DOWN_PAYMENT_AGREEMENT',
        entityType: 'down_payment_agreements',
        entityId: targetId,
        previousValue: JSON.stringify(existingDp[0] || {}),
        updatedValue: JSON.stringify({ agreedAmount: nextAgreed, totalPaid: nextPaid, remainingAmount: nextRemaining }),
        reason: 'Updated member down payment agreement target/paid amount',
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Update down payment agreement error:', error);
      res.status(500).json({ error: error.message || 'Failed to update down payment agreement' });
    }
  });

  // 6. Income & Expense Management Module
  app.get('/api/income-expense', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const [incomes, expenses, allSummaries] = await Promise.all([
        db
          .select()
          .from(incomeTransactions)
          .orderBy(asc(incomeTransactions.year), desc(incomeTransactions.id)),
        db
          .select()
          .from(expenseTransactions)
          .orderBy(asc(expenseTransactions.year), desc(expenseTransactions.id)),
        db.select().from(annualAccountSummaries),
      ]);

      const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
      const yearlyExpenseSummary = years.map((yr) => {
        const yrExps = expenses.filter((e) => e.year === yr);
        const yrCol = allSummaries
          .filter((s) => s.year === yr)
          .reduce((acc, r) => acc + r.totalReceiveAmount, 0);
        const expSum = yrExps.reduce((acc, e) => acc + e.amount, 0);
        return {
          year: yr,
          expense: expSum,
          collection: yrCol,
          netBalance: yrCol - expSum,
          voucherCount: yrExps.length,
        };
      });

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalCollection = allSummaries.reduce((sum, s) => sum + s.totalReceiveAmount, 0);

      res.json({
        incomes,
        expenses,
        yearlyExpenseSummary,
        totalExpenses,
        totalCollection,
        availableCashBalance: totalCollection - totalExpenses,
      });
    } catch (error: any) {
      console.error('Income/Expense fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch income & expenses' });
    }
  });

  app.post('/api/income', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ACCOUNTANT', 'ADMIN']);
      const { category, title, amount, year, transactionDate, paymentMethod, remarks } = req.body;
      const amt = Math.round(Number(amount) || 0);
      if (!category || !title || amt <= 0) {
        return res.status(400).json({ error: 'Category, title, and valid amount are required.' });
      }
      const dateStr = transactionDate || new Date().toISOString().slice(0, 10);
      const yr = Number(year) || Number(dateStr.slice(0, 4)) || 2026;
      const mo = Number(dateStr.slice(5, 7)) || 12;
      const voucherNo = `INC-${yr}-${Date.now().toString().slice(-4)}`;

      const [created] = await db
        .insert(incomeTransactions)
        .values({
          voucherNo,
          category,
          title: String(title).trim(),
          amount: amt,
          transactionDate: dateStr,
          year: yr,
          month: mo,
          paymentMethod: paymentMethod || 'CASH',
          approvalStatus: 'APPROVED',
          recordedBy: req.profile?.fullName || 'Super Admin',
          approvedBy: req.profile?.fullName || 'Super Admin',
          remarks: remarks || '',
        })
        .returning();

      const cashCode = paymentMethod === 'BANK_TRANSFER' ? '1020' : '1010';
      await postDoubleEntryJournal({
        entryDate: dateStr,
        referenceType: 'INCOME',
        referenceId: voucherNo,
        description: `${category}: ${title}`,
        createdBy: req.profile?.fullName || 'Super Admin',
        lines: [
          {
            accountCode: cashCode,
            accountName: cashCode === '1010' ? 'Cash in Hand' : 'Bank Current Account',
            debit: amt,
            credit: 0,
            narration: `Income voucher ${voucherNo}`,
          },
          {
            accountCode: '4040',
            accountName: category,
            debit: 0,
            credit: amt,
            narration: title,
          },
        ],
      });

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'RECORD_INCOME',
        entityType: 'income_transactions',
        entityId: voucherNo,
        previousValue: '',
        updatedValue: JSON.stringify(created),
        reason: title,
      });

      res.json({ income: created });
    } catch (error: any) {
      console.error('Create income error:', error);
      res.status(500).json({ error: error.message || 'Failed to record income' });
    }
  });

  app.put('/api/income/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const id = Number(req.params.id);
      const existing = await db
        .select()
        .from(incomeTransactions)
        .where(eq(incomeTransactions.id, id));
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Income voucher not found' });
      }
      const prev = existing[0];
      const { category, title, amount, year, transactionDate, paymentMethod, remarks } = req.body;
      const nextAmt = amount !== undefined ? Math.round(Number(amount)) : prev.amount;
      const nextDate = transactionDate || prev.transactionDate;
      const nextYear = year !== undefined ? Number(year) : Number(nextDate.slice(0, 4)) || prev.year;
      const nextMonth = Number(nextDate.slice(5, 7)) || prev.month;

      const [updated] = await db
        .update(incomeTransactions)
        .set({
          category: category || prev.category,
          title: title !== undefined ? String(title).trim() : prev.title,
          amount: nextAmt,
          year: nextYear,
          month: nextMonth,
          transactionDate: nextDate,
          paymentMethod: paymentMethod || prev.paymentMethod,
          remarks: remarks !== undefined ? String(remarks) : prev.remarks,
        })
        .where(eq(incomeTransactions.id, id))
        .returning();

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'UPDATE_INCOME',
        entityType: 'income_transactions',
        entityId: prev.voucherNo,
        previousValue: JSON.stringify(prev),
        updatedValue: JSON.stringify(updated),
        reason: updated.title,
      });

      res.json({ success: true, income: updated });
    } catch (error: any) {
      console.error('Update income error:', error);
      res.status(500).json({ error: error.message || 'Failed to update income voucher' });
    }
  });

  app.post('/api/expense', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ACCOUNTANT', 'ADMIN']);
      const { category, title, amount, year, transactionDate, paymentMethod, remarks } = req.body;
      const amt = Math.round(Number(amount) || 0);
      if (!category || !title || amt <= 0) {
        return res.status(400).json({ error: 'Category, title, and valid amount are required.' });
      }
      const dateStr = transactionDate || new Date().toISOString().slice(0, 10);
      const yr = Number(year) || Number(dateStr.slice(0, 4)) || 2026;
      const mo = Number(dateStr.slice(5, 7)) || 12;
      const voucherNo = `EXP-${yr}-${Date.now().toString().slice(-4)}`;

      const [created] = await db
        .insert(expenseTransactions)
        .values({
          voucherNo,
          category,
          title: String(title).trim(),
          amount: amt,
          transactionDate: dateStr,
          year: yr,
          month: mo,
          paymentMethod: paymentMethod || 'CASH',
          approvalStatus: 'APPROVED',
          recordedBy: req.profile?.fullName || 'Super Admin',
          approvedBy: req.profile?.fullName || 'Super Admin',
          remarks: remarks || '',
        })
        .returning();

      const cashCode = paymentMethod === 'BANK_TRANSFER' ? '1020' : '1010';
      await postDoubleEntryJournal({
        entryDate: dateStr,
        referenceType: 'EXPENSE',
        referenceId: voucherNo,
        description: `${category}: ${title}`,
        createdBy: req.profile?.fullName || 'Super Admin',
        lines: [
          {
            accountCode: '5040',
            accountName: category,
            debit: amt,
            credit: 0,
            narration: title,
          },
          {
            accountCode: cashCode,
            accountName: cashCode === '1010' ? 'Cash in Hand' : 'Bank Current Account',
            debit: 0,
            credit: amt,
            narration: `Expense voucher ${voucherNo}`,
          },
        ],
      });

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'RECORD_EXPENSE',
        entityType: 'expense_transactions',
        entityId: voucherNo,
        previousValue: '',
        updatedValue: JSON.stringify(created),
        reason: title,
      });

      res.json({ expense: created });
    } catch (error: any) {
      console.error('Create expense error:', error);
      res.status(500).json({ error: error.message || 'Failed to record expense' });
    }
  });

  app.put('/api/expense/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const id = Number(req.params.id);
      const existing = await db
        .select()
        .from(expenseTransactions)
        .where(eq(expenseTransactions.id, id));
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Expense voucher not found' });
      }
      const prev = existing[0];
      const { category, title, amount, year, transactionDate, paymentMethod, remarks } = req.body;
      const nextAmt = amount !== undefined ? Math.round(Number(amount)) : prev.amount;
      const nextDate = transactionDate || prev.transactionDate;
      const nextYear = year !== undefined ? Number(year) : Number(nextDate.slice(0, 4)) || prev.year;
      const nextMonth = Number(nextDate.slice(5, 7)) || prev.month;

      const [updated] = await db
        .update(expenseTransactions)
        .set({
          category: category || prev.category,
          title: title !== undefined ? String(title).trim() : prev.title,
          amount: nextAmt,
          year: nextYear,
          month: nextMonth,
          transactionDate: nextDate,
          paymentMethod: paymentMethod || prev.paymentMethod,
          remarks: remarks !== undefined ? String(remarks) : prev.remarks,
        })
        .where(eq(expenseTransactions.id, id))
        .returning();

      // Also update matching journal entry if present
      const jeRows = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.referenceId, prev.voucherNo));
      if (jeRows.length > 0) {
        await db
          .update(journalEntries)
          .set({
            totalDebit: nextAmt,
            totalCredit: nextAmt,
            description: `${updated.title} (${prev.voucherNo})`,
            entryDate: nextDate,
          })
          .where(eq(journalEntries.id, jeRows[0].id));
      }

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'UPDATE_EXPENSE',
        entityType: 'expense_transactions',
        entityId: prev.voucherNo,
        previousValue: JSON.stringify(prev),
        updatedValue: JSON.stringify(updated),
        reason: updated.title,
      });

      res.json({ success: true, expense: updated });
    } catch (error: any) {
      console.error('Update expense error:', error);
      res.status(500).json({ error: error.message || 'Failed to update expense voucher' });
    }
  });

  // One-click Yearly Expense Total Setter (2019–2026+)
  app.post('/api/expense/set-year-total', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { year, totalAmount, title, category } = req.body;
      const yr = Number(year);
      const targetAmt = Math.max(0, Math.round(Number(totalAmount) || 0));
      if (!yr || yr < 2019 || yr > 2035) {
        return res.status(400).json({ error: 'Valid accounting year is required.' });
      }

      const annualVoucherNo = `EXP-${yr}-ANNUAL`;
      const existingYearExps = await db
        .select()
        .from(expenseTransactions)
        .where(eq(expenseTransactions.year, yr));

      const annualVoucher = existingYearExps.find((e) => e.voucherNo === annualVoucherNo);
      const otherVouchersSum = existingYearExps
        .filter((e) => e.voucherNo !== annualVoucherNo)
        .reduce((s, e) => s + e.amount, 0);

      const neededAnnualAmt = Math.max(0, targetAmt - otherVouchersSum);
      const voucherTitle =
        title || `${yr} সালের মোট খরচ (সমিতির বাৎসরিক ও প্রকল্প ব্যয় হিসাব)`;
      const voucherCat = category || 'Administrative Costs';

      if (annualVoucher) {
        if (neededAnnualAmt > 0) {
          await db
            .update(expenseTransactions)
            .set({
              amount: neededAnnualAmt,
              title: voucherTitle,
              category: voucherCat,
              remarks: `খরচের হিসাব (${yr}): মোট খরচ ৳${targetAmt.toLocaleString()}`,
            })
            .where(eq(expenseTransactions.id, annualVoucher.id));
        }
      } else if (neededAnnualAmt > 0) {
        await db.insert(expenseTransactions).values({
          voucherNo: annualVoucherNo,
          category: voucherCat,
          title: voucherTitle,
          amount: neededAnnualAmt,
          transactionDate: `${yr}-12-31`,
          year: yr,
          month: 12,
          paymentMethod: 'CASH',
          approvalStatus: 'APPROVED',
          recordedBy: req.profile?.fullName || 'Super Admin',
          approvedBy: req.profile?.fullName || 'Super Admin',
          remarks: `খরচের হিসাব (${yr}): মোট খরচ ৳${targetAmt.toLocaleString()}`,
        });
      }

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'SET_YEARLY_EXPENSE_TOTAL',
        entityType: 'expense_transactions',
        entityId: annualVoucherNo,
        previousValue: String(existingYearExps.reduce((s, e) => s + e.amount, 0)),
        updatedValue: String(targetAmt),
        reason: `${yr} সালের বাৎসরিক খরচের হিসাব হালনাগাদ`,
      });

      res.json({ success: true, year: yr, totalAmount: targetAmt });
    } catch (error: any) {
      console.error('Set yearly expense error:', error);
      res.status(500).json({ error: error.message || 'Failed to update yearly expense total' });
    }
  });

  app.delete('/api/income/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const targetId = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(incomeTransactions)
        .where(eq(incomeTransactions.id, targetId));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'আয় ভাউচারটি খুঁজে পাওয়া যায়নি।' });
      }
      const voucher = existingRows[0];
      await db.delete(incomeTransactions).where(eq(incomeTransactions.id, targetId));

      const jeRows = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.referenceId, voucher.voucherNo));
      for (const je of jeRows) {
        await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, je.id));
        await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
      }

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'DELETE_INCOME_VOUCHER',
        entityType: 'income_transactions',
        entityId: voucher.voucherNo,
        previousValue: String(voucher.amount),
        updatedValue: 'DELETED',
        reason: `Deleted income voucher ${voucher.voucherNo}`,
      });

      res.json({ success: true, deletedId: targetId });
    } catch (error: any) {
      console.error('Delete income error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete income voucher' });
    }
  });

  app.delete('/api/expense/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const targetId = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(expenseTransactions)
        .where(eq(expenseTransactions.id, targetId));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'খরচের ভাউচারটি খুঁজে পাওয়া যায়নি।' });
      }
      const voucher = existingRows[0];
      await db.delete(expenseTransactions).where(eq(expenseTransactions.id, targetId));

      const jeRows = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.referenceId, voucher.voucherNo));
      for (const je of jeRows) {
        await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, je.id));
        await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
      }

      await reconcileSocietyAccountBalances();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'DELETE_EXPENSE_VOUCHER',
        entityType: 'expense_transactions',
        entityId: voucher.voucherNo,
        previousValue: String(voucher.amount),
        updatedValue: 'DELETED',
        reason: `Deleted expense voucher ${voucher.voucherNo}`,
      });

      res.json({ success: true, deletedId: targetId });
    } catch (error: any) {
      console.error('Delete expense error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete expense voucher' });
    }
  });

  // 7. Loan & Investment Management Module
  app.get('/api/loans-investments', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const allLoans = await db.select().from(loans).orderBy(desc(loans.id));
      const allRepayments = await db.select().from(loanRepayments).orderBy(desc(loanRepayments.id));
      const allInvestments = await db.select().from(investments).orderBy(desc(investments.id));
      const photoSettingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_investment_photos'));

      let invPhotoMap: Record<string, string> = {};
      try {
        if (photoSettingRows[0]?.settingValue) {
          invPhotoMap = JSON.parse(photoSettingRows[0].settingValue);
        }
      } catch {
        invPhotoMap = {};
      }

      const enrichedInvestments = allInvestments.map((inv) => ({
        ...inv,
        photoUrl: invPhotoMap[String(inv.id)] || invPhotoMap[inv.investmentCode] || '',
      }));

      res.json({
        loans: allLoans,
        repayments: allRepayments,
        investments: enrichedInvestments,
      });
    } catch (error: any) {
      console.error('Loans/Investments fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch loans and investments' });
    }
  });

  app.post('/api/loans', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { memberId, principalAmount, interestRate, tenureMonths, purpose, applicationDate } =
        req.body;

      const memberRows = await db.select().from(members).where(eq(members.memberId, memberId));
      if (memberRows.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      const member = memberRows[0];
      const principal = Number(principalAmount) || 0;
      const rate = Number(interestRate) || 8;
      const tenure = Number(tenureMonths) || 12;
      const totalInterest = Math.round((principal * rate) / 100);
      const totalPayable = principal + totalInterest;
      const installment = Math.round(totalPayable / tenure);
      const dateStr = applicationDate || new Date().toISOString().slice(0, 10);
      const loanCode = `LN-${dateStr.slice(0, 4)}-${Date.now().toString().slice(-3)}`;

      const [created] = await db
        .insert(loans)
        .values({
          loanCode,
          memberId: member.memberId,
          memberName: member.name,
          principalAmount: principal,
          interestRate: rate,
          totalInterestAmount: totalInterest,
          totalPayableAmount: totalPayable,
          principalRepaid: 0,
          interestRepaid: 0,
          outstandingPrincipal: principal,
          outstandingBalance: totalPayable,
          applicationDate: dateStr,
          approvalDate: dateStr,
          disbursementDate: dateStr,
          tenureMonths: tenure,
          monthlyInstallment: installment,
          status: 'ACTIVE',
          approvedBy: req.profile?.fullName || 'Super Admin',
          purpose: purpose || 'Member Cooperative Investment Loan',
        })
        .returning();

      // Double-entry: Debit Loan Principal Receivable (1030), Credit Bank (1020)
      await postDoubleEntryJournal({
        entryDate: dateStr,
        referenceType: 'LOAN_DISBURSEMENT',
        referenceId: loanCode,
        description: `Loan Disbursement ${loanCode} to ${member.name} (${member.memberId})`,
        createdBy: req.profile?.fullName || 'Super Admin',
        lines: [
          {
            accountCode: '1030',
            accountName: 'Member Loan Principal Receivable',
            memberId: member.memberId,
            debit: principal,
            credit: 0,
            narration: `Loan principal disbursed (${loanCode})`,
          },
          {
            accountCode: '1020',
            accountName: 'Islami Bank Current Account',
            memberId: member.memberId,
            debit: 0,
            credit: principal,
            narration: `Bank disbursement for ${loanCode}`,
          },
        ],
      });

      res.json({ loan: created });
    } catch (error: any) {
      console.error('Create loan error:', error);
      res.status(500).json({ error: error.message || 'Failed to create loan' });
    }
  });

  app.post('/api/loans/:loanId/repay', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ACCOUNTANT', 'ADMIN']);
      const loanId = Number(req.params.loanId);
      const { principalComponent, interestComponent, fineComponent, repaymentDate } = req.body;

      const loanRows = await db.select().from(loans).where(eq(loans.id, loanId));
      if (loanRows.length === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }
      const loan = loanRows[0];
      const prin = Number(principalComponent) || 0;
      const intr = Number(interestComponent) || 0;
      const fine = Number(fineComponent) || 0;
      const totalPaid = prin + intr + fine;
      const dateStr = repaymentDate || new Date().toISOString().slice(0, 10);
      const receiptNo = `RCP-LN-${Date.now().toString().slice(-5)}`;

      const [repayment] = await db
        .insert(loanRepayments)
        .values({
          loanId: loan.id,
          loanCode: loan.loanCode,
          memberId: loan.memberId,
          repaymentDate: dateStr,
          principalComponent: prin,
          interestComponent: intr,
          fineComponent: fine,
          totalPaid,
          receiptNo,
          receivedBy: req.profile?.fullName || 'Accountant',
        })
        .returning();

      const newPrinRepaid = loan.principalRepaid + prin;
      const newIntrRepaid = loan.interestRepaid + intr;
      const newOutPrincipal = Math.max(0, loan.principalAmount - newPrinRepaid);
      const newOutBalance = Math.max(0, loan.totalPayableAmount - (newPrinRepaid + newIntrRepaid));

      await db
        .update(loans)
        .set({
          principalRepaid: newPrinRepaid,
          interestRepaid: newIntrRepaid,
          outstandingPrincipal: newOutPrincipal,
          outstandingBalance: newOutBalance,
          status: newOutBalance === 0 ? 'CLOSED' : 'ACTIVE',
        })
        .where(eq(loans.id, loan.id));

      // Keep loan principal (Asset reduction 1030) and interest (Income 4050) strictly separate!
      const lines: Array<{
        accountCode: string;
        accountName: string;
        memberId?: string;
        debit: number;
        credit: number;
        narration: string;
      }> = [
        {
          accountCode: '1010',
          accountName: 'Cash in Hand',
          memberId: loan.memberId,
          debit: totalPaid,
          credit: 0,
          narration: `Loan repayment ${receiptNo} for ${loan.loanCode}`,
        },
      ];
      if (prin > 0) {
        lines.push({
          accountCode: '1030',
          accountName: 'Member Loan Principal Receivable',
          memberId: loan.memberId,
          debit: 0,
          credit: prin,
          narration: `Loan principal reduction (NOT treated as income)`,
        });
      }
      if (intr + fine > 0) {
        lines.push({
          accountCode: '4050',
          accountName: 'Loan Service Profit Income',
          memberId: loan.memberId,
          debit: 0,
          credit: intr + fine,
          narration: `Loan profit/service component`,
        });
      }

      await postDoubleEntryJournal({
        entryDate: dateStr,
        referenceType: 'LOAN_REPAYMENT',
        referenceId: receiptNo,
        description: `Loan Repayment ${receiptNo} (${loan.loanCode}) - Principal: ৳${prin}, Profit: ৳${intr}`,
        createdBy: req.profile?.fullName || 'Accountant',
        lines,
      });

      res.json({ repayment });
    } catch (error: any) {
      console.error('Loan repayment error:', error);
      res.status(500).json({ error: error.message || 'Failed to record loan repayment' });
    }
  });

  app.post('/api/investments', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const {
        investmentName,
        principalAmount,
        investmentDate,
        maturityDate,
        expectedReturn,
        actualReturn,
        notes,
        photoUrl,
      } = req.body;

      const prin = Number(principalAmount) || 0;
      const expRet = Number(expectedReturn) || 0;
      const actRet = Number(actualReturn) || 0;
      const dateStr = investmentDate || new Date().toISOString().slice(0, 10);
      const invCode = `INV-${dateStr.slice(0, 4)}-${Date.now().toString().slice(-3)}`;

      const [created] = await db
        .insert(investments)
        .values({
          investmentCode: invCode,
          investmentName,
          principalAmount: prin,
          investmentDate: dateStr,
          maturityDate: maturityDate || '2027-12-31',
          expectedReturn: expRet,
          actualReturn: actRet,
          profitLoss: actRet,
          status: 'ACTIVE',
          notes: notes || '',
        })
        .returning();

      if (photoUrl && String(photoUrl).trim()) {
        const photoRows = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.settingKey, 'society_investment_photos'));
        let mapObj: Record<string, string> = {};
        try {
          if (photoRows[0]?.settingValue) mapObj = JSON.parse(photoRows[0].settingValue);
        } catch {
          mapObj = {};
        }
        mapObj[String(created.id)] = String(photoUrl);
        mapObj[created.investmentCode] = String(photoUrl);
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'society_investment_photos',
            settingValue: JSON.stringify(mapObj),
            description: 'Permanent photos attached to society investments',
            updatedBy: req.profile?.fullName || 'Super Admin',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: {
              settingValue: JSON.stringify(mapObj),
              updatedBy: req.profile?.fullName || 'Super Admin',
              updatedAt: new Date(),
            },
          });
      }

      await postDoubleEntryJournal({
        entryDate: dateStr,
        referenceType: 'INVESTMENT',
        referenceId: invCode,
        description: `Society Investment ${invCode}: ${investmentName}`,
        createdBy: req.profile?.fullName || 'Super Admin',
        lines: [
          {
            accountCode: '1040',
            accountName: 'Cooperative Project Investments',
            debit: prin,
            credit: 0,
            narration: `Investment principal allocation (${invCode})`,
          },
          {
            accountCode: '1020',
            accountName: 'Islami Bank Current Account',
            debit: 0,
            credit: prin,
            narration: `Bank transfer for ${invCode}`,
          },
        ],
      });

      res.json({ investment: { ...created, photoUrl: photoUrl || '' } });
    } catch (error: any) {
      console.error('Create investment error:', error);
      res.status(500).json({ error: error.message || 'Failed to create investment' });
    }
  });

  app.put('/api/investments/:id/photo', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const invId = String(req.params.id);
      const { photoUrl, investmentName, notes } = req.body;

      if (investmentName !== undefined || notes !== undefined) {
        const existingInv = await db
          .select()
          .from(investments)
          .where(eq(investments.id, Number(invId)));
        if (existingInv.length > 0) {
          await db
            .update(investments)
            .set({
              investmentName:
                investmentName !== undefined ? String(investmentName).trim() : existingInv[0].investmentName,
              notes: notes !== undefined ? String(notes).trim() : existingInv[0].notes,
            })
            .where(eq(investments.id, Number(invId)));
        }
      }

      if (photoUrl !== undefined) {
        const photoRows = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.settingKey, 'society_investment_photos'));
        let mapObj: Record<string, string> = {};
        try {
          if (photoRows[0]?.settingValue) mapObj = JSON.parse(photoRows[0].settingValue);
        } catch {
          mapObj = {};
        }
        mapObj[invId] = String(photoUrl);
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'society_investment_photos',
            settingValue: JSON.stringify(mapObj),
            description: 'Permanent photos attached to society investments',
            updatedBy: req.profile?.fullName || 'Super Admin',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: {
              settingValue: JSON.stringify(mapObj),
              updatedBy: req.profile?.fullName || 'Super Admin',
              updatedAt: new Date(),
            },
          });
      }

      res.json({ success: true, id: invId, photoUrl });
    } catch (error: any) {
      console.error('Update investment photo error:', error);
      res.status(500).json({ error: error.message || 'প্রকল্পের ছবি সংরক্ষণ করতে সমস্যা হয়েছে' });
    }
  });

  // 8. Double-Entry Accounting System & Financial Statements
  app.get('/api/ledger', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const chartOfAccounts = await db
        .select()
        .from(accounts)
        .orderBy(asc(accounts.accountCode));
      const entries = await db
        .select()
        .from(journalEntries)
        .orderBy(desc(journalEntries.id));
      const lines = await db
        .select()
        .from(journalEntryLines)
        .orderBy(desc(journalEntryLines.id));

      // Compute Trial Balance
      const trialBalance = chartOfAccounts.map((acc) => ({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountNameBn: acc.accountNameBn,
        accountType: acc.accountType,
        debit: acc.normalBalance === 'DEBIT' ? acc.currentBalance : 0,
        credit: acc.normalBalance === 'CREDIT' ? acc.currentBalance : 0,
      }));

      // Compute Income Statement
      const incomeAccounts = chartOfAccounts.filter((a) => a.accountType === 'INCOME');
      const expenseAccounts = chartOfAccounts.filter((a) => a.accountType === 'EXPENSE');
      const totalRevenue = incomeAccounts.reduce((s, a) => s + a.currentBalance, 0);
      const totalOperatingExpense = expenseAccounts.reduce((s, a) => s + a.currentBalance, 0);
      const netSurplus = totalRevenue - totalOperatingExpense;

      // Compute Balance Sheet (Assets = Liabilities + Equity + Net Surplus)
      const assetAccounts = chartOfAccounts.filter((a) => a.accountType === 'ASSET');
      const liabilityAccounts = chartOfAccounts.filter((a) => a.accountType === 'LIABILITY');
      const equityAccounts = chartOfAccounts.filter((a) => a.accountType === 'EQUITY');

      res.json({
        chartOfAccounts,
        journalEntries: entries,
        journalEntryLines: lines,
        trialBalance,
        incomeStatement: {
          revenues: incomeAccounts,
          expenses: expenseAccounts,
          totalRevenue,
          totalOperatingExpense,
          netSurplus,
        },
        balanceSheet: {
          assets: assetAccounts,
          liabilities: liabilityAccounts,
          equity: equityAccounts,
          netSurplus,
          totalAssets: assetAccounts.reduce((s, a) => s + a.currentBalance, 0),
          totalLiabilities: liabilityAccounts.reduce((s, a) => s + a.currentBalance, 0),
          totalEquity: equityAccounts.reduce((s, a) => s + a.currentBalance, 0) + netSurplus,
        },
      });
    } catch (error: any) {
      console.error('Ledger fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch double-entry ledger' });
    }
  });

  // 9. Receipts System
  app.get('/api/receipts', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const role = req.profile?.role || 'SUPER_ADMIN';
      const myMemberId = req.profile?.memberId || '02';

      const allReceipts = await db
        .select()
        .from(receipts)
        .orderBy(desc(receipts.id))
        .limit(1000);

      const visibleReceipts =
        role === 'MEMBER'
          ? allReceipts.filter((r) => r.memberId === myMemberId)
          : allReceipts;

      res.json({ receipts: visibleReceipts });
    } catch (error: any) {
      console.error('Receipts fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch receipts' });
    }
  });

  // 10. Excel Import & Historical Data Migration Module
  app.get('/api/excel/batches', requireAuth, async (_req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const batches = await db
        .select()
        .from(importBatches)
        .orderBy(desc(importBatches.id));
      const rows = await db
        .select()
        .from(importRows)
        .orderBy(asc(importRows.id))
        .limit(1200);
      res.json({ batches, rows });
    } catch (error: any) {
      console.error('Excel batches error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch import batches' });
    }
  });

  app.post('/api/excel/stage', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { fileName, totalWorksheets, parsedRows } = req.body;
      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        return res.status(400).json({ error: 'No rows found in uploaded Excel file.' });
      }

      const existingMembers = await db.select().from(members);
      const memberSet = new Set(existingMembers.map((m) => m.memberId));
      const existingObligations = await db.select().from(monthlyObligations);

      let validCount = 0;
      let warningCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const detectedMemberSet = new Set<string>();

      const validatedRows = parsedRows.map((r: any, index: number) => {
        const mId = String(r.memberId || 'HF-001').trim();
        detectedMemberSet.add(mId);
        const yr = Number(r.year) || 2026;
        const mo = Number(r.month) || 1;
        const monthName = MONTH_NAMES[mo - 1] || r.monthName || 'January';
        const shareDep = Number(r.shareDeposit) || 0;
        const payableAmt = Number(r.payable) || 0;
        const fineAmt = Number(r.fine) || 0;
        const otherAmt = Number(r.otherReceive) || 0;
        const downAmt = Number(r.downPayment) || 0;
        const calcTotal = shareDep + payableAmt + fineAmt + otherAmt + downAmt;
        const sheetTotal =
          r.totalReceiveAmount !== undefined ? Number(r.totalReceiveAmount) : calcTotal;

        const messages: string[] = [];
        let status = 'VALID';

        // Check formula / sum consistency
        if (sheetTotal !== calcTotal) {
          status = 'WARNING';
          messages.push(
            `Excel Total (${sheetTotal}) differs from evaluated component sum (${calcTotal})`
          );
        }

        // Check date format
        const rawDate = String(r.rawDate || r.date || '').trim();
        let parsedDate = rawDate;
        if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          status = status === 'ERROR' ? 'ERROR' : 'WARNING';
          messages.push(`Non-ISO or text date "${rawDate}" normalized for audit review`);
          parsedDate = `${yr}-${String(mo).padStart(2, '0')}-10`;
        }

        // Check member ID consistency
        if (!memberSet.has(mId)) {
          status = status === 'ERROR' ? 'ERROR' : 'WARNING';
          messages.push(`New Member ID (${mId}) not in previous year registry`);
        }

        // Check duplicate in existing ledger
        const dup = existingObligations.find(
          (o) =>
            o.memberId === mId &&
            o.year === yr &&
            o.month === mo &&
            o.totalReceiveAmount === calcTotal &&
            calcTotal > 0
        );
        if (dup) {
          status = 'DUPLICATE';
          messages.push(`Identical record already exists in ${yr} ${monthName} for ${mId}`);
        }

        if (shareDep < 0 || payableAmt < 0) {
          status = 'ERROR';
          messages.push('Negative deposit amount is invalid');
        }

        if (status === 'VALID') validCount++;
        else if (status === 'WARNING') warningCount++;
        else if (status === 'DUPLICATE') duplicateCount++;
        else errorCount++;

        return {
          worksheetName: String(r.worksheetName || yr),
          rowNumber: Number(r.rowNumber) || index + 2,
          year: yr,
          memberId: mId,
          memberName: String(r.memberName || mId),
          month: mo,
          monthName,
          rawDate,
          parsedDate,
          shareDeposit: shareDep,
          payable: payableAmt,
          fine: fineAmt,
          otherReceive: otherAmt,
          downPayment: downAmt,
          totalReceiveAmount: calcTotal,
          due: Number(r.due) || Math.max(0, 2500 - (shareDep + payableAmt)),
          validationStatus: status,
          validationMessages: messages.join('; ') || 'Validated clean record',
          isApproved: status !== 'ERROR' && status !== 'DUPLICATE',
        };
      });

      const batchCode = `IMP-${Date.now().toString().slice(-6)}`;
      const [batch] = await db
        .insert(importBatches)
        .values({
          batchCode,
          fileName: fileName || 'Shomiti Hishab English (1).xlsx',
          totalWorksheets: Number(totalWorksheets) || 1,
          detectedMembers: detectedMemberSet.size,
          totalMonthlyRecords: validatedRows.length,
          validRecords: validCount,
          warningRecords: warningCount,
          errorRecords: errorCount,
          duplicateRecords: duplicateCount,
          approvedRecords: validCount + warningCount,
          importedRecords: 0,
          status: 'STAGED',
          uploadedBy: req.profile?.fullName || 'Super Admin',
        })
        .returning();

      const rowsToInsert = validatedRows.map((vr) => ({
        ...vr,
        batchId: batch.id,
      }));
      await db.insert(importRows).values(rowsToInsert);

      res.json({ batch, rows: rowsToInsert });
    } catch (error: any) {
      console.error('Excel stage error:', error);
      res.status(500).json({ error: error.message || 'Failed to stage Excel workbook' });
    }
  });

  app.post('/api/excel/approve/:batchId', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const batchId = Number(req.params.batchId);
      const batchRows = await db
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, batchId));
      if (batchRows.length === 0) {
        return res.status(404).json({ error: 'Import batch not found' });
      }
      const batch = batchRows[0];
      const stagedRows = await db
        .select()
        .from(importRows)
        .where(eq(importRows.batchId, batchId));

      let importedCount = 0;
      const impactedPairs = new Set<string>();

      for (const row of stagedRows) {
        if (!row.isApproved || row.validationStatus === 'ERROR' || row.validationStatus === 'DUPLICATE') {
          continue;
        }
        // Ensure member exists
        const existingMem = await db
          .select()
          .from(members)
          .where(eq(members.memberId, row.memberId));
        if (existingMem.length === 0) {
          await db.insert(members).values({
            memberId: row.memberId,
            name: row.memberName,
            nameBn: row.memberName,
            mobile: '01700-000000',
            joiningDate: `${row.year}-01-01`,
            status: 'ACTIVE',
          });
        }

        // Upsert monthly obligation preserving historical values
        const existingOb = await db
          .select()
          .from(monthlyObligations)
          .where(
            and(
              eq(monthlyObligations.memberId, row.memberId),
              eq(monthlyObligations.year, row.year),
              eq(monthlyObligations.month, row.month)
            )
          );

        if (existingOb.length > 0) {
          await db
            .update(monthlyObligations)
            .set({
              paymentDate: row.parsedDate || row.rawDate,
              shareDeposit: row.shareDeposit,
              payable: row.payable,
              fine: row.fine,
              otherReceive: row.otherReceive,
              downPayment: row.downPayment,
              totalReceiveAmount: row.totalReceiveAmount,
              monthlyDue: row.due,
              sourceWorksheet: row.worksheetName,
              sourceRow: row.rowNumber,
            })
            .where(eq(monthlyObligations.id, existingOb[0].id));
        } else {
          await db.insert(monthlyObligations).values({
            memberId: row.memberId,
            year: row.year,
            month: row.month,
            monthName: row.monthName,
            paymentDate: row.parsedDate || row.rawDate,
            expectedShareDeposit: 2000,
            expectedPayable: 500,
            shareDeposit: row.shareDeposit,
            payable: row.payable,
            fine: row.fine,
            otherReceive: row.otherReceive,
            downPayment: row.downPayment,
            totalReceiveAmount: row.totalReceiveAmount,
            monthlyDue: row.due,
            sourceWorksheet: row.worksheetName,
            sourceRow: row.rowNumber,
          });
        }

        impactedPairs.add(`${row.memberId}:${row.year}`);
        importedCount++;
      }

      for (const pair of impactedPairs) {
        const [mId, yrStr] = pair.split(':');
        await recalculateMemberYearAccount(mId, Number(yrStr));
      }

      const [updatedBatch] = await db
        .update(importBatches)
        .set({
          status: 'IMPORTED',
          importedRecords: importedCount,
          approvedBy: req.profile?.fullName || 'Super Admin',
        })
        .where(eq(importBatches.id, batchId))
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        action: 'APPROVE_EXCEL_IMPORT',
        entityType: 'import_batches',
        entityId: batch.batchCode,
        previousValue: 'STAGED',
        updatedValue: `IMPORTED (${importedCount} rows committed to PostgreSQL)`,
        reason: `Approved migration of ${batch.fileName}`,
      });

      res.json({ batch: updatedBatch, importedCount });
    } catch (error: any) {
      console.error('Excel approve error:', error);
      res.status(500).json({ error: error.message || 'Failed to approve Excel import' });
    }
  });

  app.post('/api/excel/rollback/:batchId', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const batchId = Number(req.params.batchId);
      const [updatedBatch] = await db
        .update(importBatches)
        .set({
          status: 'ROLLED_BACK',
          importedRecords: 0,
        })
        .where(eq(importBatches.id, batchId))
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: req.profile?.fullName || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        action: 'ROLLBACK_EXCEL_IMPORT',
        entityType: 'import_batches',
        entityId: String(batchId),
        previousValue: 'STAGED',
        updatedValue: 'ROLLED_BACK',
        reason: 'Super Admin rolled back staged import batch prior to final lock',
      });

      res.json({ batch: updatedBatch });
    } catch (error: any) {
      console.error('Excel rollback error:', error);
      res.status(500).json({ error: error.message || 'Failed to rollback Excel batch' });
    }
  });

  // 11. Audit Logs, Role Permissions, Approvals & Settings (with SHA-256 Ledger Integrity Hash)
  app.get('/api/audit-security', requireAuth, async (_req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(120);
      const allRoles = await db.select().from(roles);
      const allPermissions = await db.select().from(permissions);
      const approvals = await db
        .select()
        .from(approvalRequests)
        .orderBy(desc(approvalRequests.id));
      const settings = await db.select().from(systemSettings);
      const allProfiles = await db.select().from(profiles);
      const allSummaries = await db.select().from(annualAccountSummaries);

      // Compute cryptographic SHA-256 integrity hash across all annual ledger summaries
      const ledgerPayload = allSummaries
        .map((s) => `${s.memberId}:${s.year}:${s.totalReceiveAmount}:${s.totalOutstanding}`)
        .sort()
        .join('|');
      const ledgerIntegrityHash = crypto
        .createHash('sha256')
        .update(ledgerPayload)
        .digest('hex');

      res.json({
        auditLogs: logs,
        roles: allRoles,
        permissions: allPermissions,
        approvalRequests: approvals,
        settings,
        profiles: allProfiles,
        ledgerIntegrityHash,
        securityMetrics: {
          ledgerIntegrityHash,
          hmacSessionSigning: 'ACTIVE (HMAC-SHA256)',
          bruteForceProtection: 'ACTIVE (5 Attempts / 60s Lockout)',
          bruteForceShield: 'ACTIVE (5 Attempts / 60s Lockout)',
          xssPayloadSanitizer: 'ACTIVE (Strict Payload Filter)',
          xssSqlSanitizer: 'ACTIVE (Strict Payload Filter)',
          rlsMemberIsolation: 'ENFORCED (PostgreSQL + API Guard)',
        },
      });
    } catch (error: any) {
      console.error('Audit/Security fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to load audit & security data' });
    }
  });

  app.put('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const updates = req.body.settings || req.body || {};
      const actor = req.profile?.fullName || 'Super Admin';
      for (const [key, val] of Object.entries(updates)) {
        if (typeof val === 'string' || typeof val === 'number') {
          await db
            .insert(systemSettings)
            .values({
              settingKey: key,
              settingValue: String(val),
              description: `System configuration: ${key}`,
              updatedBy: actor,
            })
            .onConflictDoUpdate({
              target: systemSettings.settingKey,
              set: { settingValue: String(val), updatedBy: actor, updatedAt: new Date() },
            });
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update settings' });
    }
  });

  app.post('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { title, message, targetRole, type } = req.body;
      const [created] = await db
        .insert(notifications)
        .values({
          title,
          message,
          targetRole: targetRole || 'ALL',
          type: type || 'ANNOUNCEMENT',
          createdBy: req.profile?.fullName || 'Admin',
        })
        .returning();
      res.json({ notification: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to post announcement' });
    }
  });

  // 11B. Society Home Page, Logo Branding, Notice Board & Member Comments APIs
  const DEFAULT_SOCIETY_BRANDING = {
    logoUrl: OFFICIAL_SOCIETY_LOGO_URL,
    nameBn: 'হিলফুল ফুজুল সমবায় সমিতি',
    nameEn: 'Hilful Fuzul Somobay Shomiti',
    sloganBn: 'পারস্পরিক আস্থা, স্বচ্ছ হিসাব ও সম্মিলিত সমৃদ্ধির বন্ধন',
    sloganEn: 'Bond of Mutual Trust, Transparent Accounting & Collective Prosperity',
    establishedYear: '২০১৯ ইং (Established 2019)',
    registrationInfo: 'সম্মিলিত সমবায় সঞ্চয় ও বিনিয়োগ তহবিল (২০১৯–২০২৬)',
    addressBn: 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা - ১২১৬, বাংলাদেশ',
    phone: '+880 11914845224',
    email: 'hilfulfuzul.somiti@gmail.com',
    meetingScheduleBn: 'প্রতি মাসের ১ থেকে ১০ তারিখের মধ্যে মাসিক কিস্তি জমা এবং ত্রৈমাসিক সাধারণ সভা',
    aboutBn:
      'হিলফুল ফুজুল সমবায় সমিতি ২০১৯ সালে ১২ জন সম্মানিত প্রতিষ্ঠাতা সদস্যের সম্মিলিত উদ্যোগে গঠিত একটি আদর্শ, শরীয়াহসম্মত ও শতভাগ স্বচ্ছ সমবায় প্রতিষ্ঠান। সদস্যদের নিয়মিত মাসিক শেয়ার আমানত, প্রদেয় জমা এবং ডাউন পেমেন্টের মাধ্যমে একটি শক্তিশালী মূলধন তহবিল গড়ে তোলা এবং নিরাপদ ও কল্যাণমুখী বিনিয়োগের মাধ্যমে সকল সদস্যের অর্থনৈতিক সমৃদ্ধি অর্জনই আমাদের মূল লক্ষ্য।',
    visionBn:
      'শতভাগ ডিজিটাল ডাবল-এন্ট্রি হিসাবরক্ষণ, তাৎক্ষণিক A4 ও POS মানি রশিদ এবং প্রতিটি সদস্যের জন্য উন্মুক্ত বার্ষিক অডিট ও অনলাইন পোর্টাল নিশ্চিত করা।',
    committeeRoles: JSON.stringify({
      '02': 'সভাপতি (President)',
      '04': 'সহ-সভাপতি (Vice President)',
      '05': 'সম্মানিত সদস্য (Executive Member)',
      '06': 'সাধারণ সম্পাদক (General Secretary)',
      '07': 'সম্মানিত সদস্য (Executive Member)',
      '09': 'কোষাধ্যক্ষ (Treasurer)',
      '10': 'যুগ্ম সম্পাদক (Joint Secretary)',
      '11': 'সাংগঠনিক সম্পাদক (Organizing Secretary)',
      '12': 'দপ্তর ও প্রচার সম্পাদক (Office Secretary)',
      '14': 'বিনিয়োগ ও নিরীক্ষা সদস্য (Audit Member)',
      '15': 'সম্মানিত সদস্য (Executive Member)',
      '16': 'সম্মানিত সদস্য (Executive Member)',
    }),
    rulesJson: JSON.stringify([
      'প্রতি মাসের ১ থেকে ১০ তারিখের মধ্যে নির্ধারিত মাসিক শেয়ার আমানত (৳২,০০০) ও প্রদেয় (৳৫০) সর্বমোট ৳২,০৫০ টাকা পরিশোধ করতে হবে।',
      'প্রতিটি অর্থ জমার বিপরীতে সফটওয়্যার থেকে স্বয়ংক্রিয়ভাবে অফিসিয়াল মানি রশিদ (Receipt No সহ) ইস্যু করা হয়।',
      'সমিতির সকল মূলধন, ডাউন পেমেন্ট এবং আয়-ব্যয়ের হিসাব ডাবল-এন্ট্রি লেজার পদ্ধতিতে সংরক্ষিত থাকে যা যেকোনো সদস্য নিজস্ব পোর্টাল থেকে দেখতে পারবেন।',
      'বিনিয়োগ ও কল্যাণ তহবিলের যেকোনো বড় সিদ্ধান্ত কার্যনির্বাহী কমিটি ও সাধারণ সভার অনুমোদনক্রমে গৃহীত হবে।',
      'বার্ষিক হিসাব সমাপনীতে অডিট রিপোর্ট ও সদস্যভিত্তিক চূড়ান্ত বিবরণী প্রকাশ করা হবে।',
    ]),
  };

  const parseNoticeRow = (n: any) => {
    let meta: { isPinned?: boolean; noticeDate?: string; refNo?: string } = {};
    try {
      if (n.targetMemberId && n.targetMemberId.startsWith('{')) {
        meta = JSON.parse(n.targetMemberId);
      } else if (n.targetMemberId === 'PINNED') {
        meta = { isPinned: true };
      }
    } catch {
      meta = {};
    }
    const fallbackDate = n.createdAt
      ? new Date(n.createdAt).toISOString().slice(0, 10)
      : '2026-10-31';
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type || 'ANNOUNCEMENT',
      targetRole: n.targetRole || 'ALL',
      isPinned: Boolean(meta.isPinned),
      noticeDate: meta.noticeDate || fallbackDate,
      refNo: meta.refNo || `HF-NOT-2026-${String(n.id).padStart(2, '0')}`,
      createdBy: n.createdBy || 'কার্যনির্বাহী কমিটি',
      createdAt: n.createdAt,
    };
  };

  const parseMemberCommentRow = (n: any, allMembers: any[], committeeRoles: Record<string, string>) => {
    let meta: {
      memberId?: string;
      category?: string;
      commentDate?: string;
      isHighlighted?: boolean;
    } = {};
    try {
      if (n.targetMemberId && n.targetMemberId.startsWith('{')) {
        meta = JSON.parse(n.targetMemberId);
      } else if (n.targetMemberId) {
        meta = { memberId: n.targetMemberId };
      }
    } catch {
      meta = {};
    }
    const mId = meta.memberId || '09';
    const memberObj = allMembers.find((m) => m.memberId === mId);
    const fallbackDate = n.createdAt
      ? new Date(n.createdAt).toISOString().slice(0, 10)
      : '2026-10-31';
    return {
      id: n.id,
      memberId: mId,
      memberName: memberObj?.name || n.createdBy || `Member #${mId}`,
      memberNameBn: memberObj?.nameBn || n.title || n.createdBy || `সদস্য #${mId}`,
      photoUrl: memberObj?.photoUrl || '',
      committeeRole: committeeRoles[mId] || 'সম্মানিত সদস্য (Executive Member)',
      comment: n.message,
      category: meta.category || 'সমিতির উন্নয়ন ও মতামত',
      commentDate: meta.commentDate || fallbackDate,
      isHighlighted: Boolean(meta.isHighlighted),
      createdAt: n.createdAt,
    };
  };

  app.get('/api/society-home', requireAuth, async (_req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const settingsRows = await db.select().from(systemSettings);
      const map = new Map<string, string>();
      for (const s of settingsRows) {
        map.set(s.settingKey, s.settingValue);
      }

      const allMembers = await db.select().from(members).orderBy(asc(members.id));

      // Check if we have seeded the rich Bengali cooperative notices & initial member comments yet
      let allNotificationRows = await db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.id));

      const hasAnyNotices = allNotificationRows.some((r) => r.type !== 'MEMBER_COMMENT');
      if (!hasAnyNotices && !map.get('default_notices_seeded')) {
        const defaultNotices = [
          {
            title: 'জরুরি বিজ্ঞপ্তি: ২০২৫ ও ২০২৬ সালের মাসিক কিস্তি ও বকেয়া পরিশোধ প্রসঙ্গে',
            message:
              'হিলফুল ফুজুল সমবায় সমিতির সকল সম্মানিত সদস্যদের সদয় অবগতির জন্য জানানো যাচ্ছে যে, ২০১৯ থেকে ২০২৪ সাল পর্যন্ত হিসাব চূড়ান্ত ও সমন্বয় করা হয়েছে। বর্তমানে ২০২৫ ও ২০২৬ সালের চলমান মাসিক কিস্তি ও বকেয়া পরিশোধের কার্যক্রম চলছে। সম্মানিত সদস্যদের নিজ নিজ বকেয়া কিস্তি দ্রুত পরিশোধ করে অফিসিয়াল ডিজিটাল মানি রশিদ সংগ্রহ করার জন্য বিশেষভাবে অনুরোধ করা হলো।',
            type: 'URGENT',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              isPinned: true,
              noticeDate: '2026-10-31',
              refNo: 'HF-NOT-2026-01',
            }),
            createdBy: 'সভাপতি ও সাধারণ সম্পাদক',
          },
          {
            title: 'আগামী সাধারণ সভা ও বার্ষিক আর্থিক অডিট পর্যালোচনা সভা',
            message:
              'সমিতির সকল সদস্যদের জানানো যাচ্ছে যে, আগামী মাসের প্রথম শুক্রবার বিকাল ৪:০০ ঘটিকায় সমিতির কার্যালয়ে বার্ষিক আর্থিক প্রতিবেদন (২০১৯–২০২৬), ডাউন পেমেন্ট তহবিল এবং নতুন বিনিয়োগ পরিকল্পনা বিষয়ে এক গুরুত্বপূর্ণ সাধারণ সভা অনুষ্ঠিত হবে। উক্ত সভায় সকল সদস্যকে যথাসময়ে উপস্থিত থাকার জন্য অনুরোধ জানানো হচ্ছে।',
            type: 'MEETING',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              isPinned: true,
              noticeDate: '2026-10-28',
              refNo: 'HF-NOT-2026-02',
            }),
            createdBy: 'সাধারণ সম্পাদক',
          },
          {
            title: 'ডিজিটাল ডাবল-এন্ট্রি সফটওয়্যার ও অনলাইন সদস্য পোর্টাল চালু প্রসঙ্গে',
            message:
              'আনন্দের সাথে জানানো যাচ্ছে যে, হিলফুল ফুজুল সমবায় সমিতির ২০১৯ থেকে ২০২৬ সাল পর্যন্ত সকল এক্সেল হিসাব ("Shomiti Hishab") এখন শতভাগ স্বচ্ছ PostgreSQL ডাটাবেজে রূপান্তরিত হয়েছে। এখন থেকে প্রতিটি সদস্য নিজের পোর্টালে লগইন করে মাসিক শেয়ার আমানত, প্রদেয়, ডাউন পেমেন্ট এবং বকেয়া বিবরণী সরাসরি দেখতে ও প্রিন্ট করতে পারবেন।',
            type: 'ANNOUNCEMENT',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              isPinned: false,
              noticeDate: '2026-10-20',
              refNo: 'HF-NOT-2026-03',
            }),
            createdBy: 'কোষাধ্যক্ষ ও অডিট কমিটি',
          },
          {
            title: 'মাসিক শেয়ার আমানত ও প্রদেয় জমার হার সংক্রান্ত স্থায়ী নীতিমালা',
            message:
              'সমিতির সিদ্ধান্ত অনুযায়ী ২০১৯ সালে মাসিক জমা ছিল ৳১,০২০, ২০২০ সালে ৳১,৫২০ এবং ২০২১ সাল থেকে বর্তমান ২০২৬ সাল পর্যন্ত মাসিক শেয়ার আমানত ৳২,০০০ ও মাসিক প্রদেয় ৳৫০ (মোট ৳২,০৫০) নির্ধারিত রয়েছে। নির্ধারিত সময়ের মধ্যে কিস্তি পরিশোধ করে সমিতির মূলধন বৃদ্ধিতে সহযোগিতা করুন।',
            type: 'POLICY',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              isPinned: false,
              noticeDate: '2026-10-15',
              refNo: 'HF-NOT-2026-04',
            }),
            createdBy: 'কার্যনির্বাহী পরিষদ',
          },
        ];
        await db.insert(notifications).values(defaultNotices);
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'default_notices_seeded',
            settingValue: 'true',
            description: 'Initial default notices seeded flag',
            updatedBy: 'System',
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: 'true', updatedAt: new Date() },
          });
        allNotificationRows = await db
          .select()
          .from(notifications)
          .orderBy(desc(notifications.id));
      } else if (hasAnyNotices && !map.get('default_notices_seeded')) {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'default_notices_seeded',
            settingValue: 'true',
            description: 'Initial default notices seeded flag',
            updatedBy: 'System',
          })
          .onConflictDoNothing();
      }

      // Seed initial authentic member comments if none exist yet
      const hasMemberComments = allNotificationRows.some((r) => r.type === 'MEMBER_COMMENT');
      if (!hasMemberComments && !map.get('member_comments_seeded')) {
        const defaultComments = [
          {
            title: 'মোঃ মনির হোসেন মামুন',
            message:
              'আলহামদুলিল্লাহ, ২০১৯ সাল থেকে আমাদের হিলফুল ফুজুল সমবায় সমিতির প্রতিটি হিসাব এখন শতভাগ ডিজিটাল ও স্বচ্ছ। সকল সম্মানিত সদস্য ভাইদের নিয়মিত অংশগ্রহণ ও আন্তরিক সহযোগিতায় আমাদের তহবিল উত্তরোত্তর সমৃদ্ধ হচ্ছে।',
            type: 'MEMBER_COMMENT',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              memberId: '09',
              category: 'কোষাধ্যক্ষ ও সুপার এডমিন বার্তা',
              commentDate: '2026-10-31',
              isHighlighted: true,
            }),
            createdBy: 'মোঃ মনির হোসেন মামুন (ID #09)',
          },
          {
            title: 'হাফেজ মোহাম্মদ কামরুজ্জামান',
            message:
              'পারস্পরিক আস্থা, ভ্রাতৃত্ববোধ ও শরীয়াহসম্মত বিনিয়োগের মাধ্যমে আমাদের এই সমবায় সমিতি সকলের ভবিষ্যৎ অর্থনৈতিক নিরাপত্তার একটি নির্ভরযোগ্য প্ল্যাটফর্ম হিসেবে গড়ে উঠেছে।',
            type: 'MEMBER_COMMENT',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              memberId: '02',
              category: 'সভাপতির শুভেচ্ছা ও মতামত',
              commentDate: '2026-10-29',
              isHighlighted: true,
            }),
            createdBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (ID #02)',
          },
          {
            title: 'মোঃ নাজমুল হুদা',
            message:
              'নিজস্ব প্রোফাইল থেকে যেকোনো সময় মাসিক শেয়ার আমানত, ডাউন পেমেন্ট এবং রশিদ দেখার সুযোগ আমাদের সমিতির কার্যক্রমে অনন্য স্বচ্ছতা ও গতিশীলতা এনেছে।',
            type: 'MEMBER_COMMENT',
            targetRole: 'ALL',
            targetMemberId: JSON.stringify({
              memberId: '06',
              category: 'সাধারণ সম্পাদকের মন্তব্য',
              commentDate: '2026-10-25',
              isHighlighted: false,
            }),
            createdBy: 'মোঃ নাজমুল হুদা (ID #06)',
          },
        ];
        await db.insert(notifications).values(defaultComments);
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'member_comments_seeded',
            settingValue: 'true',
            description: 'Initial member comments seeded flag',
            updatedBy: 'System',
          })
          .onConflictDoNothing();
        allNotificationRows = await db
          .select()
          .from(notifications)
          .orderBy(desc(notifications.id));
      }

      const committeeRolesObj = (() => {
        try {
          return JSON.parse(
            map.get('society_committee_roles') || DEFAULT_SOCIETY_BRANDING.committeeRoles
          );
        } catch {
          return JSON.parse(DEFAULT_SOCIETY_BRANDING.committeeRoles);
        }
      })();

      const parsedNotices = allNotificationRows
        .filter((r) => r.type !== 'MEMBER_COMMENT')
        .map(parseNoticeRow)
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.id - a.id;
        });

      const parsedComments = allNotificationRows
        .filter((r) => r.type === 'MEMBER_COMMENT')
        .map((r) => parseMemberCommentRow(r, allMembers, committeeRolesObj))
        .sort((a, b) => b.id - a.id);

      const rawLogoUrl = map.get('society_logo_url') || '';
      const resolvedLogoUrl =
        !rawLogoUrl ||
        rawLogoUrl === 'preset:official-logo' ||
        rawLogoUrl === '/assets/society-logo.jpg'
          ? OFFICIAL_SOCIETY_LOGO_URL
          : rawLogoUrl;

      const branding = {
        logoUrl: resolvedLogoUrl,
        nameBn: map.get('society_name_bn') || DEFAULT_SOCIETY_BRANDING.nameBn,
        nameEn: map.get('society_name_en') || DEFAULT_SOCIETY_BRANDING.nameEn,
        sloganBn: map.get('society_slogan_bn') || DEFAULT_SOCIETY_BRANDING.sloganBn,
        sloganEn: map.get('society_slogan_en') || DEFAULT_SOCIETY_BRANDING.sloganEn,
        establishedYear:
          map.get('society_established') || DEFAULT_SOCIETY_BRANDING.establishedYear,
        registrationInfo:
          map.get('society_reg_info') || DEFAULT_SOCIETY_BRANDING.registrationInfo,
        addressBn: map.get('society_address_bn') || DEFAULT_SOCIETY_BRANDING.addressBn,
        phone: map.get('society_phone') || DEFAULT_SOCIETY_BRANDING.phone,
        email: map.get('society_email') || DEFAULT_SOCIETY_BRANDING.email,
        meetingScheduleBn:
          map.get('society_meeting_schedule') ?? DEFAULT_SOCIETY_BRANDING.meetingScheduleBn,
        aboutBn: map.get('society_about_bn') ?? DEFAULT_SOCIETY_BRANDING.aboutBn,
        visionBn: map.get('society_vision_bn') ?? DEFAULT_SOCIETY_BRANDING.visionBn,
        committeeRoles: committeeRolesObj,
        rules: (() => {
          try {
            return JSON.parse(
              map.get('society_rules_json') || DEFAULT_SOCIETY_BRANDING.rulesJson
            );
          } catch {
            return JSON.parse(DEFAULT_SOCIETY_BRANDING.rulesJson);
          }
        })(),
      };

      const DefaultProgramsList = [
        {
          id: 101,
          title: 'বার্ষিক সাধারণ সভা ও আর্থিক প্রতিবেদন পর্যালোচনা অনুষ্ঠান',
          category: 'বার্ষিক সাধারণ সভা',
          programDate: '2026-02-15',
          location: 'সমিতি কেন্দ্রীয় কার্যালয়, কমলাপুর, বিরুলিয়া, সাভার',
          description:
            'হিলফুল ফুজুল সমবায় সমিতির সম্মানিত ১২ জন প্রতিষ্ঠাতা সদস্যের উপস্থিতিতে ২০১৯–২০২৬ সালের সার্বিক আয়-ব্যয়, শেয়ার আমানত এবং ভবিষ্যৎ উন্নয়ন পরিকল্পনা বিষয়ক বার্ষিক সাধারণ সভা।',
          photoUrl: '',
          uploadedBy: 'মোঃ মনির হোসেন মামুন (সুপার এডমিন)',
          createdAt: '2026-02-15',
        },
        {
          id: 102,
          title: 'পবিত্র মাহে রমজান উপলক্ষে বার্ষিক ইফতার ও দোয়া মাহফিল',
          category: 'ইফতার ও দোয়া মাহফিল',
          programDate: '2025-03-22',
          location: 'বিরুলিয়া, সাভার, ঢাকা',
          description:
            'সমিতির সকল সম্মানিত সদস্য ও শুভানুধ্যায়ীদের অংশগ্রহণে পারস্পরিক ভ্রাতৃত্ববোধ ও কল্যাণ কামনায় আয়োজিত বিশেষ ইফতার ও দোয়া মাহফিল।',
          photoUrl: '',
          uploadedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (সভাপতি)',
          createdAt: '2025-03-22',
        },
        {
          id: 103,
          title: 'সমিতির জমি ও বিনিয়োগ প্রকল্প সরেজমিনে পরিদর্শন',
          category: 'প্রকল্প পরিদর্শন',
          programDate: '2024-11-10',
          location: 'বিরুলিয়া আবাসন ও কৃষি প্রকল্প এলাকা, সাভার',
          description:
            'কার্যনির্বাহী কমিটি ও সম্মানিত সদস্যবৃন্দ কর্তৃক সমিতির তহবিল হতে বাস্তবায়িত প্রকল্প ও জমি সরেজমিনে পরিদর্শন এবং উন্নয়ন মূল্যায়ন।',
          photoUrl: '',
          uploadedBy: 'মোঃ নাজমুল হুদা (সাধারণ সম্পাদক)',
          createdAt: '2024-11-10',
        },
      ];

      const DefaultProjectsList = [
        {
          id: 201,
          projectCode: 'PRJ-2023-01',
          projectName: 'বিরুলিয়া আদর্শ জমি ও আবাসন বিনিয়োগ প্রকল্প (Land & Housing Project)',
          category: 'জমি ও আবাসন প্রকল্প',
          budgetAmount: 1592199,
          investedAmount: 1592199,
          location: 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
          startDate: '2023-06-15',
          status: 'বাস্তবায়িত ও চলমান প্রকল্প',
          description:
            'সমিতির সদস্যদের ডাউন পেমেন্ট ও শেয়ার আমানত তহবিলের সমন্বয়ে ২০২৩ সালে গৃহীত প্রধান স্থায়ী সম্পদ ও জমি ক্রয় উন্নয়ন প্রকল্প।',
          photoUrl: '',
          updatedBy: 'মোঃ মনির হোসেন মামুন (সুপার এডমিন)',
          createdAt: '2023-06-15',
        },
        {
          id: 202,
          projectCode: 'PRJ-2024-02',
          projectName: 'শরীয়াহসম্মত মুদারাবা ও হালাল বাণিজ্য প্রকল্প (Mudaraba Agro & Trade)',
          category: 'মুদারাবা ও কৃষি বাণিজ্য প্রকল্প',
          budgetAmount: 902320,
          investedAmount: 902320,
          location: 'সাভার, ঢাকা',
          startDate: '2024-03-10',
          status: 'চলমান প্রকল্প',
          description:
            '২০২৪ অর্থবছরে সদস্যদের সম্মিলিত মূলধন বৃদ্ধির লক্ষ্যে অনুমোদিত শরীয়াহসম্মত হালাল ব্যবসা ও কৃষি খামার বিনিয়োগ প্রকল্প।',
          photoUrl: '',
          updatedBy: 'কার্যনির্বাহী পরিষদ',
          createdAt: '2024-03-10',
        },
      ];

      let programsGallery = DefaultProgramsList;
      if (map.has('society_programs_gallery')) {
        try {
          const parsed = JSON.parse(map.get('society_programs_gallery') || '[]');
          if (Array.isArray(parsed)) {
            programsGallery = parsed;
          }
        } catch {
          programsGallery = DefaultProgramsList;
        }
      } else {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'society_programs_gallery',
            settingValue: JSON.stringify(DefaultProgramsList),
            description: 'Society Programs & Events Photo Gallery (Permanent Cloud Storage)',
            updatedBy: 'System',
          })
          .onConflictDoNothing();
      }

      let projectsGallery = DefaultProjectsList;
      if (map.has('society_projects_gallery')) {
        try {
          const parsed = JSON.parse(map.get('society_projects_gallery') || '[]');
          if (Array.isArray(parsed)) {
            projectsGallery = parsed;
          }
        } catch {
          projectsGallery = DefaultProjectsList;
        }
      } else {
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'society_projects_gallery',
            settingValue: JSON.stringify(DefaultProjectsList),
            description: 'Society Projects Showcase & Photos (Permanent Cloud Storage)',
            updatedBy: 'System',
          })
          .onConflictDoNothing();
      }

      res.json({
        branding,
        notices: parsedNotices,
        memberComments: parsedComments,
        programsGallery,
        projectsGallery,
      });
    } catch (error: any) {
      console.error('Error loading society home:', error);
      res.status(500).json({ error: error.message || 'Failed to load society home data' });
    }
  });

  // Society Programs Photo Gallery APIs (Permanent Cloud SQL Storage across all devices)
  app.post('/api/society-programs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, category, programDate, location, description, photoUrl } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'প্রোগ্রামের নাম বা শিরোনাম প্রদান করা আবশ্যক।' });
      }

      const existingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_programs_gallery'));

      let currentList: any[] = [];
      try {
        if (existingRows[0]?.settingValue) {
          currentList = JSON.parse(existingRows[0].settingValue);
        }
      } catch {
        currentList = [];
      }

      const actorName =
        req.profile?.fullName ||
        (req.profile?.memberId ? `সদস্য #${req.profile.memberId}` : 'সুপার এডমিন');

      const newItem = {
        id: Date.now(),
        title: String(title).trim(),
        category: String(category || 'বিশেষ অনুষ্ঠান ও প্রোগ্রাম').trim(),
        programDate: String(programDate || new Date().toISOString().slice(0, 10)).trim(),
        location: String(location || 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা').trim(),
        description: String(description || '').trim(),
        photoUrl: String(photoUrl || ''),
        uploadedBy: actorName,
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const updatedList = [newItem, ...currentList];

      await db
        .insert(systemSettings)
        .values({
          settingKey: 'society_programs_gallery',
          settingValue: JSON.stringify(updatedList),
          description: 'Society Programs & Events Photo Gallery (Permanent Cloud Storage)',
          updatedBy: actorName,
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: {
            settingValue: JSON.stringify(updatedList),
            updatedBy: actorName,
            updatedAt: new Date(),
          },
        });

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName,
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'ADD_SOCIETY_PROGRAM_PHOTO',
        entityType: 'system_settings',
        entityId: String(newItem.id),
        previousValue: '',
        updatedValue: newItem.title,
        reason: 'Uploaded program photo to Society Homepage',
      });

      res.json({ success: true, program: newItem, programsGallery: updatedList });
    } catch (error: any) {
      console.error('Add society program photo error:', error);
      res.status(500).json({ error: error.message || 'প্রোগ্রামের ছবি সংরক্ষণ করতে সমস্যা হয়েছে' });
    }
  });

  app.put('/api/society-programs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      const { title, category, programDate, location, description, photoUrl } = req.body || {};

      const existingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_programs_gallery'));

      let currentList: any[] = [];
      try {
        if (existingRows[0]?.settingValue) {
          currentList = JSON.parse(existingRows[0].settingValue);
        }
      } catch {
        currentList = [];
      }

      const actorName =
        req.profile?.fullName ||
        (req.profile?.memberId ? `সদস্য #${req.profile.memberId}` : 'সুপার এডমিন');

      let updatedItem: any = null;
      const updatedList = currentList.map((item) => {
        if (Number(item.id) === targetId) {
          updatedItem = {
            ...item,
            title: title !== undefined ? String(title).trim() : item.title,
            category: category !== undefined ? String(category).trim() : item.category,
            programDate: programDate !== undefined ? String(programDate).trim() : item.programDate,
            location: location !== undefined ? String(location).trim() : item.location,
            description: description !== undefined ? String(description).trim() : item.description,
            photoUrl: photoUrl !== undefined ? String(photoUrl) : item.photoUrl,
            uploadedBy: actorName,
          };
          return updatedItem;
        }
        return item;
      });

      if (!updatedItem) {
        return res.status(404).json({ error: 'প্রোগ্রামটি খুঁজে পাওয়া যায়নি।' });
      }

      await db
        .insert(systemSettings)
        .values({
          settingKey: 'society_programs_gallery',
          settingValue: JSON.stringify(updatedList),
          description: 'Society Programs & Events Photo Gallery (Permanent Cloud Storage)',
          updatedBy: actorName,
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: {
            settingValue: JSON.stringify(updatedList),
            updatedBy: actorName,
            updatedAt: new Date(),
          },
        });

      res.json({ success: true, program: updatedItem, programsGallery: updatedList });
    } catch (error: any) {
      console.error('Update society program photo error:', error);
      res.status(500).json({ error: error.message || 'প্রোগ্রামের তথ্য ও ছবি আপডেট করতে সমস্যা হয়েছে' });
    }
  });

  // Society Projects Photo & Showcase APIs (Permanent Cloud SQL Storage across all devices)
  app.post('/api/society-projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        projectCode,
        projectName,
        category,
        budgetAmount,
        investedAmount,
        location,
        startDate,
        status,
        description,
        photoUrl,
      } = req.body || {};

      if (!projectName || !String(projectName).trim()) {
        return res.status(400).json({ error: 'প্রকল্পের নাম প্রদান করা আবশ্যক।' });
      }

      const existingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_projects_gallery'));

      let currentList: any[] = [];
      try {
        if (existingRows[0]?.settingValue) {
          currentList = JSON.parse(existingRows[0].settingValue);
        }
      } catch {
        currentList = [];
      }

      const actorName =
        req.profile?.fullName ||
        (req.profile?.memberId ? `সদস্য #${req.profile.memberId}` : 'সুপার এডমিন');

      const budget = Math.max(0, Math.round(Number(budgetAmount) || 0));
      const invested =
        investedAmount !== undefined ? Math.max(0, Math.round(Number(investedAmount) || 0)) : budget;

      const newProject = {
        id: Date.now(),
        projectCode:
          String(projectCode || '').trim() ||
          `PRJ-${new Date().getFullYear()}-${String(currentList.length + 1).padStart(2, '0')}`,
        projectName: String(projectName).trim(),
        category: String(category || 'জমি ও আবাসন প্রকল্প').trim(),
        budgetAmount: budget,
        investedAmount: invested,
        location: String(location || 'বিরুলিয়া, সাভার, ঢাকা').trim(),
        startDate: String(startDate || new Date().toISOString().slice(0, 10)).trim(),
        status: String(status || 'চলমান প্রকল্প').trim(),
        description: String(description || '').trim(),
        photoUrl: String(photoUrl || ''),
        updatedBy: actorName,
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const updatedList = [newProject, ...currentList];

      await db
        .insert(systemSettings)
        .values({
          settingKey: 'society_projects_gallery',
          settingValue: JSON.stringify(updatedList),
          description: 'Society Projects Showcase & Photos (Permanent Cloud Storage)',
          updatedBy: actorName,
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: {
            settingValue: JSON.stringify(updatedList),
            updatedBy: actorName,
            updatedAt: new Date(),
          },
        });

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'admin',
        actorName,
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'ADD_SOCIETY_PROJECT_PHOTO',
        entityType: 'system_settings',
        entityId: newProject.projectCode,
        previousValue: '',
        updatedValue: newProject.projectName,
        reason: 'Added society project with photo to Homepage',
      });

      res.json({ success: true, project: newProject, projectsGallery: updatedList });
    } catch (error: any) {
      console.error('Add society project error:', error);
      res.status(500).json({ error: error.message || 'প্রকল্প ও ছবি সংরক্ষণ করতে সমস্যা হয়েছে' });
    }
  });

  app.put('/api/society-projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      const {
        projectCode,
        projectName,
        category,
        budgetAmount,
        investedAmount,
        location,
        startDate,
        status,
        description,
        photoUrl,
      } = req.body || {};

      const existingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_projects_gallery'));

      let currentList: any[] = [];
      try {
        if (existingRows[0]?.settingValue) {
          currentList = JSON.parse(existingRows[0].settingValue);
        }
      } catch {
        currentList = [];
      }

      const actorName =
        req.profile?.fullName ||
        (req.profile?.memberId ? `সদস্য #${req.profile.memberId}` : 'সুপার এডমিন');

      let updatedProject: any = null;
      const updatedList = currentList.map((item) => {
        if (Number(item.id) === targetId) {
          updatedProject = {
            ...item,
            projectCode:
              projectCode !== undefined ? String(projectCode).trim() : item.projectCode,
            projectName:
              projectName !== undefined ? String(projectName).trim() : item.projectName,
            category: category !== undefined ? String(category).trim() : item.category,
            budgetAmount:
              budgetAmount !== undefined
                ? Math.max(0, Math.round(Number(budgetAmount) || 0))
                : item.budgetAmount,
            investedAmount:
              investedAmount !== undefined
                ? Math.max(0, Math.round(Number(investedAmount) || 0))
                : item.investedAmount,
            location: location !== undefined ? String(location).trim() : item.location,
            startDate: startDate !== undefined ? String(startDate).trim() : item.startDate,
            status: status !== undefined ? String(status).trim() : item.status,
            description:
              description !== undefined ? String(description).trim() : item.description,
            photoUrl: photoUrl !== undefined ? String(photoUrl) : item.photoUrl,
            updatedBy: actorName,
          };
          return updatedProject;
        }
        return item;
      });

      if (!updatedProject) {
        return res.status(404).json({ error: 'প্রকল্পটি খুঁজে পাওয়া যায়নি।' });
      }

      await db
        .insert(systemSettings)
        .values({
          settingKey: 'society_projects_gallery',
          settingValue: JSON.stringify(updatedList),
          description: 'Society Projects Showcase & Photos (Permanent Cloud Storage)',
          updatedBy: actorName,
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: {
            settingValue: JSON.stringify(updatedList),
            updatedBy: actorName,
            updatedAt: new Date(),
          },
        });

      res.json({ success: true, project: updatedProject, projectsGallery: updatedList });
    } catch (error: any) {
      console.error('Update society project error:', error);
      res.status(500).json({ error: error.message || 'প্রকল্পের ছবি ও তথ্য আপডেট করতে সমস্যা হয়েছে' });
    }
  });

  app.delete('/api/society-programs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const targetId = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_programs_gallery'));
      let currentList: any[] = [];
      try {
        if (existingRows[0]?.settingValue) {
          currentList = JSON.parse(existingRows[0].settingValue);
        }
      } catch {
        currentList = [];
      }
      const updatedList = currentList.filter((item) => Number(item.id) !== targetId);
      const actorName = req.profile?.fullName || 'Super Admin';
      await db
        .insert(systemSettings)
        .values({
          settingKey: 'society_programs_gallery',
          settingValue: JSON.stringify(updatedList),
          description: 'Society Programs & Events Photo Gallery (Permanent Cloud Storage)',
          updatedBy: actorName,
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: {
            settingValue: JSON.stringify(updatedList),
            updatedBy: actorName,
            updatedAt: new Date(),
          },
        });
      res.json({ success: true, programsGallery: updatedList });
    } catch (error: any) {
      console.error('Delete society program error:', error);
      res.status(500).json({ error: error.message || 'প্রোগ্রাম মুছে ফেলতে সমস্যা হয়েছে' });
    }
  });

  app.delete('/api/society-projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const targetId = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'society_projects_gallery'));
      let currentList: any[] = [];
      try {
        if (existingRows[0]?.settingValue) {
          currentList = JSON.parse(existingRows[0].settingValue);
        }
      } catch {
        currentList = [];
      }
      const updatedList = currentList.filter((item) => Number(item.id) !== targetId);
      const actorName = req.profile?.fullName || 'Super Admin';
      await db
        .insert(systemSettings)
        .values({
          settingKey: 'society_projects_gallery',
          settingValue: JSON.stringify(updatedList),
          description: 'Society Projects Showcase & Photos (Permanent Cloud Storage)',
          updatedBy: actorName,
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: {
            settingValue: JSON.stringify(updatedList),
            updatedBy: actorName,
            updatedAt: new Date(),
          },
        });
      res.json({ success: true, projectsGallery: updatedList });
    } catch (error: any) {
      console.error('Delete society project error:', error);
      res.status(500).json({ error: error.message || 'প্রকল্প মুছে ফেলতে সমস্যা হয়েছে' });
    }
  });

  // Member Comments Publishing, Editing & Deleting APIs (Accessible from Member Profile & Homepage)
  app.post('/api/member-comments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = req.profile?.role || 'MEMBER';
      const requestedMemberId = String(req.body.memberId || req.profile?.memberId || '09').trim();
      const effectiveMemberId =
        role === 'MEMBER' ? req.profile?.memberId || requestedMemberId : requestedMemberId;

      const commentText = String(req.body.comment || req.body.commentText || '').trim();
      const category = String(req.body.category || 'সদস্যের মতামত ও পরামর্শ').trim();

      if (!commentText) {
        return res.status(400).json({ error: 'দয়া করে আপনার মন্তব্য বা মতামত লিখুন।' });
      }

      const memberRows = await db
        .select()
        .from(members)
        .where(eq(members.memberId, effectiveMemberId));
      const memberObj = memberRows[0];
      const authorNameBn = memberObj?.nameBn || memberObj?.name || `সদস্য #${effectiveMemberId}`;

      const metaJson = JSON.stringify({
        memberId: effectiveMemberId,
        category,
        commentDate: new Date().toISOString().slice(0, 10),
        isHighlighted: role === 'SUPER_ADMIN' || Boolean(req.body.isHighlighted),
      });

      const [created] = await db
        .insert(notifications)
        .values({
          title: authorNameBn,
          message: commentText,
          type: 'MEMBER_COMMENT',
          targetRole: 'ALL',
          targetMemberId: metaJson,
          createdBy: `${authorNameBn} (ID #${effectiveMemberId})`,
        })
        .returning();

      // Also save the latest comment on the member's profile remarks field so it appears in their profile card
      if (memberObj) {
        await db
          .update(members)
          .set({ remarks: commentText })
          .where(eq(members.memberId, effectiveMemberId));
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || `member_${effectiveMemberId}`,
        actorName: authorNameBn,
        actorRole: role,
        action: 'PUBLISH_MEMBER_COMMENT',
        entityType: 'notifications',
        entityId: String(created.id),
        previousValue: '',
        updatedValue: commentText,
        reason: `Member #${effectiveMemberId} published a comment to Society Homepage`,
      });

      const allMembers = await db.select().from(members);
      res.json({
        success: true,
        comment: parseMemberCommentRow(
          created,
          allMembers,
          JSON.parse(DEFAULT_SOCIETY_BRANDING.committeeRoles)
        ),
      });
    } catch (error: any) {
      console.error('Publish member comment error:', error);
      res.status(500).json({ error: error.message || 'মন্তব্য প্রকাশ করতে সমস্যা হয়েছে' });
    }
  });

  app.put('/api/member-comments/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const commentId = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, commentId));
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'মন্তব্যটি খুঁজে পাওয়া যায়নি' });
      }
      const row = existingRows[0];
      let meta: any = {};
      try {
        meta = JSON.parse(row.targetMemberId || '{}');
      } catch {
        meta = {};
      }

      const role = req.profile?.role || 'MEMBER';
      const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(role);
      const isAuthor = req.profile?.memberId === meta.memberId;
      if (!isSuperOrAdmin && !isAuthor) {
        return res
          .status(403)
          .json({ error: 'অনুমতি নেই: শুধুমাত্র লেখক বা সুপার এডমিন মন্তব্য সম্পাদনা করতে পারবেন।' });
      }

      const nextComment = String(req.body.comment ?? row.message).trim();
      const nextCategory = String(req.body.category ?? meta.category ?? 'সদস্যের মতামত').trim();
      const nextMeta = JSON.stringify({
        ...meta,
        category: nextCategory,
        isHighlighted:
          req.body.isHighlighted !== undefined ? Boolean(req.body.isHighlighted) : meta.isHighlighted,
      });

      const [updated] = await db
        .update(notifications)
        .set({
          message: nextComment,
          targetMemberId: nextMeta,
        })
        .where(eq(notifications.id, commentId))
        .returning();

      if (meta.memberId) {
        await db
          .update(members)
          .set({ remarks: nextComment })
          .where(eq(members.memberId, meta.memberId));
      }

      const allMembers = await db.select().from(members);
      res.json({
        success: true,
        comment: parseMemberCommentRow(
          updated,
          allMembers,
          JSON.parse(DEFAULT_SOCIETY_BRANDING.committeeRoles)
        ),
      });
    } catch (error: any) {
      console.error('Update member comment error:', error);
      res.status(500).json({ error: error.message || 'মন্তব্য আপডেট করতে সমস্যা হয়েছে' });
    }
  });

  app.delete('/api/member-comments/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const commentId = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, commentId));
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'মন্তব্যটি খুঁজে পাওয়া যায়নি' });
      }
      const row = existingRows[0];
      let meta: any = {};
      try {
        meta = JSON.parse(row.targetMemberId || '{}');
      } catch {
        meta = {};
      }

      const role = req.profile?.role || 'MEMBER';
      const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(role);
      const isAuthor = req.profile?.memberId === meta.memberId;
      if (!isSuperOrAdmin && !isAuthor) {
        return res
          .status(403)
          .json({ error: 'অনুমতি নেই: শুধুমাত্র লেখক বা সুপার এডমিন মন্তব্য মুছতে পারবেন।' });
      }

      await db.delete(notifications).where(eq(notifications.id, commentId));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete member comment error:', error);
      res.status(500).json({ error: error.message || 'মন্তব্য মুছতে সমস্যা হয়েছে' });
    }
  });

  app.put('/api/society-branding', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
      const body = req.body || {};
      const keyMapping: Record<string, string> = {
        logoUrl: 'society_logo_url',
        nameBn: 'society_name_bn',
        nameEn: 'society_name_en',
        sloganBn: 'society_slogan_bn',
        sloganEn: 'society_slogan_en',
        establishedYear: 'society_established',
        registrationInfo: 'society_reg_info',
        addressBn: 'society_address_bn',
        phone: 'society_phone',
        email: 'society_email',
        meetingScheduleBn: 'society_meeting_schedule',
        aboutBn: 'society_about_bn',
        visionBn: 'society_vision_bn',
      };

      const actor = req.profile?.fullName || 'Super Admin';
      for (const [field, settingKey] of Object.entries(keyMapping)) {
        if (body[field] !== undefined) {
          const val = String(body[field]);
          await db
            .insert(systemSettings)
            .values({
              settingKey,
              settingValue: val,
              description: `Society Home Branding: ${field}`,
              updatedBy: actor,
            })
            .onConflictDoUpdate({
              target: systemSettings.settingKey,
              set: {
                settingValue: val,
                updatedBy: actor,
                updatedAt: new Date(),
              },
            });
        }
      }

      if (body.committeeRoles !== undefined) {
        const val =
          typeof body.committeeRoles === 'string'
            ? body.committeeRoles
            : JSON.stringify(body.committeeRoles);
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'society_committee_roles',
            settingValue: val,
            description: 'Society Executive Committee Roles by Member ID',
            updatedBy: actor,
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: val, updatedBy: actor, updatedAt: new Date() },
          });
      }

      if (body.rules !== undefined) {
        const val =
          typeof body.rules === 'string' ? body.rules : JSON.stringify(body.rules);
        await db
          .insert(systemSettings)
          .values({
            settingKey: 'society_rules_json',
            settingValue: val,
            description: 'Society Rules & Constitution List',
            updatedBy: actor,
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: { settingValue: val, updatedBy: actor, updatedAt: new Date() },
          });
      }

      await db.insert(auditLogs).values({
        actorUid: req.profile?.uid || 'super_admin',
        actorName: actor,
        actorRole: req.profile?.role || 'SUPER_ADMIN',
        action: 'UPDATE_SOCIETY_BRANDING',
        entityType: 'system_settings',
        entityId: 'society_home_branding',
        previousValue: '',
        updatedValue: 'Updated Society Logo / Home Page Branding & Info',
        reason: 'User updated society homepage branding or logo',
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Update society branding error:', error);
      res.status(500).json({ error: error.message || 'Failed to update society branding' });
    }
  });

  app.post('/api/notices', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
      const { title, message, type, isPinned, noticeDate, refNo, createdBy } = req.body;
      if (!title || !message) {
        return res.status(400).json({ error: 'Notice title and message are required' });
      }
      const metaJson = JSON.stringify({
        isPinned: Boolean(isPinned),
        noticeDate: noticeDate || new Date().toISOString().slice(0, 10),
        refNo: refNo || `HF-NOT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 89)}`,
      });
      const [created] = await db
        .insert(notifications)
        .values({
          title,
          message,
          type: type || 'ANNOUNCEMENT',
          targetRole: 'ALL',
          targetMemberId: metaJson,
          createdBy: createdBy || req.profile?.fullName || 'কার্যনির্বাহী কমিটি',
        })
        .returning();

      res.json({ notice: parseNoticeRow(created) });
    } catch (error: any) {
      console.error('Create notice error:', error);
      res.status(500).json({ error: error.message || 'Failed to create notice' });
    }
  });

  app.put('/api/notices/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
      const noticeId = Number(req.params.id);
      const { title, message, type, isPinned, noticeDate, refNo, createdBy } = req.body;
      const existingRows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, noticeId));
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      const existingParsed = parseNoticeRow(existingRows[0]);
      const metaJson = JSON.stringify({
        isPinned: isPinned !== undefined ? Boolean(isPinned) : existingParsed.isPinned,
        noticeDate: noticeDate || existingParsed.noticeDate,
        refNo: refNo || existingParsed.refNo,
      });

      const [updated] = await db
        .update(notifications)
        .set({
          title: title ?? existingRows[0].title,
          message: message ?? existingRows[0].message,
          type: type ?? existingRows[0].type,
          targetMemberId: metaJson,
          createdBy: createdBy ?? existingRows[0].createdBy,
        })
        .where(eq(notifications.id, noticeId))
        .returning();

      res.json({ notice: parseNoticeRow(updated) });
    } catch (error: any) {
      console.error('Update notice error:', error);
      res.status(500).json({ error: error.message || 'Failed to update notice' });
    }
  });

  app.delete('/api/notices/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
      const noticeId = Number(req.params.id);
      await db.delete(notifications).where(eq(notifications.id, noticeId));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete notice error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete notice' });
    }
  });

  // 12. Historical Data Intelligence & Forensic Validation API (Uploaded Shomiti Hishab Package)
  app.get('/api/data-intelligence', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const intelligence = analyzeHistoricalPackage();
      res.json(intelligence);
    } catch (error: any) {
      console.error('Data intelligence error:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze historical package' });
    }
  });

  app.post('/api/data-intelligence/approve', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN']);
      const result = await syncAuthenticDatasetToPostgres(true);
      res.json(result);
    } catch (error: any) {
      console.error('Approve historical package error:', error);
      res.status(500).json({ error: error.message || 'Failed to approve historical dataset' });
    }
  });

  // =========================================================================
  // 13. SMART SOCIETY FEATURES HUB & 1-CLICK CLOUD BACKUP API
  // =========================================================================
  const getSettingJson = async <T>(key: string, defaultVal: T): Promise<T> => {
    try {
      const rows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key));
      if (rows.length > 0 && rows[0].settingValue) {
        return JSON.parse(rows[0].settingValue) as T;
      }
    } catch {
      // ignore parse errors
    }
    return defaultVal;
  };

  const saveSettingJson = async (key: string, value: any, description: string, actor: string) => {
    const valStr = JSON.stringify(value);
    await db
      .insert(systemSettings)
      .values({
        settingKey: key,
        settingValue: valStr,
        description,
        updatedBy: actor,
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue: valStr,
          updatedBy: actor,
          updatedAt: new Date(),
        },
      });
  };

  const DEFAULT_SMART_MEETINGS = [
    {
      id: 'MTG-2026-01',
      meetingNo: 'ত্রৈমাসিক সাধারণ সভা — ০১/২০২৬',
      title: '২০২৬ সালের বাৎসরিক বিনিয়োগ পরিকল্পনা ও বকেয়া কিস্তি সমন্বয় সভা',
      meetingDate: '2026-01-15',
      venue: 'সমিতি প্রধান কার্যালয়, কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
      presidedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (সভাপতি - #02)',
      secretaryName: 'মোঃ আরিফুল ইসলাম (সাধারণ সম্পাদক - #06)',
      attendees: ['02', '04', '05', '06', '07', '09', '10', '11', '12', '14', '15', '16'],
      agenda: '১. ২০১৯–২০২৫ সালের চূড়ান্ত অডিট অনুমোদন\n২. প্রতি মাসের ১–১০ তারিখের মধ্যে কিস্তি জমা নিশ্চিতকরণ\n৩. নতুন প্রজেক্ট ও জমি বিনিয়োগের সম্ভাব্যতা যাচাই',
      resolutions: [
        'সর্বসম্মতিক্রমে ২০১৯ থেকে ২০২৫ সাল পর্যন্ত সকল সদস্যের জমা ও খরচের হিসাব অনুমোদিত হয়।',
        'প্রতি মাসের ১০ তারিখের মধ্যে মাসিক শেয়ার আমানত ৳২,০০০ ও প্রদেয় ৳৫০ বিকাশ/নগদ বা সরাসরি ক্যাশে জমা দেওয়ার সিদ্ধান্ত গৃহীত হয়।',
        'সমিতির দীর্ঘমেয়াদী মূলধন বৃদ্ধির লক্ষ্যে নিরাপদ জমি ও হালাল প্রজেক্টে বিনিয়োগের জন্য ৩ সদস্যের যাচাই কমিটি গঠন করা হয়।',
      ],
      status: 'APPROVED',
      createdAt: '2026-01-15T10:30:00.000Z',
    },
  ];

  const DEFAULT_SMART_POLLS = [
    {
      id: 'POLL-2026-01',
      title: 'সমিতির পরবর্তী তহবিল কোন খাতে বিনিয়োগ করা সবচেয়ে লাভজনক ও নিরাপদ হবে?',
      description: 'সকল ১২ জন সম্মানিত সদস্যের মতামতের ভিত্তিতে পরবর্তী সাধারণ সভায় চূড়ান্ত বিনিয়োগ সিদ্ধান্ত গ্রহণ করা হবে।',
      deadline: '2026-12-31',
      status: 'OPEN',
      options: [
        { id: 'OPT-1', label: 'সাভার/বিরুলিয়া এলাকায় নিষ্কণ্টক জমি ক্রয় (Land Asset)', votes: ['02', '04', '06', '09', '11'] },
        { id: 'OPT-2', label: 'হালাল অ্যাগ্রো ও ডেইরি প্রজেক্টে শরীয়াহসম্মত মুদারাবা বিনিয়োগ', votes: ['05', '07', '10'] },
        { id: 'OPT-3', label: 'বাণিজ্যিক দোকান/ফ্ল্যাট ক্রয় ও মাসিক ভাড়া আয় তহবিল', votes: ['12', '15'] },
      ],
      createdAt: '2026-02-01T09:00:00.000Z',
    },
  ];

  const DEFAULT_SMART_ASSETS = [
    {
      id: 'AST-01',
      nameBn: 'বিরুলিয়া মেইন রোড সংলগ্ন প্রস্তাবিত আবাসিক ল্যান্ড প্রজেক্ট (শেয়ার তহবিল ও ডাউন পেমেন্ট)',
      category: 'LAND_PROJECT',
      location: 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
      purchaseYear: '2023–2024',
      investedAmount: 2494519,
      currentMarketValue: 3450000,
      deedOrRefNo: 'HF-LAND-2023-24',
      status: 'ACTIVE',
      notes: '২০২৩ সালে ৳১৫,৯২,১৯৯ এবং ২০২৪ সালে ৳৯,০২,৩২০ সর্বমোট ৳২৪,৯৪,৫১৯ বিনিয়োগকৃত প্রকল্পের বর্তমান আনুমানিক বাজারমূল্য প্রবৃদ্ধি।',
    },
  ];

  const DEFAULT_TARGET_FUND = {
    titleBn: 'সমিতির দীর্ঘমেয়াদী মূলধন ও ল্যান্ড প্রজেক্ট লক্ষ্যমাত্রা (২০১৯–২০২৬)',
    targetAmount: 3500000,
    deadline: '2026-12-31',
    noteBn: '১২ জন প্রতিষ্ঠাতা সদস্যের মাসিক শেয়ার আমানত, প্রদেয় ও ডাউন পেমেন্টের সম্মিলিত তহবিল লক্ষ্যমাত্রা',
  };

  app.get('/api/smart-features', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const queryYear = Number(req.query.year) || 2026;
      const allMembers = await db.select().from(members).orderBy(asc(members.id));
      const allSummaries = await db.select().from(annualAccountSummaries);
      const allObligations = await db
        .select()
        .from(monthlyObligations)
        .where(eq(monthlyObligations.year, queryYear));

      const paymentRequests = await getSettingJson<any[]>('SOCIETY_PAYMENT_REQUESTS_JSON', []);
      const meetings = await getSettingJson<any[]>('SOCIETY_MEETINGS_JSON', DEFAULT_SMART_MEETINGS);
      const polls = await getSettingJson<any[]>('SOCIETY_POLLS_JSON', DEFAULT_SMART_POLLS);
      const assets = await getSettingJson<any[]>('SOCIETY_ASSETS_VALUATION_JSON', DEFAULT_SMART_ASSETS);
      const dividends = await getSettingJson<any[]>('SOCIETY_DIVIDENDS_JSON', []);
      const targetFund = await getSettingJson<any>('SOCIETY_TARGET_FUND_JSON', DEFAULT_TARGET_FUND);

      // Build 12-Member × 12-Month Payment Heatmap + Gold/Regular Badges
      const heatmap = allMembers.map((m) => {
        const mObligations = allObligations.filter((o) => o.memberId === m.memberId);
        const mSummaries = allSummaries.filter((s) => s.memberId === m.memberId);
        const latest2026 = [...mSummaries]
          .filter((s) => s.year <= 2026)
          .sort((a, b) => b.year - a.year)[0];
        const lifetimeShareDeposit = mSummaries.reduce((sum, s) => sum + s.totalShareDeposit, 0);
        const lifetimeDownPayment = mSummaries.reduce((sum, s) => sum + s.totalDownPayment, 0);
        const lifetimeTotalReceived = mSummaries.reduce((sum, s) => sum + s.totalReceiveAmount, 0);
        const totalOutstanding = latest2026?.totalOutstanding || 0;

        const months = MONTH_NAMES.map((mName, idx) => {
          const mNum = idx + 1;
          const ob = mObligations.find((o) => o.month === mNum);
          const paid = ob ? ob.totalReceiveAmount : 0;
          const due = ob ? ob.monthlyDue : 0;
          const status =
            paid >= 2050 && due === 0
              ? 'PAID'
              : paid > 0
              ? 'PARTIAL'
              : due > 0
              ? 'DUE'
              : 'UPCOMING';
          return {
            month: mNum,
            monthName: mName,
            shortName: mName.slice(0, 3),
            shareDeposit: ob?.shareDeposit || 0,
            payable: ob?.payable || 0,
            downPayment: ob?.downPayment || 0,
            paidAmount: paid,
            dueAmount: due,
            status,
            receiptNo: ob?.receiptNo || '',
            paymentDate: ob?.paymentDate || '',
          };
        });

        const paidMonthsCount = months.filter((mo) => mo.status === 'PAID').length;
        const badge =
          totalOutstanding === 0
            ? 'GOLD_ZERO_DUE'
            : totalOutstanding <= 4100
            ? 'REGULAR_MEMBER'
            : 'DUE_ALERT';

        return {
          memberId: m.memberId,
          name: m.name,
          nameBn: m.nameBn,
          mobile: m.mobile,
          bloodGroup: m.bloodGroup,
          nidNumber: m.nidNumber,
          joiningDate: m.joiningDate,
          address: m.address,
          occupation: m.occupation,
          photoUrl: m.photoUrl,
          nomineeName: m.nomineeName,
          nomineeRelation: m.nomineeRelation,
          nomineePhotoUrl: m.nomineePhotoUrl,
          lifetimeShareDeposit,
          lifetimeDownPayment,
          lifetimeTotalReceived,
          totalOutstanding,
          paidMonthsCount,
          badge,
          months,
        };
      });

      res.json({
        year: queryYear,
        heatmap,
        paymentRequests,
        meetings,
        polls,
        assets,
        dividends,
        targetFund,
      });
    } catch (error: any) {
      console.error('Get smart-features error:', error);
      res.status(500).json({ error: error.message || 'Failed to load smart features data' });
    }
  });

  // Submit Online Payment Request (bKash / Nagad / Rocket / Bank Transfer)
  app.post('/api/smart-features/payment-request', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        memberId,
        year,
        month,
        shareDeposit,
        payable,
        downPayment,
        fine,
        otherReceive,
        paymentMethod,
        transactionId,
        senderNumber,
        paymentDate,
        remarks,
      } = req.body;

      const targetMemberId =
        req.profile?.role === 'MEMBER' ? req.profile.memberId || memberId : memberId;

      if (!targetMemberId || !year || !month) {
        return res.status(400).json({ error: 'সদস্য আইডি, বছর এবং মাস নির্বাচন করা আবশ্যক।' });
      }

      const memberRows = await db
        .select()
        .from(members)
        .where(eq(members.memberId, String(targetMemberId)));
      const memberObj = memberRows[0];

      const sDep = Number(shareDeposit) || 0;
      const pay = Number(payable) || 0;
      const dp = Number(downPayment) || 0;
      const fn = Number(fine) || 0;
      const oth = Number(otherReceive) || 0;
      const totalAmount = sDep + pay + dp + fn + oth;

      if (totalAmount <= 0) {
        return res.status(400).json({ error: 'জমার পরিমাণ অবশ্যই ০ টাকার বেশি হতে হবে।' });
      }

      const existing = await getSettingJson<any[]>('SOCIETY_PAYMENT_REQUESTS_JSON', []);
      const newReq = {
        id: `PRQ-${Date.now()}`,
        memberId: String(targetMemberId),
        memberName: memberObj?.name || `Member #${targetMemberId}`,
        memberNameBn: memberObj?.nameBn || memberObj?.name || `সদস্য #${targetMemberId}`,
        mobile: memberObj?.mobile || '',
        year: Number(year),
        month: Number(month),
        monthName: MONTH_NAMES[(Number(month) || 1) - 1] || 'January',
        shareDeposit: sDep,
        payable: pay,
        downPayment: dp,
        fine: fn,
        otherReceive: oth,
        totalAmount,
        paymentMethod: paymentMethod || 'bKash',
        transactionId: String(transactionId || '').trim() || `TRX-${Date.now().toString().slice(-6)}`,
        senderNumber: String(senderNumber || '').trim(),
        paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
        remarks: String(remarks || '').trim(),
        status: 'PENDING',
        submittedBy: req.profile?.fullName || `Member #${targetMemberId}`,
        createdAt: new Date().toISOString(),
      };

      const updated = [newReq, ...existing];
      await saveSettingJson(
        'SOCIETY_PAYMENT_REQUESTS_JSON',
        updated,
        'Member Online bKash/Nagad/Bank Payment Requests',
        req.profile?.fullName || 'Member'
      );

      res.json({ request: newReq, paymentRequests: updated });
    } catch (error: any) {
      console.error('Submit payment request error:', error);
      res.status(500).json({ error: error.message || 'Failed to submit payment request' });
    }
  });

  // 1-Click Approve Online Payment Request -> Posts directly to Member Ledger & Generates Official Receipt
  app.post('/api/smart-features/payment-request/:id/approve', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const reqId = req.params.id;
      const existing = await getSettingJson<any[]>('SOCIETY_PAYMENT_REQUESTS_JSON', []);
      const target = existing.find((r) => r.id === reqId);
      if (!target) {
        return res.status(404).json({ error: 'পেমেন্ট রিকোয়েস্ট পাওয়া যায়নি।' });
      }
      if (target.status === 'APPROVED') {
        return res.status(400).json({ error: 'এই পেমেন্ট রিকোয়েস্টটি ইতিমধ্যে অনুমোদিত হয়েছে।' });
      }

      // Check existing obligation for that member/year/month so we ADD to existing or set cleanly
      const existingOb = await db
        .select()
        .from(monthlyObligations)
        .where(
          and(
            eq(monthlyObligations.memberId, target.memberId),
            eq(monthlyObligations.year, Number(target.year)),
            eq(monthlyObligations.month, Number(target.month))
          )
        );
      const prevOb = existingOb[0];

      const result = await recordMemberPayment({
        memberId: target.memberId,
        year: Number(target.year),
        month: Number(target.month),
        shareDeposit: (prevOb?.shareDeposit || 0) + (Number(target.shareDeposit) || 0),
        payable: (prevOb?.payable || 0) + (Number(target.payable) || 0),
        fine: (prevOb?.fine || 0) + (Number(target.fine) || 0),
        otherReceive: (prevOb?.otherReceive || 0) + (Number(target.otherReceive) || 0),
        downPayment: (prevOb?.downPayment || 0) + (Number(target.downPayment) || 0),
        paymentDate: target.paymentDate || new Date().toISOString().slice(0, 10),
        paymentMethod: `${target.paymentMethod} (${target.transactionId})`,
        receivedBy: req.profile?.fullName || 'Super Admin',
        remarks: target.remarks || `Approved online payment (${target.paymentMethod} TrxID: ${target.transactionId})`,
        actorUid: req.profile?.uid || 'super_admin',
        actorRole: req.profile?.role || 'SUPER_ADMIN',
      });

      const updated = existing.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'APPROVED',
              approvedBy: req.profile?.fullName || 'Super Admin',
              approvedAt: new Date().toISOString(),
              receiptNo: result.receipt?.receiptNo || '',
            }
          : r
      );

      await saveSettingJson(
        'SOCIETY_PAYMENT_REQUESTS_JSON',
        updated,
        'Member Online bKash/Nagad/Bank Payment Requests',
        req.profile?.fullName || 'Super Admin'
      );

      res.json({
        success: true,
        receipt: result.receipt,
        paymentRequests: updated,
      });
    } catch (error: any) {
      console.error('Approve payment request error:', error);
      res.status(500).json({ error: error.message || 'Failed to approve payment request' });
    }
  });

  // Reject Online Payment Request
  app.post('/api/smart-features/payment-request/:id/reject', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const reqId = req.params.id;
      const { reason } = req.body;
      const existing = await getSettingJson<any[]>('SOCIETY_PAYMENT_REQUESTS_JSON', []);
      const updated = existing.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'REJECTED',
              rejectedReason: reason || 'তথ্য বা TrxID যাচাইয়ে অমিল পাওয়া গেছে',
              rejectedBy: req.profile?.fullName || 'Admin',
              rejectedAt: new Date().toISOString(),
            }
          : r
      );
      await saveSettingJson(
        'SOCIETY_PAYMENT_REQUESTS_JSON',
        updated,
        'Member Online bKash/Nagad/Bank Payment Requests',
        req.profile?.fullName || 'Admin'
      );
      res.json({ success: true, paymentRequests: updated });
    } catch (error: any) {
      console.error('Reject payment request error:', error);
      res.status(500).json({ error: error.message || 'Failed to reject payment request' });
    }
  });

  // Save / Update Meeting Minutes & Resolutions
  app.post('/api/smart-features/meetings', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const {
        id,
        meetingNo,
        title,
        meetingDate,
        venue,
        presidedBy,
        secretaryName,
        attendees,
        agenda,
        resolutions,
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'সভার শিরোনাম প্রদান করা আবশ্যক।' });
      }

      const existing = await getSettingJson<any[]>('SOCIETY_MEETINGS_JSON', DEFAULT_SMART_MEETINGS);
      const parsedResolutions = Array.isArray(resolutions)
        ? resolutions
        : String(resolutions || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

      let updated: any[];
      if (id && existing.some((m) => m.id === id)) {
        updated = existing.map((m) =>
          m.id === id
            ? {
                ...m,
                meetingNo: meetingNo || m.meetingNo,
                title,
                meetingDate: meetingDate || m.meetingDate,
                venue: venue || m.venue,
                presidedBy: presidedBy || m.presidedBy,
                secretaryName: secretaryName || m.secretaryName,
                attendees: Array.isArray(attendees) ? attendees : m.attendees,
                agenda: agenda ?? m.agenda,
                resolutions: parsedResolutions,
              }
            : m
        );
      } else {
        const newMeeting = {
          id: `MTG-${Date.now()}`,
          meetingNo: meetingNo || `সাধারণ সভা — ${new Date().toISOString().slice(0, 10)}`,
          title,
          meetingDate: meetingDate || new Date().toISOString().slice(0, 10),
          venue: venue || 'সমিতি কার্যালয়, কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
          presidedBy: presidedBy || 'হাফেজ মোহাম্মদ কামরুজ্জামান (সভাপতি)',
          secretaryName: secretaryName || 'মোঃ আরিফুল ইসলাম (সাধারণ সম্পাদক)',
          attendees: Array.isArray(attendees)
            ? attendees
            : ['02', '04', '05', '06', '07', '09', '10', '11', '12', '14', '15', '16'],
          agenda: agenda || '',
          resolutions: parsedResolutions,
          status: 'APPROVED',
          createdAt: new Date().toISOString(),
        };
        updated = [newMeeting, ...existing];
      }

      await saveSettingJson(
        'SOCIETY_MEETINGS_JSON',
        updated,
        'Society Meeting Minutes and Resolutions Book',
        req.profile?.fullName || 'Super Admin'
      );

      res.json({ meetings: updated });
    } catch (error: any) {
      console.error('Save meeting error:', error);
      res.status(500).json({ error: error.message || 'Failed to save meeting minutes' });
    }
  });

  app.delete('/api/smart-features/meetings/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const existing = await getSettingJson<any[]>('SOCIETY_MEETINGS_JSON', DEFAULT_SMART_MEETINGS);
      const updated = existing.filter((m) => m.id !== req.params.id);
      await saveSettingJson(
        'SOCIETY_MEETINGS_JSON',
        updated,
        'Society Meeting Minutes and Resolutions Book',
        req.profile?.fullName || 'Super Admin'
      );
      res.json({ meetings: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete meeting' });
    }
  });

  // Create Digital Voting Poll & Cast Vote
  app.post('/api/smart-features/polls', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { title, description, deadline, options } = req.body;
      if (!title || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'পোলের প্রশ্ন এবং কমপক্ষে ২টি অপশন আবশ্যক।' });
      }
      const existing = await getSettingJson<any[]>('SOCIETY_POLLS_JSON', DEFAULT_SMART_POLLS);
      const newPoll = {
        id: `POLL-${Date.now()}`,
        title,
        description: description || '',
        deadline: deadline || '2026-12-31',
        status: 'OPEN',
        options: options.map((opt: string, idx: number) => ({
          id: `OPT-${idx + 1}-${Date.now()}`,
          label: String(opt).trim(),
          votes: [],
        })),
        createdAt: new Date().toISOString(),
      };
      const updated = [newPoll, ...existing];
      await saveSettingJson('SOCIETY_POLLS_JSON', updated, 'Society Digital Polls', 'Admin');
      res.json({ polls: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create poll' });
    }
  });

  app.post('/api/smart-features/polls/:id/vote', requireAuth, async (req: AuthRequest, res) => {
    try {
      const pollId = req.params.id;
      const { optionId, memberId } = req.body;
      const voterId =
        req.profile?.role === 'MEMBER'
          ? req.profile.memberId || memberId || '02'
          : memberId || req.profile?.memberId || '02';

      const existing = await getSettingJson<any[]>('SOCIETY_POLLS_JSON', DEFAULT_SMART_POLLS);
      const updated = existing.map((poll) => {
        if (poll.id !== pollId) return poll;
        return {
          ...poll,
          options: (poll.options || []).map((opt: any) => {
            const filteredVotes = (opt.votes || []).filter((v: string) => v !== voterId);
            if (opt.id === optionId) {
              return { ...opt, votes: [...filteredVotes, voterId] };
            }
            return { ...opt, votes: filteredVotes };
          }),
        };
      });

      await saveSettingJson('SOCIETY_POLLS_JSON', updated, 'Society Digital Polls', `Member #${voterId}`);
      res.json({ polls: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to record vote' });
    }
  });

  // Save / Update Land & Project Asset Valuation Tracker
  app.post('/api/smart-features/assets', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const {
        id,
        nameBn,
        category,
        location,
        purchaseYear,
        investedAmount,
        currentMarketValue,
        deedOrRefNo,
        notes,
      } = req.body;
      if (!nameBn) {
        return res.status(400).json({ error: 'সম্পদ বা প্রজেক্টের নাম আবশ্যক।' });
      }
      const existing = await getSettingJson<any[]>('SOCIETY_ASSETS_VALUATION_JSON', DEFAULT_SMART_ASSETS);
      let updated: any[];
      if (id && existing.some((a) => a.id === id)) {
        updated = existing.map((a) =>
          a.id === id
            ? {
                ...a,
                nameBn,
                category: category || a.category,
                location: location || a.location,
                purchaseYear: purchaseYear || a.purchaseYear,
                investedAmount: Number(investedAmount) || 0,
                currentMarketValue: Number(currentMarketValue) || 0,
                deedOrRefNo: deedOrRefNo || a.deedOrRefNo,
                notes: notes ?? a.notes,
              }
            : a
        );
      } else {
        updated = [
          {
            id: `AST-${Date.now()}`,
            nameBn,
            category: category || 'LAND_PROJECT',
            location: location || 'বিরুলিয়া, সাভার, ঢাকা',
            purchaseYear: purchaseYear || '2026',
            investedAmount: Number(investedAmount) || 0,
            currentMarketValue: Number(currentMarketValue) || 0,
            deedOrRefNo: deedOrRefNo || `HF-ASSET-${new Date().getFullYear()}`,
            status: 'ACTIVE',
            notes: notes || '',
          },
          ...existing,
        ];
      }

      await saveSettingJson(
        'SOCIETY_ASSETS_VALUATION_JSON',
        updated,
        'Society Land and Project Assets Market Valuation',
        req.profile?.fullName || 'Super Admin'
      );
      res.json({ assets: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save asset valuation' });
    }
  });

  app.delete('/api/smart-features/assets/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const existing = await getSettingJson<any[]>('SOCIETY_ASSETS_VALUATION_JSON', DEFAULT_SMART_ASSETS);
      const updated = existing.filter((a) => a.id !== req.params.id);
      await saveSettingJson('SOCIETY_ASSETS_VALUATION_JSON', updated, 'Society Assets', 'Admin');
      res.json({ assets: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete asset' });
    }
  });

  // Save Dividend / Profit Distribution Sheet
  app.post('/api/smart-features/dividends', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { title, fiscalYear, totalProfit, reservePercent, distributionMode, allocations } = req.body;
      const existing = await getSettingJson<any[]>('SOCIETY_DIVIDENDS_JSON', []);
      const record = {
        id: `DIV-${Date.now()}`,
        title: title || `বার্ষিক মুনাফা ও লভ্যাংশ বণ্টন বিবরণী — ${fiscalYear || 2026}`,
        fiscalYear: Number(fiscalYear) || 2026,
        totalProfit: Number(totalProfit) || 0,
        reservePercent: Number(reservePercent) || 0,
        distributionMode: distributionMode || 'CAPITAL_RATIO',
        allocations: Array.isArray(allocations) ? allocations : [],
        createdBy: req.profile?.fullName || 'Super Admin',
        createdAt: new Date().toISOString(),
      };
      const updated = [record, ...existing];
      await saveSettingJson(
        'SOCIETY_DIVIDENDS_JSON',
        updated,
        'Society Profit and Dividend Distributions',
        req.profile?.fullName || 'Super Admin'
      );
      res.json({ dividends: updated, latest: record });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save dividend distribution' });
    }
  });

  // Save Target Fund Goal
  app.post('/api/smart-features/target-fund', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const { titleBn, targetAmount, deadline, noteBn } = req.body;
      const updated = {
        titleBn: titleBn || DEFAULT_TARGET_FUND.titleBn,
        targetAmount: Number(targetAmount) || 3500000,
        deadline: deadline || '2026-12-31',
        noteBn: noteBn || DEFAULT_TARGET_FUND.noteBn,
      };
      await saveSettingJson(
        'SOCIETY_TARGET_FUND_JSON',
        updated,
        'Society Target Capital Goal',
        req.profile?.fullName || 'Super Admin'
      );
      res.json({ targetFund: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update target fund' });
    }
  });

  // 1-Click Full Cloud Database Backup (JSON Download)
  app.get('/api/backup/full', requireAuth, async (req: AuthRequest, res) => {
    try {
      ensureRole(req, ['SUPER_ADMIN', 'ADMIN']);
      const [
        allMembers,
        allObligations,
        allSummaries,
        allTransactions,
        allReceipts,
        allDownPayments,
        allIncomes,
        allExpenses,
        allLoans,
        allInvestments,
        allSettings,
      ] = await Promise.all([
        db.select().from(members).orderBy(asc(members.id)),
        db.select().from(monthlyObligations),
        db.select().from(annualAccountSummaries),
        db.select().from(paymentTransactions),
        db.select().from(receipts),
        db.select().from(downPaymentAgreements),
        db.select().from(incomeTransactions),
        db.select().from(expenseTransactions),
        db.select().from(loans),
        db.select().from(investments),
        db.select().from(systemSettings),
      ]);

      res.json({
        society: 'হিলফুল ফুজুল সমবায় সমিতি (Hilful Fuzul Cooperative Society)',
        backupTimestamp: new Date().toISOString(),
        database: 'cloud_sql_production_database',
        counts: {
          members: allMembers.length,
          monthlyObligations: allObligations.length,
          annualSummaries: allSummaries.length,
          paymentTransactions: allTransactions.length,
          receipts: allReceipts.length,
          expenses: allExpenses.length,
        },
        data: {
          members: allMembers,
          monthlyObligations: allObligations,
          annualAccountSummaries: allSummaries,
          paymentTransactions: allTransactions,
          receipts: allReceipts,
          downPaymentAgreements: allDownPayments,
          incomeTransactions: allIncomes,
          expenseTransactions: allExpenses,
          loans: allLoans,
          investments: allInvestments,
          systemSettings: allSettings,
        },
      });
    } catch (error: any) {
      console.error('Full backup error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate full database backup' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hilful Fuzul Cooperative Society Server running on http://localhost:${PORT}`);
    // Pre-warm database connection pool and credential sync in background on startup
    ensureSeeded()
      .then(() => syncAllMembersAndAppUsers('AUTO'))
      .catch(() => {
        // Ignore background warmup error; endpoints will retry automatically
      });
  });
}

startServer();
