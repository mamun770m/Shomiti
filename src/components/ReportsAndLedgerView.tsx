import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  Scale,
  FileText,
  Layers,
} from 'lucide-react';
import { formatBDT } from '../lib/utils.ts';
import { exportReportData } from '../lib/exportUtils.ts';

interface ReportsAndLedgerViewProps {
  authHeaders: Record<string, string>;
  members: any[];
  downPayments: any;
  incomeExpense: any;
  loansInvestments: any;
}

const ALL_17_REPORTS = [
  { id: '1', name: '01. Member-wise Financial Report (সদস্যভিত্তিক প্রতিবেদন)' },
  { id: '2', name: '02. Monthly Collection Report (মাসিক আদায় প্রতিবেদন)' },
  { id: '3', name: '03. Annual Collection Report (বাৎসরিক আদায় প্রতিবেদন)' },
  { id: '4', name: '04. Share Deposit Report (শেয়ার জমা প্রতিবেদন)' },
  { id: '5', name: '05. Payable Report (মাসিক প্রদেয় প্রতিবেদন)' },
  { id: '6', name: '06. Fine Collection Report (জরিমানা আদায় প্রতিবেদন)' },
  { id: '7', name: '07. Other Receipt Report (অন্যান্য প্রাপ্তি প্রতিবেদন)' },
  { id: '8', name: '08. Down Payment Report (ডাউন পেমেন্ট প্রতিবেদন)' },
  { id: '9', name: '09. Outstanding Dues Report (বকেয়া বিবরণী প্রতিবেদন)' },
  { id: '10', name: '10. Society Income Report (সমিতির আয় প্রতিবেদন)' },
  { id: '11', name: '11. Society Expense Report (সমিতির ব্যয় প্রতিবেদন)' },
  { id: '12', name: '12. Member Loan Portfolio Report (ঋণ প্রতিবেদন)' },
  { id: '13', name: '13. Investment Portfolio Report (বিনিয়োগ প্রতিবেদন)' },
  { id: '14', name: '14. Cash & Bank Book (ক্যাশ ও ব্যাংক বুক)' },
  { id: '15', name: '15. Double-Entry General Ledger (জেনারেল লেজার)' },
  { id: '16', name: '16. Trial Balance (রেওয়ামিল / ট্রায়াল ব্যালেন্স)' },
  { id: '17', name: '17. Balance Sheet (উদ্বৃত্তপত্র / ব্যালেন্স শিট)' },
];

