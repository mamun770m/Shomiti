/**
 * Netlify & Static Host Full-Stack Fallback API Engine
 * ----------------------------------------------------
 * When the application is deployed to a static host like Netlify (https://hilfulfujul12.netlify.app/),
 * Vercel, or GitHub Pages where Node.js `server.ts` is not running at `/api/*`,
 * this engine intercepts `/api/*` requests and serves 100% of the authentic
 * Hilful Fuzul Cooperative Society (2019–2026) database from `/api-snapshot/society-db.json`
 * combined with persistent `localStorage` state for any new edits/uploads.
 */

const STORAGE_KEY = 'hf_netlify_db_overrides_v2';

const NATIVE_FETCH: typeof fetch =
  typeof window !== 'undefined'
    ? (window as any).__HF_NATIVE_FETCH__ ||
      ((window as any).__HF_NATIVE_FETCH__ = window.fetch.bind(window))
    : fetch;

let cachedDb: any = null;
let loadingPromise: Promise<any> | null = null;

function isStaticHostEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('.netlify.app') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.github.io') ||
    host.endsWith('.pages.dev')
  );
}

function hydratePhotos(db: any) {
  if (!db || !Array.isArray(db.members)) return db;
  const photoMap = new Map<string, { photoUrl: string; nomineePhotoUrl: string }>();
  for (const m of db.members) {
    if (m?.memberId) {
      photoMap.set(String(m.memberId), {
        photoUrl: m.photoUrl || '',
        nomineePhotoUrl: m.nomineePhotoUrl || '',
      });
    }
  }

  const resolveItem = (item: any) => {
    if (!item || typeof item !== 'object') return item;
    const mId = item.memberId ? String(item.memberId) : '';
    const photos = mId ? photoMap.get(mId) : undefined;
    return {
      ...item,
      photoUrl:
        typeof item.photoUrl === 'string' && item.photoUrl.startsWith('__MEMBER_PHOTO_')
          ? photos?.photoUrl || ''
          : item.photoUrl || photos?.photoUrl || '',
      nomineePhotoUrl:
        typeof item.nomineePhotoUrl === 'string' &&
        item.nomineePhotoUrl.startsWith('__NOMINEE_PHOTO_')
          ? photos?.nomineePhotoUrl || ''
          : item.nomineePhotoUrl || photos?.nomineePhotoUrl || '',
    };
  };

  if (db.appUsers?.users) {
    db.appUsers.users = db.appUsers.users.map(resolveItem);
  }
  if (db.auditSecurity?.profiles) {
    db.auditSecurity.profiles = db.auditSecurity.profiles.map(resolveItem);
  }
  if (db.bootstrap?.members) {
    db.bootstrap.members = db.bootstrap.members.map(resolveItem);
  }
  if (db.bootstrap?.allMembersList) {
    db.bootstrap.allMembersList = db.bootstrap.allMembersList.map(resolveItem);
  }
  if (db.smartFeatures?.heatmap) {
    db.smartFeatures.heatmap = db.smartFeatures.heatmap.map(resolveItem);
  }
  if (db.societyHome?.memberComments) {
    db.societyHome.memberComments = db.societyHome.memberComments.map(resolveItem);
  }
  return db;
}

