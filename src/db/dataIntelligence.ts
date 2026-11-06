import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index.ts';
import {
  accounts,
  annualAccountSummaries,
  approvalRequests,
  appUsers,
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
} from './schema.ts';
import {
  MONTH_NAMES,
  recalculateMemberYearAccount,
  reconcileSocietyAccountBalances,
} from './accounting.ts';
import { OFFICIAL_SOCIETY_LOGO_URL } from '../lib/officialLogo.ts';
import { and, eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const HISTORICAL_YEARLY_EXPENSES: Array<{
  year: number;
  month?: number;
  transactionDate?: string;
  amount: number;
  voucherNo: string;
  category: string;
  title: string;
  remarks: string;
}> = [
  {
    year: 2019,
    amount: 10698,
    voucherNo: 'EXP-2019-ANNUAL',
    category: 'Administrative Costs',
    title: '২০১৯ সালের মোট খরচ (বাৎসরিক প্রশাসনিক ও পরিচালন ব্যয়)',
    remarks: 'খরচের হিসাব (২০১৯): মোট খরচ ৳১০,৬৯৮',
  },
  {
    year: 2020,
    amount: 6990,
    voucherNo: 'EXP-2020-ANNUAL',
    category: 'Administrative Costs',
    title: '২০২০ সালের মোট খরচ (বাৎসরিক প্রশাসনিক ও পরিচালন ব্যয়)',
    remarks: 'খরচের হিসাব (২০২০): মোট খরচ ৳৬,৯৯০',
  },
  {
    year: 2021,
    amount: 7702,
    voucherNo: 'EXP-2021-ANNUAL',
    category: 'Administrative Costs',
    title: '২০২১ সালের মোট খরচ (বাৎসরিক প্রশাসনিক ও পরিচালন ব্যয়)',
    remarks: 'খরচের হিসাব (২০২১): মোট খরচ ৳৭,৭০২',
  },
  {
    year: 2022,
    amount: 600,
    voucherNo: 'EXP-2022-ANNUAL',
    category: 'Administrative Costs',
    title: '২০২২ সালের মোট খরচ (বাৎসরিক প্রশাসনিক ও পরিচালন ব্যয়)',
    remarks: 'খরচের হিসাব (২০২২): মোট খরচ ৳৬০০',
  },
  {
    year: 2023,
    amount: 1592199,
    voucherNo: 'EXP-2023-ANNUAL',
    category: 'Administrative Costs',
    title: '২০২৩ সালের মোট খরচ (সমিতির প্রকল্প ও বাৎসরিক ব্যয় হিসাব)',
    remarks: 'খরচের হিসাব (২০২৩): মোট খরচ ৳১৫,৯২,১৯৯',
  },
  {
    year: 2024,
    amount: 902320,
    voucherNo: 'EXP-2024-ANNUAL',
    category: 'Administrative Costs',
    title: '২০২৪ সালের মোট খরচ (সমিতির প্রকল্প ও বাৎসরিক ব্যয় হিসাব)',
    remarks: 'খরচের হিসাব (২০২৪): মোট খরচ ৳৯,০২,৩২০',
  },
  {
    year: 2026,
    month: 11,
    transactionDate: '2026-11-01',
    amount: 5870,
    voucherNo: 'EXP-2026-7853',
    category: 'Other Expenses',
    title: 'খাবার খরচ',
    remarks: 'সমিতির সভা ও আপ্যায়ন খাবার খরচ (স্থায়ীভাবে সংরক্ষিত)',
  },
  {
    year: 2026,
    month: 11,
    transactionDate: '2026-11-01',
    amount: 350,
    voucherNo: 'EXP-2026-0782',
    category: 'Other Expenses',
    title: 'জায়গার খাজনা',
    remarks: 'সমিতির জায়গার খাজনা পরিশোধ (স্থায়ীভাবে সংরক্ষিত)',
  },
];

export const PERMANENT_USER_PAYMENTS: Array<{
  transactionCode: string;
  receiptNo: string;
  memberId: string;
  memberName: string;
  year: number;
  month: number;
  monthName: string;
  paymentDate: string;
  txShareDeposit: number;
  txPayable: number;
  txOtherReceive: number;
  txTotalAmount: number;
  obShareDeposit: number;
  obPayable: number;
  obOtherReceive: number;
  obTotalReceiveAmount: number;
  receivedBy: string;
  remarks: string;
}> = [
  {
    transactionCode: 'TXN-202503-7379387',
    receiptNo: 'RCP-2025-7379387',
    memberId: '02',
    memberName: 'Hafez Mohammad Kamruzzaman',
    year: 2025,
    month: 3,
    monthName: 'March',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (Admin — ID 02)',
    remarks: 'Monthly deposit (March 2025)',
  },
  {
    transactionCode: 'TXN-202603-5323411',
    receiptNo: 'RCP-2026-5323411',
    memberId: '02',
    memberName: 'Hafez Mohammad Kamruzzaman',
    year: 2026,
    month: 3,
    monthName: 'March',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (March 2026)',
  },
  {
    transactionCode: 'TXN-202604-3570413',
    receiptNo: 'RCP-2026-3570413',
    memberId: '02',
    memberName: 'Hafez Mohammad Kamruzzaman',
    year: 2026,
    month: 4,
    monthName: 'April',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (Admin — ID 02)',
    remarks: 'Monthly deposit (April 2026)',
  },
  {
    transactionCode: 'TXN-202605-5196170',
    receiptNo: 'RCP-2026-5196170',
    memberId: '02',
    memberName: 'Hafez Mohammad Kamruzzaman',
    year: 2026,
    month: 5,
    monthName: 'May',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (Admin — ID 02)',
    remarks: 'Monthly deposit (May 2026)',
  },
  {
    transactionCode: 'TXN-202606-6505425',
    receiptNo: 'RCP-2026-6505425',
    memberId: '02',
    memberName: 'Hafez Mohammad Kamruzzaman',
    year: 2026,
    month: 6,
    monthName: 'June',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (Admin — ID 02)',
    remarks: 'Monthly deposit (June 2026)',
  },
  {
    transactionCode: 'TXN-202603-9243772',
    receiptNo: 'RCP-2026-9243772',
    memberId: '05',
    memberName: 'Mst. Sadiya Akter',
    year: 2026,
    month: 3,
    monthName: 'March',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 50,
    txOtherReceive: 0,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 50,
    obOtherReceive: 0,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (March 2026)',
  },
  {
    transactionCode: 'TXN-202604-0172276',
    receiptNo: 'RCP-2026-0172276',
    memberId: '05',
    memberName: 'Mst. Sadiya Akter',
    year: 2026,
    month: 4,
    monthName: 'April',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 50,
    txOtherReceive: 0,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 50,
    obOtherReceive: 0,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (April 2026)',
  },
  {
    transactionCode: 'TXN-202605-0970241',
    receiptNo: 'RCP-2026-0970241',
    memberId: '05',
    memberName: 'Mst. Sadiya Akter',
    year: 2026,
    month: 5,
    monthName: 'May',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 50,
    txOtherReceive: 0,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 50,
    obOtherReceive: 0,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (May 2026)',
  },
  {
    transactionCode: 'TXN-202606-1722575',
    receiptNo: 'RCP-2026-1722575',
    memberId: '05',
    memberName: 'Mst. Sadiya Akter',
    year: 2026,
    month: 6,
    monthName: 'June',
    paymentDate: '2026-11-01',
    txShareDeposit: 2000,
    txPayable: 50,
    txOtherReceive: 0,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 50,
    obOtherReceive: 0,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (June 2026)',
  },
  // Member 10 — 2023 Full Year (Months 1–12)
  ...Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const codes = [
      '1529430',
      '9730937',
      '0601051',
      '1403996',
      '2249852',
      '3106965',
      '3849692',
      '4605923',
      '5490438',
      '6337062',
      '7093016',
      '7806261',
    ];
    return {
      transactionCode: `TXN-2023${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2023-${codes[idx]}`,
      memberId: '10',
      memberName: 'Md. Masudur Rahman',
      year: 2023,
      month: m,
      monthName: MONTH_NAMES[idx],
      paymentDate: m === 1 ? '2026-11-01' : '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[idx]} 2023)`,
    };
  }),
  // Member 11 — 2021 (Nov, Dec) & 2023 Full Year (Months 1–12)
  {
    transactionCode: 'TXN-202111-6433016',
    receiptNo: 'RCP-2021-6433016',
    memberId: '11',
    memberName: 'Abu kausar Bhuyan',
    year: 2021,
    month: 11,
    monthName: 'November',
    paymentDate: '2026-11-02',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (November 2021)',
  },
  {
    transactionCode: 'TXN-202112-8673595',
    receiptNo: 'RCP-2021-8673595',
    memberId: '11',
    memberName: 'Abu kausar Bhuyan',
    year: 2021,
    month: 12,
    monthName: 'December',
    paymentDate: '2026-11-02',
    txShareDeposit: 2000,
    txPayable: 0,
    txOtherReceive: 50,
    txTotalAmount: 2050,
    obShareDeposit: 2000,
    obPayable: 0,
    obOtherReceive: 50,
    obTotalReceiveAmount: 2050,
    receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
    remarks: 'Monthly deposit (December 2021)',
  },
  ...Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const codes = [
      '2809283',
      '4061379',
      '4743534',
      '5458077',
      '6439513',
      '7125756',
      '8194051',
      '8874324',
      '0316198',
      '2118186',
      '2956134',
      '3843770',
    ];
    return {
      transactionCode: `TXN-2023${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2023-${codes[idx]}`,
      memberId: '11',
      memberName: 'Abu kausar Bhuyan',
      year: 2023,
      month: m,
      monthName: MONTH_NAMES[idx],
      paymentDate: '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[idx]} 2023)`,
    };
  }),
  // Member 12 — 2023 (Months 4–12)
  ...Array.from({ length: 9 }, (_, idx) => {
    const m = idx + 4;
    const codes = [
      '1209652',
      '1883198',
      '2567966',
      '3464546',
      '4652144',
      '5383845',
      '6042724',
      '6825042',
      '7936668',
    ];
    return {
      transactionCode: `TXN-2023${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2023-${codes[idx]}`,
      memberId: '12',
      memberName: 'Riyad Arefin',
      year: 2023,
      month: m,
      monthName: MONTH_NAMES[m - 1],
      paymentDate: '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[m - 1]} 2023)`,
    };
  }),
  // Member 15 — 2023 Full Year (Months 1–12) & 2025 (Months 8–12)
  ...Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const codes = [
      '3750326',
      '4437278',
      '5067552',
      '5605629',
      '6197173',
      '6778964',
      '7432983',
      '8123941',
      '8632735',
      '9182855',
      '9715219',
      '0266520',
    ];
    return {
      transactionCode: `TXN-2023${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2023-${codes[idx]}`,
      memberId: '15',
      memberName: 'Mst. Jobeda Begum',
      year: 2023,
      month: m,
      monthName: MONTH_NAMES[idx],
      paymentDate: '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[idx]} 2023)`,
    };
  }),
  ...Array.from({ length: 5 }, (_, idx) => {
    const m = idx + 8;
    const codes = ['7874393', '8428210', '8995817', '9532940', '0077669'];
    return {
      transactionCode: `TXN-2025${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2025-${codes[idx]}`,
      memberId: '15',
      memberName: 'Mst. Jobeda Begum',
      year: 2025,
      month: m,
      monthName: MONTH_NAMES[m - 1],
      paymentDate: '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[m - 1]} 2025)`,
    };
  }),
  // Member 16 — 2023 Full Year (Months 1–12) & 2025 (Months 8–12)
  ...Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const codes = [
      '2960037',
      '3744985',
      '4310466',
      '4993822',
      '5565026',
      '6115992',
      '6668810',
      '7268193',
      '7797866',
      '8607262',
      '9149925',
      '9712286',
    ];
    return {
      transactionCode: `TXN-2023${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2023-${codes[idx]}`,
      memberId: '16',
      memberName: 'Md. Haydar Ali',
      year: 2023,
      month: m,
      monthName: MONTH_NAMES[idx],
      paymentDate: '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[idx]} 2023)`,
    };
  }),
  ...Array.from({ length: 5 }, (_, idx) => {
    const m = idx + 8;
    const codes = ['1280837', '1836084', '2322994', '2867579', '3377613'];
    return {
      transactionCode: `TXN-2025${String(m).padStart(2, '0')}-${codes[idx]}`,
      receiptNo: `RCP-2025-${codes[idx]}`,
      memberId: '16',
      memberName: 'Md. Haydar Ali',
      year: 2025,
      month: m,
      monthName: MONTH_NAMES[m - 1],
      paymentDate: '2026-11-02',
      txShareDeposit: 2000,
      txPayable: 0,
      txOtherReceive: 50,
      txTotalAmount: 2050,
      obShareDeposit: 2000,
      obPayable: 0,
      obOtherReceive: 50,
      obTotalReceiveAmount: 2050,
      receivedBy: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      remarks: `Monthly deposit (${MONTH_NAMES[m - 1]} 2025)`,
    };
  }),
];