export const ReportsAndLedgerView: React.FC<ReportsAndLedgerViewProps> = ({
  authHeaders,
  members,
  downPayments,
  incomeExpense,
  loansInvestments,
}) => {
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [selectedReportId, setSelectedReportId] = useState<string>('1');
  const [activeSubTab, setActiveSubTab] = useState<
    'REPORTS_17' | 'CHART_OF_ACCOUNTS' | 'GENERAL_LEDGER' | 'TRIAL_BALANCE' | 'BALANCE_SHEET'
  >('REPORTS_17');

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch(`/api/ledger?_t=${Date.now()}`, {
        headers: authHeaders,
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) setLedgerData(data);
    } catch (err) {
      console.error('Error fetching ledger:', err);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    const handleSync = () => {
      fetchLedger();
    };
    window.addEventListener('hf_financial_sync_trigger', handleSync);
    window.addEventListener('hf_background_sync', handleSync);
    return () => {
      window.removeEventListener('hf_financial_sync_trigger', handleSync);
      window.removeEventListener('hf_background_sync', handleSync);
    };
  }, [fetchLedger]);

  // Build dynamic table headers & rows for any of the 17 mandatory reports
  const getReportTable = (reportId: string): { title: string; headers: string[]; rows: (string | number)[][] } => {
    const reportObj = ALL_17_REPORTS.find((r) => r.id === reportId) || ALL_17_REPORTS[0];
    switch (reportId) {
      case '1':
      case '3':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Share Deposit', 'Payable', 'Fine', 'Other Receive', 'Down Payment', 'Total Received', 'Current Due'],
          rows: members.map((m) => [
            m.memberId,
            `${m.nameBn} (${m.name})`,
            m.lifetimeShareDeposit || 0,
            m.lifetimePayable || 0,
            m.lifetimeFine || 0,
            m.lifetimeOtherReceive || 0,
            m.lifetimeDownPayment || 0,
            m.lifetimeTotalReceived || 0,
            m.currentOutstanding || 0,
          ]),
        };
      case '2':
      case '4':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Monthly Share Policy', 'Cumulative Share Deposit (2019-2026)', 'Advance Credit', 'Status'],
          rows: members.map((m) => [
            m.memberId,
            m.name,
            m.monthlyShareDeposit,
            m.lifetimeShareDeposit || 0,
            m.advanceCreditBalance || 0,
            m.status,
          ]),
        };
      case '5':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Monthly Payable Policy', 'Total Payable Contributed', 'Status'],
          rows: members.map((m) => [
            m.memberId,
            m.name,
            m.monthlyPayableAmount,
            m.lifetimePayable || 0,
            m.status,
          ]),
        };
      case '6':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Fine Policy Rate', 'Total Fine Collected'],
          rows: members.map((m) => [
            m.memberId,
            m.name,
            m.monthlyFinePolicy,
            m.lifetimeFine || 0,
          ]),
        };
      case '7':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Payment Policy', 'Total Other Receipts'],
          rows: members.map((m) => [
            m.memberId,
            m.name,
            m.otherPaymentSettings || 'Standard',
            m.lifetimeOtherReceive || 0,
          ]),
        };
      case '8':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Agreed Down Payment', 'Total Paid', 'Remaining Balance', 'Last Payment Date', 'Status'],
          rows: (downPayments?.agreements || []).map((d: any) => [
            d.memberId,
            d.memberName,
            d.agreedAmount,
            d.totalPaid,
            d.remainingAmount,
            d.lastPaymentDate || '-',
            d.status,
          ]),
        };
      case '9':
        return {
          title: reportObj.name,
          headers: ['Member ID', 'Member Name', 'Mobile', 'Current Outstanding Due', 'Down Payment Remaining', 'Total Obligation Gap'],
          rows: members.map((m) => [
            m.memberId,
            m.name,
            m.mobile,
            m.currentOutstanding || 0,
            m.downPaymentRemaining || 0,
            (m.currentOutstanding || 0) + (m.downPaymentRemaining || 0),
          ]),
        };
      case '10':
        return {
          title: reportObj.name,
          headers: ['Voucher No', 'Date', 'Income Category', 'Description', 'Method', 'Approved By', 'Amount (BDT)'],
          rows: (incomeExpense?.incomes || []).map((inc: any) => [
            inc.voucherNo,
            inc.transactionDate,
            inc.category,
            inc.title,
            inc.paymentMethod,
            inc.approvedBy,
            inc.amount,
          ]),
        };
      case '11':
        return {
          title: reportObj.name,
          headers: ['Voucher No', 'Date', 'Expense Category', 'Description', 'Method', 'Approved By', 'Amount (BDT)'],
          rows: (incomeExpense?.expenses || []).map((exp: any) => [
            exp.voucherNo,
            exp.transactionDate,
            exp.category,
            exp.title,
            exp.paymentMethod,
            exp.approvedBy,
            exp.amount,
          ]),
        };
      case '12':
        return {
          title: reportObj.name,
          headers: ['Loan Code', 'Member ID', 'Member Name', 'Principal', 'Service Rate %', 'Principal Repaid', 'Profit Repaid', 'Outstanding Balance', 'Status'],
          rows: (loansInvestments?.loans || []).map((ln: any) => [
            ln.loanCode,
            ln.memberId,
            ln.memberName,
            ln.principalAmount,
            `${ln.interestRate}%`,
            ln.principalRepaid,
            ln.interestRepaid,
            ln.outstandingBalance,
            ln.status,
          ]),
        };
      case '13':
        return {
          title: reportObj.name,
          headers: ['Code', 'Investment Name', 'Principal Amount', 'Date', 'Maturity', 'Expected Return', 'Actual Return', 'Status'],
          rows: (loansInvestments?.investments || []).map((inv: any) => [
            inv.investmentCode,
            inv.investmentName,
            inv.principalAmount,
            inv.investmentDate,
            inv.maturityDate,
            inv.expectedReturn,
            inv.actualReturn,
            inv.status,
          ]),
        };
      case '14':
        return {
          title: reportObj.name,
          headers: ['Account Code', 'Account Name', 'Bangla Name', 'Normal Balance', 'Available Balance (BDT)'],
          rows: (ledgerData?.chartOfAccounts || [])
            .filter((a: any) => a.accountCode === '1010' || a.accountCode === '1020')
            .map((a: any) => [
              a.accountCode,
              a.accountName,
              a.accountNameBn,
              a.normalBalance,
              a.currentBalance,
            ]),
        };
      case '15':
        return {
          title: reportObj.name,
          headers: ['Entry Number', 'Date', 'Account Code', 'Account Name', 'Member', 'Debit (BDT)', 'Credit (BDT)', 'Narration'],
          rows: (ledgerData?.journalEntryLines || []).map((l: any) => [
            l.entryNumber,
            l.entryDate,
            l.accountCode,
            l.accountName,
            l.memberId || 'ALL',
            l.debit,
            l.credit,
            l.narration,
          ]),
        };
      case '16':
        return {
          title: reportObj.name,
          headers: ['Account Code', 'Account Title', 'Type', 'Debit Balance (BDT)', 'Credit Balance (BDT)'],
          rows: (ledgerData?.trialBalance || []).map((tb: any) => [
            tb.accountCode,
            `${tb.accountName} (${tb.accountNameBn})`,
            tb.accountType,
            tb.debit,
            tb.credit,
          ]),
        };
      case '17':
      default:
        return {
          title: reportObj.name,
          headers: ['Classification', 'Account Code', 'Account Title', 'Balance (BDT)'],
          rows: [
            ...(ledgerData?.balanceSheet?.assets || []).map((a: any) => [
              'ASSET (সম্পদ)',
              a.accountCode,
              a.accountName,
              a.currentBalance,
            ]),
            ...(ledgerData?.balanceSheet?.liabilities || []).map((a: any) => [
              'LIABILITY (সদস্য আমানত দায়)',
              a.accountCode,
              a.accountName,
              a.currentBalance,
            ]),
            ...(ledgerData?.balanceSheet?.equity || []).map((a: any) => [
              'EQUITY (মূলধন ও তহবিল)',
              a.accountCode,
              a.accountName,
              a.currentBalance,
            ]),
          ],
        };
    }
  };

  const activeReport = getReportTable(selectedReportId);

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            ডাবল-এন্ট্রি একাউন্টিং ও ১৭টি আর্থিক প্রতিবেদন (Double-Entry Ledger & Reports)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Member Share Deposits & Down Payments are strictly accounted as Liabilities · Loan Principal Repayments excluded from Income
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { id: 'REPORTS_17', label: '17 Official Reports' },
            { id: 'CHART_OF_ACCOUNTS', label: 'Chart of Accounts' },
            { id: 'GENERAL_LEDGER', label: 'General Ledger & Journals' },
            { id: 'TRIAL_BALANCE', label: 'Trial Balance' },
            { id: 'BALANCE_SHEET', label: 'Income & Balance Sheet' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeSubTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-teal-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: All 17 Reports with PDF / Excel / CSV Export */}
      {activeSubTab === 'REPORTS_17' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <FileText className="h-4 w-4 text-teal-600" />
              <select
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {ALL_17_REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportReportData({
                    title: activeReport.title,
                    fileName: `Hilful_Fuzul_Report_${selectedReportId}`,
                    headers: activeReport.headers,
                    rows: activeReport.rows,
                    format: 'PDF',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  exportReportData({
                    title: activeReport.title,
                    fileName: `Hilful_Fuzul_Report_${selectedReportId}`,
                    headers: activeReport.headers,
                    rows: activeReport.rows,
                    format: 'EXCEL',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() =>
                  exportReportData({
                    title: activeReport.title,
                    fileName: `Hilful_Fuzul_Report_${selectedReportId}`,
                    headers: activeReport.headers,
                    rows: activeReport.rows,
                    format: 'CSV',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  {activeReport.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeReport.rows.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {r.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-4 py-2.5 ${
                          typeof cell === 'number'
                            ? 'font-mono tabular-nums font-medium text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {typeof cell === 'number' ? formatBDT(cell) : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Chart of Accounts */}
      {activeSubTab === 'CHART_OF_ACCOUNTS' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <Layers className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              হিসাবের তালিকা (Double-Entry Chart of Accounts)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Account Code</th>
                  <th className="px-4 py-3">Account Name (English)</th>
                  <th className="px-4 py-3">হিসাবের নাম (Bangla)</th>
                  <th className="px-4 py-3">Account Classification</th>
                  <th className="px-4 py-3">Normal Side</th>
                  <th className="px-4 py-3 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(ledgerData?.chartOfAccounts || []).map((acc: any) => (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                      {acc.accountCode}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                      {acc.accountName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {acc.accountNameBn}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                      {acc.accountType}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                      {acc.normalBalance}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatBDT(acc.currentBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: General Ledger & Balanced Journal Lines */}
      {activeSubTab === 'GENERAL_LEDGER' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <BookOpen className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              জেনারেল লেজার ও জার্নাল এন্ট্রি (Balanced Debit & Credit Postings)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Journal No</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Account</th>
                  <th className="px-3 py-3">Member</th>
                  <th className="px-3 py-3">Narration</th>
                  <th className="px-3 py-3 text-right">Debit (ডেবিট)</th>
                  <th className="px-4 py-3 text-right">Credit (ক্রেডিট)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(ledgerData?.journalEntryLines || []).map((line: any) => (
                  <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 dark:text-white">
                      {line.entryNumber}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                      {line.entryDate}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                      {line.accountCode} · {line.accountName}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-teal-700 dark:text-teal-400">
                      {line.memberId || 'ALL'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {line.narration}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {line.debit > 0 ? formatBDT(line.debit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-teal-700 dark:text-teal-400">
                      {line.credit > 0 ? formatBDT(line.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Trial Balance */}
      {activeSubTab === 'TRIAL_BALANCE' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <Scale className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              রেওয়ামিল / ট্রায়াল ব্যালেন্স (Trial Balance Statement)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Account Head</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Debit (ডেবিট ৳)</th>
                  <th className="px-4 py-3 text-right">Credit (ক্রেডিট ৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(ledgerData?.trialBalance || []).map((tb: any) => (
                  <tr key={tb.accountCode}>
                    <td className="px-4 py-2.5 font-mono font-semibold">{tb.accountCode}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                      {tb.accountName} · {tb.accountNameBn}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{tb.accountType}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {tb.debit > 0 ? formatBDT(tb.debit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {tb.credit > 0 ? formatBDT(tb.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 font-mono text-xs font-bold text-white">
                <tr>
                  <td colSpan={3} className="px-4 py-3">
                    TOTAL TRIAL BALANCE
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                    {formatBDT(
                      (ledgerData?.trialBalance || []).reduce((a: number, r: any) => a + r.debit, 0)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                    {formatBDT(
                      (ledgerData?.trialBalance || []).reduce((a: number, r: any) => a + r.credit, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Income Statement & Balance Sheet */}
      {activeSubTab === 'BALANCE_SHEET' && ledgerData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              আয়-ব্যয় বিবরণী (Income Statement)
            </h3>
            <p className="text-xs text-slate-500">
              Excludes refundable Share Deposits & Loan Principal Repayments
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <p className="font-semibold text-teal-700 dark:text-teal-400">Revenues (আয়সমূহ)</p>
              {(ledgerData.incomeStatement?.revenues || []).map((r: any) => (
                <div key={r.accountCode} className="flex justify-between py-1">
                  <span>
                    {r.accountName} ({r.accountNameBn})
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatBDT(r.currentBalance)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-800">
                <span>Total Revenue</span>
                <span className="font-mono text-emerald-600">
                  {formatBDT(ledgerData.incomeStatement?.totalRevenue)}
                </span>
              </div>

              <p className="mt-4 font-semibold text-amber-700 dark:text-amber-400">
                Operating Expenses (পরিচালন ব্যয়)
              </p>
              {(ledgerData.incomeStatement?.expenses || []).map((e: any) => (
                <div key={e.accountCode} className="flex justify-between py-1">
                  <span>
                    {e.accountName} ({e.accountNameBn})
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatBDT(e.currentBalance)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-800">
                <span>Total Operating Expenses</span>
                <span className="font-mono text-amber-600">
                  {formatBDT(ledgerData.incomeStatement?.totalOperatingExpense)}
                </span>
              </div>

              <div className="mt-4 flex justify-between rounded-lg bg-slate-900 p-3 font-bold text-white">
                <span>Net Cooperative Surplus (নিট উদ্বৃত্ত)</span>
                <span className="font-mono text-emerald-400">
                  {formatBDT(ledgerData.incomeStatement?.netSurplus)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              আর্থিক অবস্থার বিবরণী / উদ্বৃত্তপত্র (Balance Sheet)
            </h3>
            <p className="text-xs text-slate-500">
              Member Share Deposits & Down Payments recorded as Liabilities
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <p className="font-semibold text-teal-700 dark:text-teal-400">Assets (সম্পদসমূহ)</p>
              {(ledgerData.balanceSheet?.assets || []).map((a: any) => (
                <div key={a.accountCode} className="flex justify-between py-1">
                  <span>
                    {a.accountName} ({a.accountNameBn})
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatBDT(a.currentBalance)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-800">
                <span>Total Assets (মোট সম্পদ)</span>
                <span className="font-mono text-emerald-600">
                  {formatBDT(ledgerData.balanceSheet?.totalAssets)}
                </span>
              </div>

              <p className="mt-4 font-semibold text-amber-700 dark:text-amber-400">
                Liabilities — Member Savings & Refundable Deposits (দায়সমূহ)
              </p>
              {(ledgerData.balanceSheet?.liabilities || []).map((l: any) => (
                <div key={l.accountCode} className="flex justify-between py-1">
                  <span>
                    {l.accountName} ({l.accountNameBn})
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatBDT(l.currentBalance)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-800">
                <span>Total Member Liabilities</span>
                <span className="font-mono">
                  {formatBDT(ledgerData.balanceSheet?.totalLiabilities)}
                </span>
              </div>

              <div className="mt-4 flex justify-between rounded-lg bg-slate-900 p-3 font-bold text-white">
                <span>Total Liabilities & Cooperative Equity</span>
                <span className="font-mono text-emerald-400">
                  {formatBDT(
                    (ledgerData.balanceSheet?.totalLiabilities || 0) +
                      (ledgerData.balanceSheet?.totalEquity || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