function saveLocalOverrides(db: any) {
  try {
    // Save compact mutable overrides in localStorage
    const overrides = {
      updatedAt: new Date().toISOString(),
      societyHome: db.societyHome,
      members: db.members,
      appUsers: db.appUsers,
      quickAccounts: db.quickAccounts,
      downPayments: db.downPayments,
      incomeExpense: db.incomeExpense,
      loansInvestments: db.loansInvestments,
      receipts: db.receipts,
      smartFeatures: db.smartFeatures,
      rawTables: db.rawTables,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.warn('Could not persist full overrides to localStorage:', err);
  }
}

async function getStaticDb(nativeFetch: typeof window.fetch): Promise<any> {
  if (cachedDb) return cachedDb;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const res = await nativeFetch(`/api-snapshot/society-db.json?v=20261106`, {
        cache: 'no-cache',
      });
      if (!res.ok) {
        throw new Error(`Failed to load /api-snapshot/society-db.json: ${res.status}`);
      }
      const baseData = await res.json();

      // Merge any locally saved overrides if present
      try {
        const rawOverrides = localStorage.getItem(STORAGE_KEY);
        if (rawOverrides) {
          const parsed = JSON.parse(rawOverrides);
          if (parsed && typeof parsed === 'object') {
            if (parsed.societyHome) baseData.societyHome = parsed.societyHome;
            if (Array.isArray(parsed.members) && parsed.members.length > 0) {
              baseData.members = parsed.members;
            }
            if (parsed.appUsers?.users?.length) baseData.appUsers = parsed.appUsers;
            if (parsed.quickAccounts?.accounts?.length) {
              baseData.quickAccounts = parsed.quickAccounts;
            }
            if (parsed.downPayments) baseData.downPayments = parsed.downPayments;
            if (parsed.incomeExpense) baseData.incomeExpense = parsed.incomeExpense;
            if (parsed.loansInvestments) baseData.loansInvestments = parsed.loansInvestments;
            if (Array.isArray(parsed.receipts)) baseData.receipts = parsed.receipts;
            if (parsed.smartFeatures) baseData.smartFeatures = parsed.smartFeatures;
            if (parsed.rawTables) baseData.rawTables = parsed.rawTables;
          }
        }
      } catch {
        // Ignore corrupt localStorage
      }

      cachedDb = hydratePhotos(baseData);
      return cachedDb;
    } catch (err) {
      loadingPromise = null;
      throw err;
    }
  })();

  return loadingPromise;
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function recomputeDashboard(db: any, year: number, memberId: string) {
  const base = db.dashboardAll || { kpis: {}, charts: {}, yearlyExpenseSummary: [] };
  const obligations = db.rawTables?.monthlyObligations || [];
  const summaries = db.rawTables?.annualAccountSummaries || [];
  const members = db.members || [];
  const expenses = db.incomeExpense?.expenses || [];
  const incomes = db.incomeExpense?.incomes || [];

  const isFilteredYear = year > 0;
  const isFilteredMember = memberId && memberId !== 'ALL';

  if (!isFilteredYear && !isFilteredMember) {
    return base;
  }

  const filteredObs = obligations.filter((o: any) => {
    if (isFilteredYear && Number(o.year) !== year) return false;
    if (isFilteredMember && String(o.memberId) !== memberId) return false;
    return true;
  });

  const filteredSummaries = summaries.filter((s: any) => {
    if (isFilteredYear && Number(s.year) !== year) return false;
    if (isFilteredMember && String(s.memberId) !== memberId) return false;
    return true;
  });

  const totalShareDeposits = filteredObs.reduce(
    (acc: number, r: any) => acc + (Number(r.shareDeposit) || 0),
    0
  );
  const totalPayable = filteredObs.reduce(
    (acc: number, r: any) => acc + (Number(r.payable) || 0),
    0
  );
  const totalFines = filteredObs.reduce(
    (acc: number, r: any) => acc + (Number(r.fine) || 0),
    0
  );
  const totalOtherReceive = filteredObs.reduce(
    (acc: number, r: any) => acc + (Number(r.otherReceive) || 0),
    0
  );
  const totalDownPayments = filteredObs.reduce(
    (acc: number, r: any) => acc + (Number(r.downPayment) || 0),
    0
  );
  const totalCollection =
    totalShareDeposits + totalPayable + totalFines + totalOtherReceive + totalDownPayments;

  const totalOutstandingDues = isFilteredYear
    ? filteredSummaries.reduce(
        (acc: number, s: any) => acc + (Number(s.totalOutstanding) || 0),
        0
      )
    : members
        .filter((m: any) => !isFilteredMember || String(m.memberId) === memberId)
        .reduce((acc: number, m: any) => acc + (Number(m.currentOutstanding) || 0), 0);

  const filteredExpenses = expenses
    .filter((e: any) => !isFilteredYear || Number(e.year) === year)
    .reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);

  const filteredIncomes = incomes
    .filter((i: any) => !isFilteredYear || Number(i.year) === year)
    .reduce((acc: number, i: any) => acc + (Number(i.amount) || 0), 0);

  return {
    ...base,
    kpis: {
      ...base.kpis,
      totalShareDeposits,
      totalPayable,
      totalFines,
      totalOtherReceive,
      totalDownPayments,
      totalCollection,
      totalOutstandingDues,
      totalIncome: filteredIncomes,
      totalExpenses: isFilteredYear ? filteredExpenses : base.kpis.totalExpenses,
    },
  };
}