export const PERMANENT_MONTHLY_OBLIGATION_UPDATES: Array<{
  memberId: string;
  year: number;
  month: number;
  paymentDate: string;
  shareDeposit: number;
  payable: number;
  otherReceive: number;
  totalReceiveAmount: number;
  monthlyDue: number;
  status: string;
}> = [
  { memberId: '12', year: 2023, month: 1, paymentDate: '24-8-23', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '12', year: 2023, month: 2, paymentDate: '24-8-23', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '12', year: 2023, month: 3, paymentDate: '2023-03-10', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '12', year: 2026, month: 3, paymentDate: '2026-07-07', shareDeposit: 1000, payable: 0, otherReceive: 300, totalReceiveAmount: 1300, monthlyDue: 750, status: 'PARTIAL' },
  { memberId: '15', year: 2025, month: 3, paymentDate: '16-7-2025', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '15', year: 2025, month: 4, paymentDate: '16-7-2025', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '15', year: 2025, month: 5, paymentDate: '2025-04-08', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '15', year: 2025, month: 6, paymentDate: '17/10/25', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '15', year: 2025, month: 7, paymentDate: '21/01/26', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '16', year: 2025, month: 3, paymentDate: '16-7-2025', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '16', year: 2025, month: 4, paymentDate: '16-7-2025', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '16', year: 2025, month: 5, paymentDate: '2025-04-08', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '16', year: 2025, month: 6, paymentDate: '17/10/25', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
  { memberId: '16', year: 2025, month: 7, paymentDate: '21/01/26', shareDeposit: 2000, payable: 0, otherReceive: 50, totalReceiveAmount: 2050, monthlyDue: 0, status: 'PAID' },
];

export async function ensureHistoricalExpensesSeeded(force = false) {
  const existingFlagRows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, 'HISTORICAL_EXPENSES_2019_2024_SEEDED'));
  const alreadyFlagged = existingFlagRows[0]?.settingValue === 'TRUE';

  if (alreadyFlagged && !force) {
    return;
  }

  const existingExpenses = await db.select().from(expenseTransactions);
  if (existingExpenses.length > 0 && !force) {
    await db
      .insert(systemSettings)
      .values({
        settingKey: 'HISTORICAL_EXPENSES_2019_2024_SEEDED',
        settingValue: 'TRUE',
        description: 'Official 2019–2026 Expense Ledger seeded',
        updatedBy: 'Super Admin',
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: { settingValue: 'TRUE', updatedAt: new Date() },
      });
    return;
  }

  const existingMap = new Map(existingExpenses.map((e) => [e.voucherNo, e]));

  let anyInserted = false;
  for (const exp of HISTORICAL_YEARLY_EXPENSES) {
    if (!existingMap.has(exp.voucherNo)) {
      const txDate = exp.transactionDate || `${exp.year}-12-31`;
      const txMonth = exp.month || 12;
      await db
        .insert(expenseTransactions)
        .values({
          voucherNo: exp.voucherNo,
          category: exp.category,
          title: exp.title,
          amount: exp.amount,
          transactionDate: txDate,
          year: exp.year,
          month: txMonth,
          paymentMethod: 'CASH',
          approvalStatus: 'APPROVED',
          recordedBy: 'হিলফুল ফুজুল সমবায় সমিতি (খরচের হিসাব)',
          approvedBy: 'Super Admin',
          remarks: exp.remarks,
        })
        .onConflictDoNothing();

      const [je] = await db
        .insert(journalEntries)
        .values({
          entryNumber: `JE-${exp.voucherNo}`,
          entryDate: txDate,
          referenceType: 'EXPENSE',
          referenceId: exp.voucherNo,
          description: `${exp.title} (${exp.voucherNo})`,
          totalDebit: exp.amount,
          totalCredit: exp.amount,
          status: 'POSTED',
          createdBy: 'হিলফুল ফুজুল সমবায় সমিতি',
          approvedBy: 'Super Admin',
        })
        .onConflictDoNothing()
        .returning();

      if (je) {
        await db.insert(journalEntryLines).values([
          {
            journalEntryId: je.id,
            entryNumber: je.entryNumber,
            accountCode: '5040',
            accountName: 'Administrative & Maintenance Costs',
            memberId: 'ALL',
            debit: exp.amount,
            credit: 0,
            narration: exp.title,
            entryDate: txDate,
          },
          {
            journalEntryId: je.id,
            entryNumber: je.entryNumber,
            accountCode: '1010',
            accountName: 'Society Cash & Collection Fund',
            memberId: 'ALL',
            debit: 0,
            credit: exp.amount,
            narration: `Cash payment for ${exp.voucherNo} (${exp.year})`,
            entryDate: txDate,
          },
        ]);
      }
      anyInserted = true;
    }
  }

  await db
    .insert(systemSettings)
    .values({
      settingKey: 'HISTORICAL_EXPENSES_2019_2024_SEEDED',
      settingValue: 'TRUE',
      description: 'Official 2019–2026 Expense Ledger seeded',
      updatedBy: 'Super Admin',
    })
    .onConflictDoUpdate({
      target: systemSettings.settingKey,
      set: { settingValue: 'TRUE', updatedAt: new Date() },
    });

  if (anyInserted || force) {
    await reconcileSocietyAccountBalances();
  }
}

export async function ensurePermanentUserPaymentsSeeded() {
  const settingsRows = await db.select().from(systemSettings);
  const settingsMap = new Map(settingsRows.map((s) => [s.settingKey, s.settingValue]));

  if (
    settingsMap.get('PERMANENT_USER_PAYMENTS_SEEDED_V2') === 'TRUE' &&
    settingsMap.get('PERMANENT_OBLIGATION_UPDATES_SEEDED_V3') === 'TRUE'
  ) {
    return;
  }

  const existingTxs = await db.select().from(paymentTransactions);
  const txMap = new Map(existingTxs.map((t) => [t.receiptNo, t]));
  const impactedMemberYears = new Set<string>();

  if (settingsMap.get('PERMANENT_USER_PAYMENTS_SEEDED_V2') !== 'TRUE') {
    for (const p of PERMANENT_USER_PAYMENTS) {
      if (!txMap.has(p.receiptNo)) {
        const [insertedTx] = await db
          .insert(paymentTransactions)
          .values({
            transactionCode: p.transactionCode,
            receiptNo: p.receiptNo,
            memberId: p.memberId,
            memberName: p.memberName,
            year: p.year,
            month: p.month,
            monthName: p.monthName,
            paymentDate: p.paymentDate,
            shareDeposit: p.txShareDeposit,
            payable: p.txPayable,
            fine: 0,
            otherReceive: p.txOtherReceive,
            downPayment: 0,
            totalAmount: p.txTotalAmount,
            paymentMethod: 'CASH',
            approvalStatus: 'APPROVED',
            receivedBy: p.receivedBy,
            approvedBy: 'Super Admin',
            remarks: p.remarks,
          })
          .onConflictDoNothing()
          .returning();

        if (insertedTx) {
          await db
            .insert(receipts)
            .values({
              receiptNo: p.receiptNo,
              transactionId: insertedTx.id,
              memberId: p.memberId,
              memberName: p.memberName,
              paymentDate: p.paymentDate,
              month: p.month,
              monthName: p.monthName,
              year: p.year,
              shareDeposit: p.txShareDeposit,
              payable: p.txPayable,
              fine: 0,
              otherReceive: p.txOtherReceive,
              downPayment: 0,
              totalAmount: p.txTotalAmount,
              paymentMethod: 'CASH',
              receivedBy: p.receivedBy,
            })
            .onConflictDoNothing();
        }

        const obRows = await db
          .select()
          .from(monthlyObligations)
          .where(
            and(
              eq(monthlyObligations.memberId, p.memberId),
              eq(monthlyObligations.year, p.year),
              eq(monthlyObligations.month, p.month)
            )
          );
        if (obRows.length > 0 && obRows[0].totalReceiveAmount === 0) {
          await db
            .update(monthlyObligations)
            .set({
              paymentDate: p.paymentDate,
              expectedShareDeposit: p.obShareDeposit,
              expectedPayable: p.obPayable + p.obOtherReceive,
              shareDeposit: p.obShareDeposit,
              payable: p.obPayable,
              otherReceive: p.obOtherReceive,
              totalReceiveAmount: p.obTotalReceiveAmount,
              monthlyDue: 0,
              advanceCredit: 0,
              receiptNo: p.receiptNo,
              status: 'PAID',
              updatedAt: new Date(),
            })
            .where(eq(monthlyObligations.id, obRows[0].id));
        }

        impactedMemberYears.add(`${p.memberId}:${p.year}`);
      }
    }

    await db
      .insert(systemSettings)
      .values({
        settingKey: 'PERMANENT_USER_PAYMENTS_SEEDED_V2',
        settingValue: 'TRUE',
        description: 'Permanent user payments baseline seeded once without overwriting edits',
        updatedBy: 'Super Admin',
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: { settingValue: 'TRUE', updatedAt: new Date() },
      });
  }

  if (settingsMap.get('PERMANENT_OBLIGATION_UPDATES_SEEDED_V3') !== 'TRUE') {
    for (const mod of PERMANENT_MONTHLY_OBLIGATION_UPDATES) {
      const obRows = await db
        .select()
        .from(monthlyObligations)
        .where(
          and(
            eq(monthlyObligations.memberId, mod.memberId),
            eq(monthlyObligations.year, mod.year),
            eq(monthlyObligations.month, mod.month)
          )
        );
      if (obRows.length > 0 && obRows[0].totalReceiveAmount === 0) {
        await db
          .update(monthlyObligations)
          .set({
            paymentDate: mod.paymentDate,
            expectedShareDeposit: 2000,
            expectedPayable: 50,
            shareDeposit: mod.shareDeposit,
            payable: mod.payable,
            otherReceive: mod.otherReceive,
            totalReceiveAmount: mod.totalReceiveAmount,
            monthlyDue: mod.monthlyDue,
            advanceCredit: 0,
            status: mod.status,
            updatedAt: new Date(),
          })
          .where(eq(monthlyObligations.id, obRows[0].id));
        impactedMemberYears.add(`${mod.memberId}:${mod.year}`);
      }
    }

    await db
      .insert(systemSettings)
      .values({
        settingKey: 'PERMANENT_OBLIGATION_UPDATES_SEEDED_V3',
        settingValue: 'TRUE',
        description: 'Permanent obligation baseline seeded without overwriting manual user edits',
        updatedBy: 'Super Admin',
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: { settingValue: 'TRUE', updatedAt: new Date() },
      });
  }

  for (const item of impactedMemberYears) {
    const [mId, yrStr] = item.split(':');
    for (let y = Number(yrStr); y <= 2026; y++) {
      await recalculateMemberYearAccount(mId, y);
    }
  }
  if (impactedMemberYears.size > 0) {
    await reconcileSocietyAccountBalances();
  }
}

export async function ensurePermanentBrandingSeeded() {
  const settingsRows = await db.select().from(systemSettings);
  const map = new Map(settingsRows.map((s) => [s.settingKey, s.settingValue]));

  if (map.get('PERMANENT_BRANDING_SEEDED_V2') === 'TRUE') {
    return;
  }

  const currentLogo = map.get('society_logo_url') || '';
  if (!currentLogo) {
    await db
      .insert(systemSettings)
      .values({
        settingKey: 'society_logo_url',
        settingValue: OFFICIAL_SOCIETY_LOGO_URL,
        description: 'Official Hilful Fuzul Cooperative Society Emblem Logo',
        updatedBy: 'Super Admin',
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: { settingValue: OFFICIAL_SOCIETY_LOGO_URL, updatedAt: new Date() },
      });
  }

  const defaultPermanentSettings: Array<{ key: string; value: string; desc: string }> = [
    {
      key: 'society_name_bn',
      value: 'হিলফুল ফুজুল সমবায় সমিতি',
      desc: 'Society Name in Bengali',
    },
    {
      key: 'society_name_en',
      value: 'Hilful Fuzul Somobay Shomiti',
      desc: 'Society Name in English',
    },
    {
      key: 'society_address_bn',
      value: 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা - ১২১৬, বাংলাদেশ',
      desc: 'Permanent Address in Bengali',
    },
    {
      key: 'society_phone',
      value: '+880 11914845224',
      desc: 'Official Contact Phone',
    },
  ];

  for (const item of defaultPermanentSettings) {
    if (!map.has(item.key)) {
      await db
        .insert(systemSettings)
        .values({
          settingKey: item.key,
          settingValue: item.value,
          description: item.desc,
          updatedBy: 'Super Admin',
        })
        .onConflictDoUpdate({
          target: systemSettings.settingKey,
          set: { settingValue: item.value, updatedAt: new Date() },
        });
    }
  }

  await db
    .insert(systemSettings)
    .values({
      settingKey: 'PERMANENT_BRANDING_SEEDED_V2',
      settingValue: 'TRUE',
      description: 'Permanent society branding seeded once without overwriting user customizations',
      updatedBy: 'Super Admin',
    })
    .onConflictDoUpdate({
      target: systemSettings.settingKey,
      set: { settingValue: 'TRUE', updatedAt: new Date() },
    });
}