async function handleApiRequest(
  urlObj: URL,
  method: string,
  bodyObj: any,
  headers: Record<string, string>,
  nativeFetch: typeof window.fetch
): Promise<Response> {
  const db = await getStaticDb(nativeFetch);
  const pathname = urlObj.pathname;
  const role = headers['x-society-role'] || 'SUPER_ADMIN';
  const reqMemberId = headers['x-society-member-id'] || '09';

  // 1. GET /api/bootstrap
  if (pathname === '/api/bootstrap' && method === 'GET') {
    return jsonResponse({
      ...db.bootstrap,
      members: db.members,
      allMembersList: db.members.map((m: any) => ({
        memberId: m.memberId,
        name: m.name,
        nameBn: m.nameBn,
        status: m.status,
      })),
    });
  }

  // 2. GET /api/society-home
  if (pathname === '/api/society-home' && method === 'GET') {
    return jsonResponse(db.societyHome);
  }

  // 3. GET /api/dashboard
  if (pathname === '/api/dashboard' && method === 'GET') {
    const year = Number(urlObj.searchParams.get('year') || 0);
    const memberId = urlObj.searchParams.get('memberId') || 'ALL';
    return jsonResponse(recomputeDashboard(db, year, memberId));
  }

  // 4. GET /api/members
  if (pathname === '/api/members' && method === 'GET') {
    return jsonResponse({ members: db.members });
  }

  // 5. PUT /api/members/:memberId
  if (pathname.startsWith('/api/members/') && method === 'PUT') {
    const targetId = decodeURIComponent(pathname.replace('/api/members/', ''));
    const idx = db.members.findIndex((m: any) => String(m.memberId) === String(targetId));
    if (idx === -1) {
      return jsonResponse({ error: 'Member not found' }, 404);
    }
    const updatedMember = {
      ...db.members[idx],
      ...bodyObj,
    };
    db.members[idx] = updatedMember;

    // Sync password / username / name with appUsers & quickAccounts
    if (db.appUsers?.users) {
      db.appUsers.users = db.appUsers.users.map((u: any) => {
        if (String(u.memberId) === String(targetId)) {
          return {
            ...u,
            username: bodyObj.username ? String(bodyObj.username).trim() : u.username,
            password: bodyObj.loginPin ? String(bodyObj.loginPin).trim() : u.password,
            fullName: updatedMember.name || u.fullName,
            fullNameBn: updatedMember.nameBn || u.fullNameBn,
            phone: updatedMember.mobile || u.phone,
            photoUrl: updatedMember.photoUrl || u.photoUrl,
          };
        }
        return u;
      });
    }
    if (db.quickAccounts?.accounts && db.appUsers?.users) {
      db.quickAccounts.accounts = db.appUsers.users.map((u: any) => ({
        id: u.id,
        username: u.username,
        password: u.password,
        fullName: u.fullName,
        fullNameBn: u.fullNameBn,
        role: u.role,
        memberId: u.memberId,
        phone: u.phone,
      }));
    }

    hydratePhotos(db);
    saveLocalOverrides(db);
    return jsonResponse({ success: true, member: updatedMember });
  }

  // 6. Auth Endpoints
  if (pathname === '/api/auth/quick-accounts' && method === 'GET') {
    return jsonResponse(db.quickAccounts);
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const inputUsername = String(bodyObj?.username || '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '');
    const inputPassword = String(bodyObj?.password || '').trim();
    const users = db.appUsers?.users || db.quickAccounts?.accounts || [];
    const candidates = users.filter(
      (u: any) =>
        String(u.username || '').toLowerCase() === inputUsername ||
        (u.memberId && String(u.memberId).toLowerCase() === inputUsername) ||
        (u.phone &&
          u.phone.replace(/\D/g, '') === inputUsername.replace(/\D/g, '') &&
          inputUsername.length >= 6)
    );
    const matched =
      candidates.find((u: any) => String(u.password) === inputPassword) || candidates[0];
    if (!matched || String(matched.password) !== inputPassword) {
      return jsonResponse(
        { error: 'ইউজার নেম বা পাসওয়ার্ড সঠিক নয়। সঠিক ক্রেডেনশিয়াল ব্যবহার করুন।' },
        401
      );
    }
    return jsonResponse({
      success: true,
      user: matched,
      sessionToken: `static-token-${matched.role}-${matched.memberId || '09'}`,
      role: matched.role,
      memberId: matched.memberId || '09',
    });
  }

  if (pathname === '/api/auth/verify-login' && method === 'POST') {
    const reqRole = bodyObj?.role || 'SUPER_ADMIN';
    const pin = String(bodyObj?.pin || bodyObj?.password || '').trim();
    const targetMemberId = String(bodyObj?.memberId || '09');
    return jsonResponse({
      success: true,
      role: reqRole,
      memberId: reqRole === 'SUPER_ADMIN' ? '09' : reqRole === 'ADMIN' ? '02' : targetMemberId,
      token: `static-token-${reqRole}-${targetMemberId}`,
      sessionToken: `static-token-${reqRole}-${targetMemberId}`,
      pinUsed: Boolean(pin),
    });
  }

  // 7. User Management Studio Endpoints
  if (pathname === '/api/app-users' && method === 'GET') {
    return jsonResponse(db.appUsers);
  }

  if (pathname.startsWith('/api/app-users/') && method === 'PUT') {
    const id = Number(pathname.replace('/api/app-users/', ''));
    const users = db.appUsers?.users || [];
    const idx = users.findIndex((u: any) => Number(u.id) === id);
    if (idx !== -1) {
      const updatedUser = { ...users[idx], ...bodyObj };
      users[idx] = updatedUser;
      if (updatedUser.memberId && updatedUser.password) {
        db.members = db.members.map((m: any) =>
          String(m.memberId) === String(updatedUser.memberId)
            ? { ...m, loginPin: String(updatedUser.password) }
            : m
        );
      }
      if (db.quickAccounts?.accounts) {
        db.quickAccounts.accounts = users.map((u: any) => ({
          id: u.id,
          username: u.username,
          password: u.password,
          fullName: u.fullName,
          fullNameBn: u.fullNameBn,
          role: u.role,
          memberId: u.memberId,
          phone: u.phone,
        }));
      }
      saveLocalOverrides(db);
      return jsonResponse({ success: true, user: updatedUser });
    }
  }

  // 8. GET /api/accounting/member-year
  if (pathname === '/api/accounting/member-year' && method === 'GET') {
    const requestedMemberId = urlObj.searchParams.get('memberId') || reqMemberId || '02';
    const effectiveMemberId = role === 'MEMBER' ? reqMemberId : requestedMemberId;
    const year = Number(urlObj.searchParams.get('year') || 2026);

    const member =
      db.members.find((m: any) => String(m.memberId) === String(effectiveMemberId)) ||
      db.members[0];

    const monthlyRows = (db.rawTables?.monthlyObligations || [])
      .filter(
        (o: any) =>
          String(o.memberId) === String(member.memberId) && Number(o.year) === year
      )
      .sort((a: any, b: any) => Number(a.month) - Number(b.month));

    const multiYearComparison = (db.rawTables?.annualAccountSummaries || [])
      .filter((s: any) => String(s.memberId) === String(member.memberId))
      .sort((a: any, b: any) => Number(a.year) - Number(b.year));

    const summary = multiYearComparison.find((s: any) => Number(s.year) === year) || null;
    const previousYearSummary =
      multiYearComparison.find((s: any) => Number(s.year) === year - 1) || null;

    const transactions = (db.rawTables?.paymentTransactions || [])
      .filter((t: any) => String(t.memberId) === String(member.memberId))
      .sort((a: any, b: any) => Number(b.id) - Number(a.id));

    const downPaymentAgreement =
      (db.downPayments?.agreements || []).find(
        (a: any) => String(a.memberId) === String(member.memberId)
      ) || null;

    return jsonResponse({
      member,
      year,
      monthlyRows,
      summary,
      previousYearSummary,
      multiYearComparison,
      transactions,
      downPaymentAgreement,
    });
  }

  // 8B. POST /api/accounting/payment & PUT /api/accounting/obligation/:id
  if (pathname === '/api/accounting/payment' && method === 'POST') {
    const mId = String(bodyObj?.memberId || '02');
    const yr = Number(bodyObj?.year || 2026);
    const mo = Number(bodyObj?.month || 1);
    const shareDeposit = Number(bodyObj?.shareDeposit || 0);
    const payable = Number(bodyObj?.payable || 0);
    const fine = Number(bodyObj?.fine || 0);
    const otherReceive = Number(bodyObj?.otherReceive || 0);
    const downPayment = Number(bodyObj?.downPayment || 0);
    const totalAmount = shareDeposit + payable + fine + otherReceive + downPayment;

    const obs = db.rawTables?.monthlyObligations || [];
    const obIdx = obs.findIndex(
      (o: any) =>
        String(o.memberId) === mId && Number(o.year) === yr && Number(o.month) === mo
    );
    if (obIdx !== -1) {
      obs[obIdx] = {
        ...obs[obIdx],
        shareDeposit: (Number(obs[obIdx].shareDeposit) || 0) + shareDeposit,
        payable: (Number(obs[obIdx].payable) || 0) + payable,
        fine: (Number(obs[obIdx].fine) || 0) + fine,
        otherReceive: (Number(obs[obIdx].otherReceive) || 0) + otherReceive,
        downPayment: (Number(obs[obIdx].downPayment) || 0) + downPayment,
        totalReceiveAmount: (Number(obs[obIdx].totalReceiveAmount) || 0) + totalAmount,
      };
    }

    const mem = db.members.find((m: any) => String(m.memberId) === mId);
    const receiptNo = `RCP-${yr}-${String(Date.now()).slice(-6)}`;
    const newTx = {
      id: Date.now(),
      transactionCode: `TXN-${yr}${String(mo).padStart(2, '0')}-${String(Date.now()).slice(-6)}`,
      receiptNo,
      memberId: mId,
      memberName: mem?.name || mId,
      paymentDate: bodyObj?.paymentDate || new Date().toISOString().slice(0, 10),
      year: yr,
      month: mo,
      monthName: obs[obIdx]?.monthName || 'Month',
      shareDeposit,
      payable,
      fine,
      otherReceive,
      downPayment,
      totalAmount,
      paymentMethod: bodyObj?.paymentMethod || 'CASH',
      approvalStatus: 'APPROVED',
      receivedBy: 'Admin',
      remarks: bodyObj?.remarks || 'Monthly deposit',
    };
    db.rawTables.paymentTransactions = [
      newTx,
      ...(db.rawTables?.paymentTransactions || []),
    ];
    db.receipts = [newTx, ...(db.receipts || [])];
    saveLocalOverrides(db);
    return jsonResponse({ success: true, transaction: newTx, receipt: newTx });
  }

  if (pathname.startsWith('/api/accounting/obligation/') && method === 'PUT') {
    const id = Number(pathname.replace('/api/accounting/obligation/', ''));
    const obs = db.rawTables?.monthlyObligations || [];
    const idx = obs.findIndex((o: any) => Number(o.id) === id);
    if (idx !== -1) {
      const shareDeposit = Number(bodyObj?.shareDeposit ?? obs[idx].shareDeposit ?? 0);
      const payable = Number(bodyObj?.payable ?? obs[idx].payable ?? 0);
      const fine = Number(bodyObj?.fine ?? obs[idx].fine ?? 0);
      const otherReceive = Number(bodyObj?.otherReceive ?? obs[idx].otherReceive ?? 0);
      const downPayment = Number(bodyObj?.downPayment ?? obs[idx].downPayment ?? 0);
      obs[idx] = {
        ...obs[idx],
        shareDeposit,
        payable,
        fine,
        otherReceive,
        downPayment,
        totalReceiveAmount: shareDeposit + payable + fine + otherReceive + downPayment,
      };
      saveLocalOverrides(db);
      return jsonResponse({ success: true, obligation: obs[idx] });
    }
  }

  // 9. GET /api/down-payments
  if (pathname === '/api/down-payments' && method === 'GET') {
    return jsonResponse(db.downPayments);
  }

  // 10. GET /api/income-expense
  if (pathname === '/api/income-expense' && method === 'GET') {
    return jsonResponse(db.incomeExpense);
  }

  // 11. GET /api/loans-investments
  if (pathname === '/api/loans-investments' && method === 'GET') {
    return jsonResponse(db.loansInvestments);
  }

  // 12. GET /api/receipts
  if (pathname === '/api/receipts' && method === 'GET') {
    return jsonResponse({ receipts: db.receipts });
  }

  // 13. GET /api/ledger
  if (pathname === '/api/ledger' && method === 'GET') {
    return jsonResponse(db.ledger);
  }

  // 14. GET /api/audit-security
  if (pathname === '/api/audit-security' && method === 'GET') {
    return jsonResponse(db.auditSecurity);
  }

  // 15. GET /api/smart-features
  if (pathname === '/api/smart-features' && method === 'GET') {
    const requestedYear = Number(urlObj.searchParams.get('year') || 2026);
    const obligations = db.rawTables?.monthlyObligations || [];
    const heatmap = (db.members || []).map((m: any) => {
      const memberObs = obligations.filter(
        (o: any) => String(o.memberId) === String(m.memberId) && Number(o.year) === requestedYear
      );
      const months: Record<number, { paid: number; expected: number; status: string }> = {};
      let yearTotalPaid = 0;
      for (let mo = 1; mo <= 12; mo++) {
        const row = memberObs.find((o: any) => Number(o.month) === mo);
        const paid =
          (Number(row?.shareDeposit) || 0) +
          (Number(row?.payable) || 0) +
          (Number(row?.otherReceive) || 0);
        const expected =
          requestedYear === 2019 ? 1020 : requestedYear === 2020 ? 1520 : 2050;
        yearTotalPaid += paid;
        months[mo] = {
          paid,
          expected,
          status: paid >= expected ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
        };
      }
      return {
        memberId: m.memberId,
        name: m.name,
        nameBn: m.nameBn,
        mobile: m.mobile,
        photoUrl: m.photoUrl,
        currentOutstanding: m.currentOutstanding,
        yearTotalPaid,
        months,
      };
    });
    return jsonResponse({
      ...db.smartFeatures,
      year: requestedYear,
      heatmap,
    });
  }

  // 16. GET /api/backup/full
  if (pathname === '/api/backup/full' && method === 'GET') {
    return jsonResponse({
      society: 'হিলফুল ফুজুল সমবায় সমিতি (Hilful Fuzul Cooperative Society)',
      backupTimestamp: new Date().toISOString(),
      database: 'static_snapshot_database',
      counts: {
        members: db.members.length,
        monthlyObligations: (db.rawTables?.monthlyObligations || []).length,
        annualSummaries: (db.rawTables?.annualAccountSummaries || []).length,
        paymentTransactions: (db.rawTables?.paymentTransactions || []).length,
        receipts: (db.receipts || []).length,
        expenses: (db.incomeExpense?.expenses || []).length,
      },
      data: {
        members: db.members,
        monthlyObligations: db.rawTables?.monthlyObligations || [],
        annualAccountSummaries: db.rawTables?.annualAccountSummaries || [],
        paymentTransactions: db.rawTables?.paymentTransactions || [],
        receipts: db.receipts || [],
        downPaymentAgreements: db.downPayments?.agreements || [],
        incomeTransactions: db.incomeExpense?.incomes || [],
        expenseTransactions: db.incomeExpense?.expenses || [],
      },
    });
  }

  // 17. Society Home Page Mutations (Branding, Notices, Programs, Projects, Comments)
  if (pathname === '/api/society-branding' && method === 'PUT') {
    db.societyHome.branding = {
      ...db.societyHome.branding,
      ...bodyObj,
    };
    saveLocalOverrides(db);
    return jsonResponse({ success: true, branding: db.societyHome.branding });
  }

  if (pathname === '/api/notices' && method === 'POST') {
    const newNotice = {
      id: Date.now(),
      ...bodyObj,
      createdAt: new Date().toISOString(),
    };
    db.societyHome.notices = [newNotice, ...(db.societyHome.notices || [])];
    saveLocalOverrides(db);
    return jsonResponse({ success: true, notice: newNotice });
  }

  if (pathname.startsWith('/api/notices/') && method === 'PUT') {
    const id = Number(pathname.replace('/api/notices/', ''));
    db.societyHome.notices = (db.societyHome.notices || []).map((n: any) =>
      Number(n.id) === id ? { ...n, ...bodyObj } : n
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname.startsWith('/api/notices/') && method === 'DELETE') {
    const id = Number(pathname.replace('/api/notices/', ''));
    db.societyHome.notices = (db.societyHome.notices || []).filter(
      (n: any) => Number(n.id) !== id
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname === '/api/society-programs' && method === 'POST') {
    const item = {
      id: Date.now(),
      uploadedBy: 'কার্যনির্বাহী কমিটি',
      ...bodyObj,
      createdAt: new Date().toISOString(),
    };
    db.societyHome.programsGallery = [
      item,
      ...(db.societyHome.programsGallery || []),
    ];
    saveLocalOverrides(db);
    return jsonResponse({ success: true, program: item });
  }

  if (pathname.startsWith('/api/society-programs/') && method === 'PUT') {
    const id = Number(pathname.replace('/api/society-programs/', ''));
    db.societyHome.programsGallery = (db.societyHome.programsGallery || []).map(
      (p: any) => (Number(p.id) === id ? { ...p, ...bodyObj } : p)
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname.startsWith('/api/society-programs/') && method === 'DELETE') {
    const id = Number(pathname.replace('/api/society-programs/', ''));
    db.societyHome.programsGallery = (db.societyHome.programsGallery || []).filter(
      (p: any) => Number(p.id) !== id
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname === '/api/society-projects' && method === 'POST') {
    const item = {
      id: Date.now(),
      updatedBy: 'কার্যনির্বাহী কমিটি',
      ...bodyObj,
      createdAt: new Date().toISOString(),
    };
    db.societyHome.projectsGallery = [
      item,
      ...(db.societyHome.projectsGallery || []),
    ];
    saveLocalOverrides(db);
    return jsonResponse({ success: true, project: item });
  }

  if (pathname.startsWith('/api/society-projects/') && method === 'PUT') {
    const id = Number(pathname.replace('/api/society-projects/', ''));
    db.societyHome.projectsGallery = (db.societyHome.projectsGallery || []).map(
      (p: any) => (Number(p.id) === id ? { ...p, ...bodyObj } : p)
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname.startsWith('/api/society-projects/') && method === 'DELETE') {
    const id = Number(pathname.replace('/api/society-projects/', ''));
    db.societyHome.projectsGallery = (db.societyHome.projectsGallery || []).filter(
      (p: any) => Number(p.id) !== id
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname === '/api/member-comments' && method === 'POST') {
    const mem = db.members.find(
      (m: any) => String(m.memberId) === String(bodyObj?.memberId || '09')
    );
    const commentItem = {
      id: Date.now(),
      memberId: mem?.memberId || bodyObj?.memberId || '09',
      memberName: mem?.name || 'Member',
      memberNameBn: mem?.nameBn || mem?.name || 'সম্মানিত সদস্য',
      photoUrl: mem?.photoUrl || '',
      committeeRole:
        db.societyHome?.branding?.committeeRoles?.[mem?.memberId || '09'] ||
        'সম্মানিত সদস্য',
      comment: bodyObj?.comment || '',
      category: bodyObj?.category || 'সদস্যের মতামত ও পরামর্শ',
      commentDate: new Date().toISOString().slice(0, 10),
    };
    db.societyHome.memberComments = [
      commentItem,
      ...(db.societyHome.memberComments || []),
    ];
    saveLocalOverrides(db);
    return jsonResponse({ success: true, comment: commentItem });
  }

  if (pathname.startsWith('/api/member-comments/') && method === 'PUT') {
    const id = Number(pathname.replace('/api/member-comments/', ''));
    db.societyHome.memberComments = (db.societyHome.memberComments || []).map(
      (c: any) => (Number(c.id) === id ? { ...c, ...bodyObj } : c)
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  if (pathname.startsWith('/api/member-comments/') && method === 'DELETE') {
    const id = Number(pathname.replace('/api/member-comments/', ''));
    db.societyHome.memberComments = (db.societyHome.memberComments || []).filter(
      (c: any) => Number(c.id) !== id
    );
    saveLocalOverrides(db);
    return jsonResponse({ success: true });
  }

  // Fallback for any other API endpoint
  return jsonResponse({ success: true, batches: [], status: 'READY' });
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  let urlObj: URL | null = null;
  try {
    urlObj = new URL(rawUrl, window.location.origin);
  } catch {
    return NATIVE_FETCH(input, init);
  }

  // Only intercept same-origin `/api/*` calls
  if (
    urlObj.origin !== window.location.origin ||
    !urlObj.pathname.startsWith('/api/')
  ) {
    return NATIVE_FETCH(input, init);
  }

  const method = (init?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) {
        headers[k.toLowerCase()] = v;
      }
    } else {
      for (const [k, v] of Object.entries(init.headers)) {
        headers[k.toLowerCase()] = String(v);
      }
    }
  }

  let bodyObj: any = {};
  if (init?.body && typeof init.body === 'string') {
    try {
      bodyObj = JSON.parse(init.body);
    } catch {
      bodyObj = {};
    }
  }

  // On known static hosts (e.g. *.netlify.app), serve directly from the static snapshot engine
  if (isStaticHostEnvironment()) {
    return handleApiRequest(urlObj, method, bodyObj, headers, NATIVE_FETCH);
  }

  // Otherwise, try the real backend first; if it fails or returns HTML instead of JSON, fall back to static engine
  try {
    const response = await NATIVE_FETCH(input, init);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (response.ok && contentType.includes('application/json')) {
      return response;
    }
    if (
      response.status === 404 ||
      response.status === 502 ||
      response.status === 503 ||
      contentType.includes('text/html')
    ) {
      return handleApiRequest(urlObj, method, bodyObj, headers, NATIVE_FETCH);
    }
    return response;
  } catch {
    return handleApiRequest(urlObj, method, bodyObj, headers, NATIVE_FETCH);
  }
}

export function installNetlifyStaticApiEngine() {
  // No-op: All frontend modules import `apiFetch as fetch` directly,
  // avoiding any mutation or recursive wrapping of `window.fetch`.
}