function resolveAssetFile(fileName: string): string {
  const candidates = [
    path.resolve(process.cwd(), 'public/assets/aistudio', fileName),
    path.resolve(process.cwd(), 'dist/assets/aistudio', fileName),
    path.resolve(__dirname, '../../public/assets/aistudio', fileName),
    path.resolve(__dirname, '../../dist/assets/aistudio', fileName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const RECORDS_JSON_PATH = resolveAssetFile('monthly_records_for_ai_studio_3094d76a.json');
const MEMBER_INDEX_PATH = resolveAssetFile('member_index_for_ai_studio_184b67e2.json');
const VALIDATION_REPORT_PATH = resolveAssetFile('import_validation_report_d06f1c69.json');

export interface RawMonthlyRecord {
  source_file: string;
  source_sheet: string;
  accounting_year: number;
  source_member_row: number;
  source_data_row: number;
  member_id: string;
  member_name: string;
  phone: string | null;
  month: string;
  date_raw: string | null;
  share_deposit: number | null;
  payable: number | null;
  fine: number | null;
  other_receive: number | null;
  down_payment: number | null;
  total_receive_calculated: number | null;
  total_receive_excel_formula: string | null;
  total_receive_excel_cached: number | null;
  due_expected_monthly_amount_from_formula: number | null;
  due_excel_formula: string | null;
  due_excel_cached: number | null;
  import_status: string;
}

export const CANONICAL_12_MEMBERS = [
  {
    row: 2,
    memberId: '02',
    id2024: '01',
    name: 'Hafez Mohammad Kamruzzaman',
    nameBn: 'হাফেজ মোহাম্মদ কামরুজ্জামান',
    phone: '01921435355',
    email: 'kamruzzaman02@hilfulfuzul.org',
    remarks: 'Excel Row 2 | Primary ID: 02 (2024 Sheet ID: 01)',
  },
  {
    row: 18,
    memberId: '04',
    id2024: '02',
    name: 'Md. Minar Hossain',
    nameBn: 'মোঃ মিনার হোসেন',
    phone: '01717736488',
    email: 'minar04@hilfulfuzul.org',
    remarks:
      'Excel Row 18 | Primary ID: 04 (2024 Sheet ID: 02) | Name variants: MD.minar hossin, MD. Minar Hossain, MD. Minar hossan',
  },
  {
    row: 34,
    memberId: '05',
    id2024: '03',
    name: 'Mst. Sadiya Akter',
    nameBn: 'মোসাঃ সাদিয়া আক্তার',
    phone: '01949940539',
    email: 'sadiya05@hilfulfuzul.org',
    remarks: 'Excel Row 34 | Primary ID: 05 (2024 Sheet ID: 03) | 2019 Phone: 01403056913',
  },
  {
    row: 50,
    memberId: '06',
    id2024: '04',
    name: 'MD. Billal Hossain',
    nameBn: 'মোঃ বিল্লাল হোসেন',
    phone: '01766594977',
    email: 'billal06@hilfulfuzul.org',
    remarks: 'Excel Row 50 | Primary ID: 06 (2024 Sheet ID: 04)',
  },
  {
    row: 66,
    memberId: '07',
    id2024: '05',
    name: 'Mst. Sabila Yasmin',
    nameBn: 'মোসাঃ সাবিলা ইয়াসমিন',
    phone: '01712789473',
    email: 'sabila07@hilfulfuzul.org',
    remarks: 'Excel Row 66 | Primary ID: 07 (2024 Sheet ID: 05)',
  },
  {
    row: 82,
    memberId: '09',
    id2024: '06',
    name: 'Md. Monir Hossain Mamun',
    nameBn: 'মোঃ মনির হোসেন মামুন',
    phone: '01914845224',
    email: 'mamun770m@gmail.com',
    remarks: 'Excel Row 82 | Primary ID: 09 (2024 Sheet ID: 06)',
  },
  {
    row: 98,
    memberId: '10',
    id2024: '07',
    name: 'Md. Masudur Rahman',
    nameBn: 'মোঃ মাসুদুর রহমান',
    phone: '01712872161',
    email: 'masudur10@hilfulfuzul.org',
    remarks: 'Excel Row 98 | Primary ID: 10 (2024 Sheet ID: 07)',
  },
  {
    row: 114,
    memberId: '11',
    id2024: '08',
    name: 'Abu kausar Bhuyan',
    nameBn: 'আবু কাউসার ভূঁইয়া',
    phone: '01911437799',
    email: 'kausar11@hilfulfuzul.org',
    remarks: 'Excel Row 114 | Primary ID: 11 (2024 Sheet ID: 08)',
  },
  {
    row: 130,
    memberId: '12',
    id2024: '09',
    name: 'Riyad Arefin',
    nameBn: 'রিয়াদ আরেফিন',
    phone: '01911606333',
    email: 'riyad12@hilfulfuzul.org',
    remarks: 'Excel Row 130 | Primary ID: 12 (2024 Sheet ID: 09)',
  },
  {
    row: 146,
    memberId: '14',
    id2024: '10',
    name: 'Md. Mohidul Islam',
    nameBn: 'মোঃ মহিদুল ইসলাম',
    phone: '01938841984',
    email: 'mohidul14@hilfulfuzul.org',
    remarks: 'Excel Row 146 | Primary ID: 14 (2024 Sheet ID: 10)',
  },
  {
    row: 162,
    memberId: '15',
    id2024: '11',
    name: 'Mst. Jobeda Begum',
    nameBn: 'মোসাঃ জোবেদা বেগম',
    phone: '01783672777',
    email: 'jobeda15@hilfulfuzul.org',
    remarks: 'Excel Row 162 | Primary ID: 15 (2024 Sheet ID: 11)',
  },
  {
    row: 178,
    memberId: '16',
    id2024: '12',
    name: 'Md. Haydar Ali',
    nameBn: 'মোঃ হায়দার আলী',
    phone: '01959446202',
    email: 'haydar16@hilfulfuzul.org',
    remarks: 'Excel Row 178 | Primary ID: 16 (2024 Sheet ID: 12)',
  },
];

export function loadUploadedPackage() {
  const records: RawMonthlyRecord[] = JSON.parse(fs.readFileSync(RECORDS_JSON_PATH, 'utf8'));
  const memberIndex: any[] = JSON.parse(fs.readFileSync(MEMBER_INDEX_PATH, 'utf8'));
  const validationReport: any = JSON.parse(fs.readFileSync(VALIDATION_REPORT_PATH, 'utf8'));
  return { records, memberIndex, validationReport };
}

/**
 * Performs all 11 mandatory forensic data validation checks on the 1,152 extracted rows
 * and 27 member index entries without modifying or overwriting any original values.
 */
export function analyzeHistoricalPackage() {
  const { records, memberIndex, validationReport } = loadUploadedPackage();

  const byId = new Map<string, Set<string>>();
  const byNameNormalized = new Map<string, Set<string>>();
  for (const m of memberIndex) {
    if (!byId.has(m.member_id)) byId.set(m.member_id, new Set());
    byId.get(m.member_id)!.add(`${m.member_name} (Years: ${m.years.join(',')})`);

    const normName = m.member_name.toLowerCase().replace(/[^a-z]/g, '');
    if (!byNameNormalized.has(normName)) byNameNormalized.set(normName, new Set());
    byNameNormalized.get(normName)!.add(`ID ${m.member_id} in [${m.years.join(',')}] (${m.member_name})`);
  }

  const sameIdDifferentNames = Array.from(byId.entries())
    .filter(([, names]) => names.size > 1)
    .map(([memberId, names]) => ({
      memberId,
      identities: Array.from(names),
    }));

  const sameNameDifferentIds = Array.from(byNameNormalized.entries())
    .filter(([, ids]) => ids.size > 1)
    .map(([, ids]) => ({
      occurrences: Array.from(ids),
    }));

  const enrichedMemberIndex = memberIndex.map((m, idx) => {
    const mRows = records.filter(
      (r) => r.member_id === m.member_id && r.member_name === m.member_name
    );

    const yearBreakdown: Record<number, number> = {};
    let totalShareDeposit = 0;
    let totalPayable = 0;
    let totalFine = 0;
    let totalOtherReceive = 0;
    let totalDownPayment = 0;
    let totalReceive = 0;
    let excelCachedDue = 0;
    let properOutstandingDue = 0;
    let advanceOverpayment = 0;

    for (const r of mRows) {
      const share = Number(r.share_deposit || 0);
      const pay = Number(r.payable || 0);
      const fine = Number(r.fine || 0);
      const other = Number(r.other_receive || 0);
      const down = Number(r.down_payment || 0);
      const rowTotal = Math.max(
        share + pay + fine + other + down,
        Number(r.total_receive_excel_cached || 0)
      );

      totalShareDeposit += share;
      totalPayable += pay;
      totalFine += fine;
      totalOtherReceive += other;
      totalDownPayment += down;
      totalReceive += rowTotal;
      excelCachedDue += Number(r.due_excel_cached || 0);

      yearBreakdown[r.accounting_year] = (yearBreakdown[r.accounting_year] || 0) + rowTotal;

      const expected =
        r.due_expected_monthly_amount_from_formula ||
        (r.accounting_year === 2019 ? 1020 : r.accounting_year === 2020 ? 1520 : 2050);

      const arrearsInDownCol =
        r.accounting_year <= 2020 || (r.accounting_year === 2022 && down === 50) ? down : 0;
      const isCapitalDown =
        (r.accounting_year === 2022 && down >= 70000) ||
        (r.accounting_year === 2024 && down >= 12000);
      const eligibleReceived = Math.max(
        share + pay + other + arrearsInDownCol,
        rowTotal - fine - (isCapitalDown ? down : 0)
      );
      const diff = expected - eligibleReceived;
      if (r.accounting_year >= 2025) {
        if (diff > 0) properOutstandingDue += diff;
        else if (diff < 0) advanceOverpayment += Math.abs(diff);
      }
    }

    const sourceRow = m.source_member_labels?.[0]?.member_row || 0;
    const includesUpTo2024 = m.years.some((y: number) => y <= 2024);
    const includes2025Or2026 = m.years.some((y: number) => y >= 2025);
    const due2019To2024 = includesUpTo2024
      ? sourceRow === 82
        ? 23810
        : sourceRow === 146
        ? 1150
        : 0
      : 0;
    const due2025To2026 = includes2025Or2026
      ? Math.max(0, properOutstandingDue - advanceOverpayment)
      : 0;
    const reconciledProperDue = due2019To2024 + due2025To2026;

    return {
      indexNo: idx + 1,
      memberId: m.member_id,
      memberName: m.member_name,
      phone: m.phone || 'MISSING_PHONE',
      sourceMemberRow: sourceRow,
      years: m.years,
      yearBreakdown,
      recordCount: mRows.length,
      totalShareDeposit,
      totalPayable,
      totalFine,
      totalOtherReceive,
      totalDownPayment,
      totalReceive,
      excelCachedDue,
      properOutstandingDue: reconciledProperDue,
      advanceOverpayment: includes2025Or2026 ? advanceOverpayment : 0,
    };
  });

  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const yearSummaries = years.map((yr) => {
    const yrRows = records.filter((r) => r.accounting_year === yr);
    const expectedPerMonth = yr === 2019 ? 1020 : yr === 2020 ? 1520 : 2050;
    const shareDeposit = yrRows.reduce((a, r) => a + Number(r.share_deposit || 0), 0);
    const payable = yrRows.reduce((a, r) => a + Number(r.payable || 0), 0);
    const fine = yrRows.reduce((a, r) => a + Number(r.fine || 0), 0);
    const otherReceive = yrRows.reduce((a, r) => a + Number(r.other_receive || 0), 0);
    const downPayment = yrRows.reduce((a, r) => a + Number(r.down_payment || 0), 0);
    const totalReceive = yrRows.reduce((a, r) => a + Number(r.total_receive_excel_cached || 0), 0);
    const excelCachedDue = yrRows.reduce((a, r) => a + Number(r.due_excel_cached || 0), 0);

    const totalExpectedObligation = 144 * expectedPerMonth;
    const projectDownPayment = yr === 2022 ? 840000 : yr === 2024 ? 144000 : 0;
    const eligibleMonthlyCollection = totalReceive - projectDownPayment - fine;
    const rawYearDue = Math.max(0, totalExpectedObligation - eligibleMonthlyCollection);
    const netYearDue = yr < 2024 ? 0 : yr === 2024 ? 23810 + 1150 : rawYearDue;
    const netYearAdvance =
      yr <= 2024 ? 0 : Math.max(0, eligibleMonthlyCollection - totalExpectedObligation);

    return {
      year: yr,
      totalRows: yrRows.length,
      expectedMonthlyRate: expectedPerMonth,
      totalExpectedObligation,
      shareDeposit,
      payable,
      fine,
      otherReceive,
      downPayment,
      projectDownPayment,
      totalReceive,
      excelCachedDue,
      properNetDue: netYearDue,
      properAdvanceCredit: netYearAdvance,
      missingDatesCount: yrRows.filter((r) => !r.date_raw).length,
      missingFormulaCount: yrRows.filter((r) => !r.total_receive_excel_formula).length,
      missingDueFormulaCount: yrRows.filter((r) => !r.due_excel_formula).length,
    };
  });

  const missingComponentRows = records.filter((r) => r.total_receive_calculated === null);
  const paidWithoutDateRows = records.filter(
    (r) => !r.date_raw && Number(r.total_receive_excel_cached || 0) > 0
  );
  const negativeDueRows = records.filter((r) => Number(r.due_excel_cached || 0) < 0);
  const missingTotalFormulaRows = records.filter((r) => !r.total_receive_excel_formula);
  const missingDueFormulaRows = records.filter((r) => !r.due_excel_formula);

  return {
    sourceFile: validationReport.source_file,
    totalSheets: validationReport.sheets.length,
    totalRecords: records.length,
    uniqueMemberIdNamePairs: validationReport.unique_member_id_name_pairs,
    warningsCount: validationReport.warnings_count,
    sheetsMetadata: validationReport.sheets,
    importantNotes: validationReport.important_notes,
    sameIdDifferentNames,
    sameNameDifferentIds,
    enrichedMemberIndex,
    yearSummaries,
    validationAnomalies: {
      missingComponentRows,
      paidWithoutDateRows,
      negativeDueRowsCount: negativeDueRows.length,
      missingTotalFormulaCount: missingTotalFormulaRows.length,
      missingDueFormulaCount: missingDueFormulaRows.length,
      warningsSample: validationReport.warnings_sample,
    },
    rawRecords: records,
  };
}

let activeSyncPromise: Promise<{ status: string; totalRecords: number }> | null = null;
let hasVerifiedAuthenticSeed = false;

/**
 * Purges any previous demo names/amounts and populates the entire PostgreSQL database
 * exclusively with the user's authentic dataset from "Shomiti Hishab English (1).xlsx"
 * (12 real members, 1,152 monthly obligation records, 857 paid transactions & receipts,
 * 12 down payment agreements, exact Chart of Accounts balances, and 8 annual journal entries).
 * Uses a strict in-memory mutex lock so parallel API requests never race each other.
 */
export async function syncAuthenticDatasetToPostgres(forceResync = false) {
  if (!forceResync && hasVerifiedAuthenticSeed) {
    return { status: 'ALREADY_SYNCHRONIZED', totalRecords: 1152 };
  }

  if (activeSyncPromise) {
    return await activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      const { records, validationReport } = loadUploadedPackage();

      const existingMembersBeforeSync = await db.select().from(members);
      const existingMemberMap = new Map(
        existingMembersBeforeSync.map((m) => [m.memberId, m])
      );

      // STRICT ZERO-DATA-LOSS PROTECTION:
      // Once the 12 canonical members exist in the database, NEVER wipe or delete any tables!
      // Even if forceResync is true or new members (e.g. HF-...) were added, preserve all existing records
      // and only ensure permanent baseline expenses, payments, and branding are present.
      const hasAuthenticMembers =
        existingMembersBeforeSync.length >= 12 &&
        existingMembersBeforeSync.some((m) => m.memberId === '02') &&
        existingMembersBeforeSync.some((m) => m.memberId === '09');
      const existingObCount = (await db.select().from(monthlyObligations)).length;
      const existingRolesCount = (await db.select().from(roles)).length;
      const existingAccCount = (await db.select().from(accounts)).length;

      if (
        hasAuthenticMembers &&
        existingObCount >= 96 &&
        existingRolesCount >= 4 &&
        existingAccCount >= 10
      ) {
        await ensurePermanentBrandingSeeded();
        await ensureHistoricalExpensesSeeded(false);
        await ensurePermanentUserPaymentsSeeded();
        hasVerifiedAuthenticSeed = true;
        return {
          status: forceResync ? 'APPROVED_AND_IMPORTED' : 'ALREADY_SYNCHRONIZED',
          totalRecords: records.length,
        };
      }

      console.log(
        'Initializing baseline Hilful Fuzul dataset (1,152 records, 12 real members) into PostgreSQL...'
      );

      // 1. Wipe old financial records safely while preserving user settings, notices, comments & member profile customizations
      await db.delete(paymentAllocations);
      await db.delete(receipts);
      await db.delete(paymentTransactions);
      await db.delete(monthlyObligations);
      await db.delete(annualAccountSummaries);
      await db.delete(memberAccounts);
      await db.delete(memberPaymentPolicies);
      await db.delete(downPaymentAgreements);
      await db.delete(loanRepayments);
      await db.delete(loans);
      await db.delete(investments);
      await db.delete(incomeTransactions);
      await db.delete(expenseTransactions);
      await db.delete(journalEntryLines);
      await db.delete(journalEntries);
      await db.delete(accounts);
      await db.delete(importRows);
      await db.delete(importBatches);
      await db.delete(approvalRequests);
      await db.delete(permissions);
      await db.delete(members);

      // 2. Roles & Permissions
      await db
        .insert(roles)
        .values([
          {
            name: 'SUPER_ADMIN',
            description:
              'পূর্ণ নিয়ন্ত্রণ: সকল সদস্য, হিসাব, অনুমোদন, এক্সেল ইমপোর্ট ও সিস্টেম সেটিংস',
          },
          {
            name: 'ADMIN',
            description:
              'প্রশাসনিক নিয়ন্ত্রণ: সদস্য নিবন্ধন, প্রোফাইল আপডেট, রিপোর্ট ও নোটিশ ব্যবস্থাপনা',
          },
          {
            name: 'ACCOUNTANT',
            description:
              'হিসাবরক্ষক: মাসিক জমা, শেয়ার, জরিমানা, ডাউন পেমেন্ট, আয়-ব্যয় ও রশিদ প্রদান',
          },
          {
            name: 'MEMBER',
            description:
              'সদস্য পোর্টাল: শুধুমাত্র নিজস্ব প্রোফাইল, বাৎসরিক হিসাব, বকেয়া ও রশিদ দর্শন',
          },
        ])
        .onConflictDoNothing();

      const resources = [
        'MEMBERS',
        'YEARLY_ACCOUNTING',
        'MONTHLY_COLLECTION',
        'DOWN_PAYMENTS',
        'INCOME_EXPENSE',
        'LOANS_INVESTMENTS',
        'DOUBLE_ENTRY_LEDGER',
        'EXCEL_MIGRATION',
        'REPORTS',
        'AUDIT_SECURITY',
      ];

      const permRows: Array<typeof permissions.$inferInsert> = [];
      for (const res of resources) {
        permRows.push({
          roleName: 'SUPER_ADMIN',
          resource: res,
          canView: true,
          canCreate: true,
          canEdit: true,
          canApprove: true,
          canExport: true,
        });
        permRows.push({
          roleName: 'ADMIN',
          resource: res,
          canView: true,
          canCreate: res === 'MEMBERS',
          canEdit: res === 'MEMBERS',
          canApprove: false,
          canExport: true,
        });
        permRows.push({
          roleName: 'ACCOUNTANT',
          resource: res,
          canView: res !== 'AUDIT_SECURITY',
          canCreate: ['MONTHLY_COLLECTION', 'DOWN_PAYMENTS', 'INCOME_EXPENSE'].includes(res),
          canEdit: ['MONTHLY_COLLECTION', 'INCOME_EXPENSE'].includes(res),
          canApprove: false,
          canExport: true,
        });
        permRows.push({
          roleName: 'MEMBER',
          resource: res,
          canView: ['YEARLY_ACCOUNTING', 'MONTHLY_COLLECTION', 'DOWN_PAYMENTS', 'REPORTS'].includes(
            res
          ),
          canCreate: false,
          canEdit: false,
          canApprove: false,
          canExport: true,
        });
      }
      await db.insert(permissions).values(permRows);

      // 3. Calculate exact totals from the 1,152 records for Chart of Accounts & Journal Entries
      const totalShareExplicit = records.reduce(
        (a, r) => a + Math.round(Number(r.share_deposit || 0)),
        0
      );
      const totalPayableExplicit = records.reduce(
        (a, r) => a + Math.round(Number(r.payable || 0)),
        0
      );
      const totalFineExplicit = records.reduce((a, r) => a + Math.round(Number(r.fine || 0)), 0);
      const totalOtherExplicit = records.reduce(
        (a, r) => a + Math.round(Number(r.other_receive || 0)),
        0
      );
      const totalDownExplicit = records.reduce(
        (a, r) => a + Math.round(Number(r.down_payment || 0)),
        0
      );
      const totalCachedCollection = records.reduce(
        (a, r) => a + Math.round(Number(r.total_receive_excel_cached || 0)),
        0
      );
      const cachedBlankRowDiff =
        totalCachedCollection -
        (totalShareExplicit +
          totalPayableExplicit +
          totalFineExplicit +
          totalOtherExplicit +
          totalDownExplicit);

      // Insert Chart of Accounts with exact real balances from Shomiti Hishab English (1).xlsx
      await db
        .insert(accounts)
        .values([
    {
      accountCode: '1010',
      accountName: 'Society Cash & Collection Fund',
      accountNameBn: 'সমিতির নগদ ও আদায় তহবিল (Shomiti Hishab 2019–2026)',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      currentBalance: totalCachedCollection, // ৳2,587,400
      isSystemAccount: true,
    },
    {
      accountCode: '1020',
      accountName: 'Bank Current Account',
      accountNameBn: 'ব্যাংক চলতি হিসাব',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '1030',
      accountName: 'Member Loan Principal Receivable',
      accountNameBn: 'সদস্য ঋণ আসল প্রাপ্য হিসাব',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '1040',
      accountName: 'Cooperative Project Investments',
      accountNameBn: 'সমিতির প্রকল্প ও মেয়াদী বিনিয়োগ',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '2010',
      accountName: 'Member Share Deposit Liability',
      accountNameBn: 'সদস্য শেয়ার আমানত তহবিল (দায়)',
      accountType: 'LIABILITY',
      normalBalance: 'CREDIT',
      currentBalance: totalShareExplicit, // ৳1,520,000
      isSystemAccount: true,
    },
    {
      accountCode: '2020',
      accountName: 'Member Down Payment Liability',
      accountNameBn: 'সদস্য ডাউন পেমেন্ট আমানত (দায়)',
      accountType: 'LIABILITY',
      normalBalance: 'CREDIT',
      currentBalance: totalDownExplicit, // ৳1,026,270
      isSystemAccount: true,
    },
    {
      accountCode: '2030',
      accountName: 'Cached Excel Collection Adjustment (7 Blank-Component Rows)',
      accountNameBn: 'এক্সেল ক্যাশড ফর্মুলা সমন্বয় তহবিল (৭টি ঘর)',
      accountType: 'LIABILITY',
      normalBalance: 'CREDIT',
      currentBalance: cachedBlankRowDiff, // ৳8,170
      isSystemAccount: true,
    },
    {
      accountCode: '3010',
      accountName: 'Society General Reserve Equity',
      accountNameBn: 'সমিতির সংরক্ষিত মূলধন তহবিল',
      accountType: 'EQUITY',
      normalBalance: 'CREDIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '4010',
      accountName: 'Monthly Payable Contribution Income',
      accountNameBn: 'মাসিক প্রদেয় চাঁদা আয়',
      accountType: 'INCOME',
      normalBalance: 'CREDIT',
      currentBalance: totalPayableExplicit, // ৳0
      isSystemAccount: true,
    },
    {
      accountCode: '4020',
      accountName: 'Late Fine Collection Income',
      accountNameBn: 'বিলম্ব জরিমানা আদায় আয় (২০১৯ জুন)',
      accountType: 'INCOME',
      normalBalance: 'CREDIT',
      currentBalance: totalFineExplicit, // ৳100
      isSystemAccount: true,
    },
    {
      accountCode: '4030',
      accountName: 'Other Member Receipts (Monthly ৳20/৳50 Fees)',
      accountNameBn: 'অন্যান্য সদস্য প্রাপ্তি (মাসিক ৳২০/৳৫০ ফি)',
      accountType: 'INCOME',
      normalBalance: 'CREDIT',
      currentBalance: totalOtherExplicit, // ৳32,860
      isSystemAccount: true,
    },
    {
      accountCode: '4040',
      accountName: 'Membership & Admission Fees',
      accountNameBn: 'সদস্য ও ভর্তি ফি আয়',
      accountType: 'INCOME',
      normalBalance: 'CREDIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '4050',
      accountName: 'Loan Service Profit Income',
      accountNameBn: 'ঋণ মুনাফা ও সার্ভিস চার্জ আয়',
      accountType: 'INCOME',
      normalBalance: 'CREDIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '4060',
      accountName: 'Investment Profit Income',
      accountNameBn: 'বিনিয়োগ মুনাফা আয়',
      accountType: 'INCOME',
      normalBalance: 'CREDIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '5010',
      accountName: 'Office Rent Expense',
      accountNameBn: 'অফিস ভাড়া ব্যয়',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '5020',
      accountName: 'Salary & Honorarium Expense',
      accountNameBn: 'কর্মচারী বেতন ও সম্মানী ব্যয়',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '5030',
      accountName: 'Electricity & Utilities Expense',
      accountNameBn: 'বিদ্যুৎ, ইন্টারনেট ও ইউটিলিটি বিল',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
    {
      accountCode: '5040',
      accountName: 'Administrative & Maintenance Costs',
      accountNameBn: 'প্রশাসনিক, যাতায়াত ও রক্ষণাবেক্ষণ ব্যয়',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      currentBalance: 0,
      isSystemAccount: true,
    },
  ]).onConflictDoNothing();

  // 4. Insert the 12 Canonical Members, Payment Policies, Down Payment Agreements,
  //    1,152 Monthly Obligations, 96 Annual Summaries, and all 857 Paid Transactions & Receipts
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const accountHeaderBatch: Array<typeof memberAccounts.$inferInsert> = [];
  const obligationBatch: Array<typeof monthlyObligations.$inferInsert> = [];
  const summaryBatch: Array<typeof annualAccountSummaries.$inferInsert> = [];
  const txBatch: Array<typeof paymentTransactions.$inferInsert> = [];
  const receiptBatch: Array<typeof receipts.$inferInsert> = [];

  let txSeq = 1;

  for (const slot of CANONICAL_12_MEMBERS) {
    const slotRows = records.filter((r) => r.source_member_row === slot.row);

    const totalDownAllYears = slotRows.reduce(
      (a, r) => a + Math.round(Number(r.down_payment || 0)),
      0
    );
    const capitalDown22And24 = slotRows
      .filter((r) => r.accounting_year === 2022 || r.accounting_year === 2024)
      .reduce((a, r) => a + Math.round(Number(r.down_payment || 0)), 0);

    const lastDownRow = [...slotRows]
      .reverse()
      .find((r) => Number(r.down_payment || 0) > 0);

    const prevMem = existingMemberMap.get(slot.memberId);
    await db.insert(members).values({
      memberId: slot.memberId,
      name: prevMem?.name || slot.name,
      nameBn: prevMem?.nameBn || slot.nameBn,
      fatherName: prevMem?.fatherName || 'সমিতি সদস্য (Shomiti Hishab)',
      motherName: prevMem?.motherName || '',
      mobile: prevMem?.mobile || slot.phone,
      email: prevMem?.email || slot.email,
      address: prevMem?.address || 'হিলফুল ফুজুল সমবায় সমিতি, ঢাকা',
      nidNumber: prevMem?.nidNumber || '',
      bloodGroup: prevMem?.bloodGroup || 'A+',
      occupation: prevMem?.occupation || 'ব্যবসায়ী',
      joiningDate: prevMem?.joiningDate || '2019-01-01',
      status: prevMem?.status || 'ACTIVE',
      monthlyShareDeposit: prevMem?.monthlyShareDeposit ?? 2000,
      monthlyPayableAmount: prevMem?.monthlyPayableAmount ?? 50,
      monthlyFinePolicy: prevMem?.monthlyFinePolicy ?? 50,
      otherPaymentSettings: `Other Receive: ৳20 (2019–20), ৳50 (2021–26) | 2024 Sheet ID: ${slot.id2024}`,
      downPaymentTarget: prevMem?.downPaymentTarget ?? totalDownAllYears,
      advanceCreditBalance: 0,
      photoUrl: prevMem?.photoUrl || '',
      loginPin: prevMem?.loginPin || '1234',
      nomineeName: prevMem?.nomineeName || '',
      nomineeRelation: prevMem?.nomineeRelation || '',
      nomineeMobile: prevMem?.nomineeMobile || '',
      nomineeNid: prevMem?.nomineeNid || '',
      nomineeSharePercent: prevMem?.nomineeSharePercent ?? 100,
      nomineePhotoUrl: prevMem?.nomineePhotoUrl || '',
      remarks: prevMem?.remarks || slot.remarks,
    }).onConflictDoNothing();

    await db.insert(memberPaymentPolicies).values({
      memberId: slot.memberId,
      effectiveYear: 2019,
      effectiveMonth: 1,
      expectedShareDeposit: 2000,
      expectedPayable: 50,
      fineRate: 50,
      notes: '2019: ৳1,000+৳20 | 2020: ৳1,500+৳20 | 2021–2026: ৳2,000+৳50',
    });

    await db.insert(downPaymentAgreements).values({
      memberId: slot.memberId,
      memberName: slot.name,
      agreedAmount: totalDownAllYears,
      totalPaid: totalDownAllYears,
      remainingAmount: 0,
      effectiveDate: '2019-01-01',
      lastPaymentDate: lastDownRow?.date_raw ? String(lastDownRow.date_raw).slice(0, 10) : '2024-01-05',
      lastReceiptNo: `RCP-2024-M${slot.memberId}-DP`,
      status: 'COMPLETED',
      remarks: `2022 Capital: ৳70,000 + 2024 Capital: ৳12,000 (Total Capital: ৳${capitalDown22And24.toLocaleString()}, Total Down Column: ৳${totalDownAllYears.toLocaleString()})`,
    });

    let memberCarriedDue = 0;

    for (const yr of years) {
      const yrRows = slotRows.filter((r) => r.accounting_year === yr);
      const isHistorical = yr <= 2024;

      let openingOutstandingForYear = 0;
      if (yr <= 2024) {
        openingOutstandingForYear = 0;
      } else if (yr === 2025) {
        if (slot.memberId === '09') {
          openingOutstandingForYear = 23810;
        } else if (slot.memberId === '14') {
          openingOutstandingForYear = 1150;
        } else {
          openingOutstandingForYear = 0;
        }
      } else {
        openingOutstandingForYear = memberCarriedDue;
      }

      accountHeaderBatch.push({
        memberId: slot.memberId,
        year: yr,
        openingOutstanding: openingOutstandingForYear,
        openingCredit: 0,
        status: yr < 2026 ? 'CLOSED' : 'OPEN',
      });

      let yrShare = 0;
      let yrPayable = 0;
      let yrFine = 0;
      let yrOther = 0;
      let yrDown = 0;
      let yrTotal = 0;
      let runningYearDue = openingOutstandingForYear;
      let runningYearAdv = 0;

      for (let i = 0; i < yrRows.length; i++) {
        const r = yrRows[i];
        const mNum = MONTH_NAMES.findIndex((m) => m.toLowerCase() === r.month.toLowerCase()) + 1;
        const isLastMonth = i === yrRows.length - 1;

        const share = Math.round(Number(r.share_deposit || 0));
        const pay = Math.round(Number(r.payable || 0));
        const fine = Math.round(Number(r.fine || 0));
        const other = Math.round(Number(r.other_receive || 0));
        const down = Math.round(Number(r.down_payment || 0));
        const cachedTotal = Math.round(Number(r.total_receive_excel_cached || 0));
        const total = Math.max(share + pay + fine + other + down, cachedTotal);

        const isCapitalDown = (yr === 2022 && down >= 70000) || (yr === 2024 && down >= 12000);
        const eligibleFromComponents = share + pay + other + (isCapitalDown ? 0 : down);
        const eligibleForMonthly = Math.max(
          eligibleFromComponents,
          total - fine - (isCapitalDown ? down : 0)
        );

        let expectedShare = yr === 2019 ? 1000 : yr === 2020 ? 1500 : 2000;
        let expectedPayable = yr <= 2020 ? 20 : 50;

        let mDue = 0;
        let mAdv = 0;

        if (isHistorical) {
          // Base historical rule: set expectedShare + expectedPayable = eligibleForMonthly so normal months have 0 due and 0 advance
          if (eligibleForMonthly === 0) {
            expectedShare = 0;
            expectedPayable = 0;
          } else {
            expectedShare = Math.min(eligibleForMonthly, expectedShare);
            expectedPayable = Math.max(0, eligibleForMonthly - expectedShare);
          }

          if (slot.memberId === '09' && yr === 2024 && isLastMonth) {
            mDue = 23810;
            runningYearDue = 23810;
            expectedPayable += 23810;
          } else if (slot.memberId === '14' && yr === 2024 && isLastMonth) {
            mDue = 1150;
            runningYearDue = 1150;
            expectedPayable += 1150;
          } else {
            mDue = 0;
            runningYearDue = 0;
          }
        } else {
          // 2025+
          const expectedRate = expectedShare + expectedPayable;
          mDue = Math.max(0, expectedRate - eligibleForMonthly);
          mAdv = Math.max(0, eligibleForMonthly - expectedRate);

          const netChange = expectedRate - eligibleForMonthly;
          if (runningYearDue + netChange - runningYearAdv >= 0) {
            runningYearDue = runningYearDue + netChange - runningYearAdv;
            runningYearAdv = 0;
          } else {
            runningYearAdv = Math.abs(runningYearDue + netChange - runningYearAdv);
            runningYearDue = 0;
          }
        }

        const rcpNo = total > 0 ? `RCP-${yr}-M${slot.memberId}-R${r.source_data_row}` : '';
        const cleanDate = r.date_raw ? String(r.date_raw).slice(0, 10) : '';

        obligationBatch.push({
          memberId: slot.memberId,
          year: yr,
          month: mNum,
          monthName: r.month,
          paymentDate: r.date_raw || '',
          expectedShareDeposit: expectedShare,
          expectedPayable: expectedPayable,
          shareDeposit: share,
          payable: pay,
          fine,
          otherReceive: other,
          downPayment: down,
          totalReceiveAmount: total,
          monthlyDue: mDue,
          advanceCredit: mAdv,
          cumulativeDue: runningYearDue,
          receiptNo: rcpNo,
          status:
            mDue > 0
              ? total > 0
                ? 'PARTIAL'
                : 'DUE'
              : total > 0
              ? 'PAID'
              : isHistorical
              ? 'PAID'
              : 'DUE',
          sourceWorksheet: r.source_sheet,
          sourceRow: r.source_data_row,
        });

        yrShare += share;
        yrPayable += pay;
        yrFine += fine;
        yrOther += other;
        yrDown += down;
        yrTotal += total;

        if (total > 0) {
          const currentSeq = txSeq++;
          txBatch.push({
            transactionCode: `TXN-${yr}${String(mNum).padStart(2, '0')}-M${slot.memberId}-R${r.source_data_row}`,
            receiptNo: rcpNo,
            memberId: slot.memberId,
            memberName: slot.name,
            year: yr,
            month: mNum,
            monthName: r.month,
            paymentDate: cleanDate || `${yr}-${String(mNum).padStart(2, '0')}-01`,
            shareDeposit: share,
            payable: pay,
            fine,
            otherReceive: other,
            downPayment: down,
            totalAmount: total,
            paymentMethod: 'CASH',
            approvalStatus: 'APPROVED',
            receivedBy: 'হিলফুল ফুজুল সমবায় সমিতি (Excel Ledger)',
            approvedBy: 'Super Admin',
            remarks: `Sheet ${r.source_sheet}, Row ${r.source_data_row}${r.date_raw ? ` | Date: ${r.date_raw}` : ' | Date: Undated in Excel'}`,
          });

          receiptBatch.push({
            receiptNo: rcpNo,
            transactionId: currentSeq,
            memberId: slot.memberId,
            memberName: slot.name,
            paymentDate: cleanDate || `${yr}-${String(mNum).padStart(2, '0')}-01`,
            month: mNum,
            monthName: r.month,
            year: yr,
            shareDeposit: share,
            payable: pay,
            fine,
            otherReceive: other,
            downPayment: down,
            totalAmount: total,
            paymentMethod: 'CASH',
            receivedBy: 'হিলফুল ফুজুল সমবায় সমিতি',
          });
        }
      }

      const yearClosingDue = isHistorical
        ? slot.memberId === '09'
          ? yr === 2024
            ? 23810
            : 0
          : slot.memberId === '14'
          ? yr === 2024
            ? 1150
            : 0
          : 0
        : runningYearDue;

      memberCarriedDue = yearClosingDue;

      summaryBatch.push({
        memberId: slot.memberId,
        year: yr,
        totalShareDeposit: yrShare,
        totalPayable: yrPayable,
        totalFine: yrFine,
        totalOtherReceive: yrOther,
        totalDownPayment: yrDown,
        totalReceiveAmount: yrTotal,
        previousYearOutstanding: openingOutstandingForYear,
        currentYearObligation: yr <= 2020 ? 12 * (yr === 2019 ? 1020 : 1520) : 12 * 2050,
        totalOutstanding: yearClosingDue,
        advanceCredit: isHistorical ? 0 : runningYearAdv,
      });
    }
  }

  await db.insert(memberAccounts).values(accountHeaderBatch);
  for (let i = 0; i < obligationBatch.length; i += 250) {
    await db.insert(monthlyObligations).values(obligationBatch.slice(i, i + 250));
  }
  await db.insert(annualAccountSummaries).values(summaryBatch);
  for (let i = 0; i < txBatch.length; i += 250) {
    await db.insert(paymentTransactions).values(txBatch.slice(i, i + 250)).onConflictDoNothing();
  }
  for (let i = 0; i < receiptBatch.length; i += 250) {
    await db.insert(receipts).values(receiptBatch.slice(i, i + 250)).onConflictDoNothing();
  }

  // 5. Post 8 Annual Double-Entry Journal Entries & Real Income Vouchers (2019–2026)
  for (const yr of years) {
    const yrRows = records.filter((r) => r.accounting_year === yr);
    const yrShare = yrRows.reduce((a, r) => a + Math.round(Number(r.share_deposit || 0)), 0);
    const yrFine = yrRows.reduce((a, r) => a + Math.round(Number(r.fine || 0)), 0);
    const yrOther = yrRows.reduce((a, r) => a + Math.round(Number(r.other_receive || 0)), 0);
    const yrDown = yrRows.reduce((a, r) => a + Math.round(Number(r.down_payment || 0)), 0);
    const yrTotalCached = yrRows.reduce(
      (a, r) => a + Math.round(Number(r.total_receive_excel_cached || 0)),
      0
    );
    const yrCachedAdj = yrTotalCached - (yrShare + yrFine + yrOther + yrDown);

    const [je] = await db
      .insert(journalEntries)
      .values({
        entryNumber: `JE-${yr}-SHOMITI`,
        entryDate: `${yr}-12-31`,
        referenceType: 'ANNUAL_EXCEL_LEDGER',
        referenceId: `SHOMITI-${yr}`,
        description: `Shomiti Hishab English (1).xlsx — ${yr} Annual Member Collections (12 Members)`,
        totalDebit: yrTotalCached,
        totalCredit: yrTotalCached,
        status: 'POSTED',
        createdBy: 'হিলফুল ফুজুল সমবায় সমিতি',
        approvedBy: 'Super Admin',
      })
      .returning();

    const linesToInsert: Array<typeof journalEntryLines.$inferInsert> = [
      {
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        accountCode: '1010',
        accountName: 'Society Cash & Collection Fund',
        memberId: 'ALL',
        debit: yrTotalCached,
        credit: 0,
        narration: `Total cash received in ${yr} sheet of Shomiti Hishab English (1).xlsx`,
        entryDate: `${yr}-12-31`,
      },
    ];

    if (yrShare > 0) {
      linesToInsert.push({
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        accountCode: '2010',
        accountName: 'Member Share Deposit Liability',
        memberId: 'ALL',
        debit: 0,
        credit: yrShare,
        narration: `${yr} Member Share Deposits (Liability)`,
        entryDate: `${yr}-12-31`,
      });
    }
    if (yrDown > 0) {
      linesToInsert.push({
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        accountCode: '2020',
        accountName: 'Member Down Payment Liability',
        memberId: 'ALL',
        debit: 0,
        credit: yrDown,
        narration: `${yr} Down Payment column collections`,
        entryDate: `${yr}-12-31`,
      });
    }
    if (yrCachedAdj > 0) {
      linesToInsert.push({
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        accountCode: '2030',
        accountName: 'Cached Excel Collection Adjustment',
        memberId: 'ALL',
        debit: 0,
        credit: yrCachedAdj,
        narration: `${yr} Cached Excel totals on rows with blank component cells`,
        entryDate: `${yr}-12-31`,
      });
    }
    if (yrOther > 0) {
      linesToInsert.push({
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        accountCode: '4030',
        accountName: 'Other Member Receipts (Monthly ৳20/৳50 Fees)',
        memberId: 'ALL',
        debit: 0,
        credit: yrOther,
        narration: `${yr} Other Receive column collections`,
        entryDate: `${yr}-12-31`,
      });

      await db.insert(incomeTransactions).values({
        voucherNo: `INC-${yr}-OTHER`,
        category: 'Other Income',
        title: `${yr} বাৎসরিক অন্যান্য প্রাপ্তি (Other Receive Column — Shomiti Hishab Sheet ${yr})`,
        amount: yrOther,
        transactionDate: `${yr}-12-31`,
        year: yr,
        month: 12,
        paymentMethod: 'CASH',
        approvalStatus: 'APPROVED',
        recordedBy: 'Shomiti Hishab Excel',
        approvedBy: 'Super Admin',
        remarks: `Exact sum of Other Receive column in ${yr} worksheet`,
      }).onConflictDoNothing();
    }
    if (yrFine > 0) {
      linesToInsert.push({
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        accountCode: '4020',
        accountName: 'Late Fine Collection Income',
        memberId: 'ALL',
        debit: 0,
        credit: yrFine,
        narration: `${yr} Fine column collections (ID 11 & ID 12 in June 2019)`,
        entryDate: `${yr}-12-31`,
      });

      await db.insert(incomeTransactions).values({
        voucherNo: `INC-${yr}-FINE`,
        category: 'Other Income',
        title: `${yr} জরিমানা আদায় (Fine Column — ID 11 Abu kausar Bhuyan ৳50 & ID 12 Riyad Arefin ৳50)`,
        amount: yrFine,
        transactionDate: `${yr}-06-30`,
        year: yr,
        month: 6,
        paymentMethod: 'CASH',
        approvalStatus: 'APPROVED',
        recordedBy: 'Shomiti Hishab Excel',
        approvedBy: 'Super Admin',
        remarks: `Exact sum of Fine column in ${yr} worksheet`,
      }).onConflictDoNothing();
    }

    await db.insert(journalEntryLines).values(linesToInsert);
  }

  // 5B. Seed the Official 2019–2026 Yearly & Permanent Expenses, User Payments & Official Branding
  await ensurePermanentBrandingSeeded();
  await ensureHistoricalExpensesSeeded(true);
  await ensurePermanentUserPaymentsSeeded();

  // 6. Insert Historical Import Batch & All 1,152 Staged/Imported Rows
  const [stagedBatch] = await db
    .insert(importBatches)
    .values({
      batchCode: 'PKG-SHOMITI-2019-2026',
      fileName: 'Shomiti Hishab English (1).xlsx [monthly_records_for_ai_studio.csv]',
      totalWorksheets: 8,
      detectedMembers: 27,
      totalMonthlyRecords: 1152,
      validRecords: 1152 - validationReport.warnings_count - 7,
      warningRecords: validationReport.warnings_count + 7,
      errorRecords: 0,
      duplicateRecords: 0,
      approvedRecords: 1152,
      importedRecords: 1152,
      status: 'IMPORTED',
      uploadedBy: 'Hilful Fuzul Data Intelligence Package',
      approvedBy: 'Super Admin (Approved & Active in PostgreSQL)',
    })
    .returning();

  const warningSet = new Map<string, string>();
  for (const w of validationReport.warnings_sample) {
    warningSet.set(`${w.sheet}:${w.row}`, `${w.type} (raw date: "${w.date_raw}")`);
  }

  const allImportRows = records.map((r) => {
    const mIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === r.month.toLowerCase()) + 1;
    const warnMsg = warningSet.get(`${r.source_sheet}:${r.source_data_row}`);
    const isNullCalc = r.total_receive_calculated === null;
    const isNegDue = Number(r.due_excel_cached || 0) < 0;

    const messages: string[] = [];
    if (warnMsg) messages.push(warnMsg);
    if (isNullCalc) messages.push('Missing numeric component cell in Excel; cached total used');
    if (isNegDue) {
      messages.push(
        `Excel formula ${r.due_excel_formula} produced negative due (${r.due_excel_cached}) by subtracting Down Payment/Fine`
      );
    }
    if (!messages.length) {
      messages.push(`IMPORTED | Formula: ${r.total_receive_excel_formula || 'None'}`);
    }

    return {
      batchId: stagedBatch.id,
      worksheetName: r.source_sheet,
      rowNumber: r.source_data_row,
      year: r.accounting_year,
      memberId: r.member_id,
      memberName: r.member_name,
      month: mIdx || 1,
      monthName: r.month,
      rawDate: r.date_raw || '',
      parsedDate: r.date_raw ? String(r.date_raw).slice(0, 10) : '',
      shareDeposit: Math.round(Number(r.share_deposit || 0)),
      payable: Math.round(Number(r.payable || 0)),
      fine: Math.round(Number(r.fine || 0)),
      otherReceive: Math.round(Number(r.other_receive || 0)),
      downPayment: Math.round(Number(r.down_payment || 0)),
      totalReceiveAmount: Math.round(Number(r.total_receive_excel_cached || 0)),
      due: Math.round(Number(r.due_excel_cached || 0)),
      validationStatus: warnMsg || isNullCalc || isNegDue ? 'WARNING' : 'VALID',
      validationMessages: messages.join(' · '),
      isApproved: true,
    };
  });

  for (let i = 0; i < allImportRows.length; i += 250) {
    await db.insert(importRows).values(allImportRows.slice(i, i + 250));
  }

  // 7. System Settings, Notifications, Approval Requests & Audit Log
  await db.insert(systemSettings).values([
    {
      settingKey: 'SOCIETY_NAME_BN',
      settingValue: 'হিলফুল ফুজুল সমবায় সমিতি',
      description: 'Official Cooperative Name in Bengali',
    },
    {
      settingKey: 'SOCIETY_NAME_EN',
      settingValue: 'Hilful Fuzul Cooperative Society',
      description: 'Official Cooperative Name in English',
    },
    {
      settingKey: 'DEFAULT_MONTHLY_SHARE_DEPOSIT',
      settingValue: '2000',
      description: 'Monthly share deposit obligation in BDT (2021–2026)',
    },
    {
      settingKey: 'DEFAULT_MONTHLY_OTHER_RECEIVE',
      settingValue: '50',
      description: 'Monthly Other Receive fee in BDT (৳20 in 2019–2020; ৳50 in 2021–2026)',
    },
    {
      settingKey: 'TIMEZONE',
      settingValue: 'Asia/Dhaka',
      description: 'System operational timezone',
    },
    {
      settingKey: 'CURRENCY',
      settingValue: 'BDT (৳)',
      description: 'Bangladeshi Taka',
    },
  ]).onConflictDoNothing();

  await db.insert(notifications).values([
    {
      title: 'হিলফুল ফুজুল সমবায় সমিতি — ২০১৯–২০২৬ অরিজিনাল এক্সেল ডাটাবেজ সংযুক্ত',
      message:
        'Shomiti Hishab English (1).xlsx ফাইলের ১২ জন প্রকৃত সদস্য এবং ১,১৫২টি মাসিক হিসাব (মোট আদায় ৳২৫,৮৭,৪০০) সফলভাবে সফটওয়্যারে ইনপুট করা হয়েছে।',
      targetRole: 'ALL',
      targetMemberId: '',
      type: 'ANNOUNCEMENT',
      isRead: false,
      createdBy: 'মোঃ মনির হোসেন মামুন (ID 09)',
    },
  ]);

  await db.insert(approvalRequests).values([
    {
      requestCode: 'APR-SHOMITI-2019-2026',
      requestType: 'EXCEL_IMPORT',
      referenceId: 'PKG-SHOMITI-2019-2026',
      summary:
        'Complete Migration of Shomiti Hishab English (1).xlsx (2019–2026, 8 Sheets, 12 Members, 1,152 Monthly Records)',
      amount: totalCachedCollection,
      requestedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (ID 02)',
      status: 'APPROVED',
      reviewedBy: 'মোঃ মনির হোসেন মামুন (ID 09 — Super Admin)',
      reviewReason: 'All demo data purged and replaced with 100% authentic society records',
    },
  ]).onConflictDoNothing();

  await db.insert(auditLogs).values([
    {
      actorUid: 'super_admin',
      actorName: 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
      actorRole: 'SUPER_ADMIN',
      action: 'PURGE_DEMO_AND_IMPORT_AUTHENTIC_DATASET',
      entityType: 'import_batches',
      entityId: 'PKG-SHOMITI-2019-2026',
      previousValue: 'Demo Seed Data',
      updatedValue: `12 Canonical Members (02..16), 1,152 Monthly Obligations, 857 Receipts, Total Collection ৳${totalCachedCollection.toLocaleString()}`,
      reason: 'User requested removal of all demo names/amounts and full activation of provided Shomiti Hishab data',
    },
  ]);

      hasVerifiedAuthenticSeed = true;
      return { status: 'APPROVED_AND_IMPORTED', totalRecords: records.length };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return await activeSyncPromise;
}

export function getDefaultAppUsersList(): Array<any> {
  const nowIso = new Date().toISOString();
  const list: Array<any> = [
    {
      id: 1,
      username: 'superadmin',
      password: '7709',
      fullName: 'Md. Monir Hossain Mamun',
      fullNameBn: 'মোঃ মনির হোসেন মামুন',
      role: 'SUPER_ADMIN',
      memberId: '09',
      phone: '01914845224',
      email: 'mamun770m@gmail.com',
      isActive: true,
      notes: 'সুপার এডমিন প্রধান একাউন্ট (সকল ইউজার নেম ও পাসওয়ার্ড নিয়ন্ত্রণকারী)',
      createdBy: 'System Initializer',
      lastLoginAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 2,
      username: 'mamun',
      password: '7709',
      fullName: 'Md. Monir Hossain Mamun',
      fullNameBn: 'মোঃ মনির হোসেন মামুন',
      role: 'SUPER_ADMIN',
      memberId: '09',
      phone: '01914845224',
      email: 'mamun770m@gmail.com',
      isActive: true,
      notes: 'সুপার এডমিন বিকল্প ইউজারনেম',
      createdBy: 'System Initializer',
      lastLoginAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 3,
      username: 'admin',
      password: '2026',
      fullName: 'Hafez Mohammad Kamruzzaman',
      fullNameBn: 'হাফেজ মোহাম্মদ কামরুজ্জামান',
      role: 'ADMIN',
      memberId: '02',
      phone: '01921435355',
      email: 'kamruzzaman02@hilfulfuzul.org',
      isActive: true,
      notes: 'এডমিন একাউন্ট (প্রশাসনিক ও সদস্য ব্যবস্থাপনা)',
      createdBy: 'Super Admin',
      lastLoginAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 4,
      username: 'kamruzzaman',
      password: '2026',
      fullName: 'Hafez Mohammad Kamruzzaman',
      fullNameBn: 'হাফেজ মোহাম্মদ কামরুজ্জামান',
      role: 'ADMIN',
      memberId: '02',
      phone: '01921435355',
      email: 'kamruzzaman02@hilfulfuzul.org',
      isActive: true,
      notes: 'এডমিন বিকল্প ইউজারনেম',
      createdBy: 'Super Admin',
      lastLoginAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    ...CANONICAL_12_MEMBERS.map((m, idx) => ({
      id: 5 + idx,
      username: `member${m.memberId}`,
      password: m.memberId === '09' ? '7709' : m.memberId === '02' ? '2026' : '1234',
      fullName: m.name,
      fullNameBn: m.nameBn,
      role: m.memberId === '09' ? 'SUPER_ADMIN' : m.memberId === '02' ? 'ADMIN' : 'MEMBER',
      memberId: m.memberId,
      phone: m.phone || '',
      email: m.email || '',
      isActive: true,
      notes: `সদস্য পোর্টাল একাউন্ট #${m.memberId}`,
      createdBy: 'Super Admin',
      lastLoginAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    })),
  ];
  return list;
}

export async function getAppUsersSafe(): Promise<Array<any>> {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, 'society_app_users_json'));
    if (rows.length > 0 && rows[0].settingValue) {
      const parsed = JSON.parse(rows[0].settingValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore json parse error
  }

  try {
    const dbUsers = await db.select().from(appUsers);
    if (dbUsers.length > 0) {
      await saveAppUsersSafe(dbUsers);
      return dbUsers;
    }
  } catch {
    // app_users table might not exist in production DB before DDL push
  }

  const defaults = getDefaultAppUsersList();
  await saveAppUsersSafe(defaults);
  return defaults;
}

export async function saveAppUsersSafe(usersList: Array<any>): Promise<void> {
  try {
    const jsonStr = JSON.stringify(usersList);
    await db
      .insert(systemSettings)
      .values({
        settingKey: 'society_app_users_json',
        settingValue: jsonStr,
        description: 'Super Admin Managed Username & Password Accounts',
        updatedBy: 'Super Admin',
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: { settingValue: jsonStr, updatedAt: new Date() },
      });
  } catch (err) {
    console.error('saveAppUsersSafe settings error:', err);
  }
}

export async function ensureAppUsersSeeded() {
  try {
    await getAppUsersSafe();
  } catch (err) {
    console.error('ensureAppUsersSeeded error:', err);
  }
}

