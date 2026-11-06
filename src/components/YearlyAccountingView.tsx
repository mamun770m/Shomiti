import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  PlusCircle,
  Printer,
  RotateCcw,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Sliders,
  X,
  Save,
} from 'lucide-react';
import { formatBDT, MONTHS_LIST, YEARS_LIST } from '../lib/utils.ts';
import { exportReportData } from '../lib/exportUtils.ts';

interface YearlyAccountingViewProps {
  role: string;
  currentMemberId: string;
  membersList: Array<{ memberId: string; name: string; nameBn: string; status: string }>;
  authHeaders: Record<string, string>;
  onSelectReceipt: (receipt: any) => void;
  onDataMutated: () => void;
}

export const YearlyAccountingView: React.FC<YearlyAccountingViewProps> = ({
  role,
  currentMemberId,
  membersList,
  authHeaders,
  onSelectReceipt,
  onDataMutated,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentMemberId || '02');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [accountData, setAccountData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Payment Form State
  const [payMonth, setPayMonth] = useState<number>(2);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [shareDeposit, setShareDeposit] = useState<number>(2000);
  const [payable, setPayable] = useState<number>(0);
  const [fine, setFine] = useState<number>(0);
  const [otherReceive, setOtherReceive] = useState<number>(50);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [remarks, setRemarks] = useState<string>('');

  // Reversal Modal State
  const [reversingTx, setReversingTx] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Editing Month Row State
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editShare, setEditShare] = useState<number>(0);
  const [editPayable, setEditPayable] = useState<number>(0);
  const [editFine, setEditFine] = useState<number>(0);
  const [editOther, setEditOther] = useState<number>(0);
  const [editDown, setEditDown] = useState<number>(0);
  const [editExpShare, setEditExpShare] = useState<number>(2000);
  const [editExpPayable, setEditExpPayable] = useState<number>(50);
  const [editTargetMonthlyDue, setEditTargetMonthlyDue] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Adjust Dues Modal State
  const [showAdjustDuesModal, setShowAdjustDuesModal] = useState<boolean>(false);
  const [adjustTargetDue, setAdjustTargetDue] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [savingAdjustDues, setSavingAdjustDues] = useState<boolean>(false);

  useEffect(() => {
    if (role === 'MEMBER' && currentMemberId) {
      setSelectedMemberId(currentMemberId);
    }
  }, [role, currentMemberId]);

  const fetchMemberYear = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/accounting/member-year?memberId=${encodeURIComponent(selectedMemberId)}&year=${selectedYear}&_t=${Date.now()}`,
          { headers: authHeaders, cache: 'no-store' }
        );
        const data = await res.json();
        if (res.ok) {
          setAccountData(data);
        }
      } catch (err) {
        console.error('Error loading member yearly account:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [selectedMemberId, selectedYear, authHeaders]
  );

  useEffect(() => {
    fetchMemberYear(false);
  }, [fetchMemberYear]);

  // Synchronize when financial events or background cloud sync triggers across the application
  useEffect(() => {
    const handleSync = () => {
      fetchMemberYear(true);
    };
    window.addEventListener('hf_financial_sync_trigger', handleSync);
    window.addEventListener('hf_background_sync', handleSync);
    return () => {
      window.removeEventListener('hf_financial_sync_trigger', handleSync);
      window.removeEventListener('hf_background_sync', handleSync);
    };
  }, [fetchMemberYear]);

  const liveTotalReceive =
    (Number(shareDeposit) || 0) +
    (Number(payable) || 0) +
    (Number(fine) || 0) +
    (Number(otherReceive) || 0) +
    (Number(downPayment) || 0);

  const expectedMonthlyOb =
    selectedYear === 2019
      ? 1020
      : selectedYear === 2020
      ? 1520
      : (accountData?.member?.monthlyShareDeposit || 2000) +
        (accountData?.member?.monthlyPayableAmount || 50);
  const eligiblePaid =
    (Number(shareDeposit) || 0) + (Number(payable) || 0) + (Number(otherReceive) || 0);
  const liveMonthlyDue = Math.max(0, expectedMonthlyOb - eligiblePaid);
  const liveAdvanceCredit = Math.max(0, eligiblePaid - expectedMonthlyOb);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/accounting/payment', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          year: selectedYear,
          month: payMonth,
          paymentDate: payDate,
          shareDeposit,
          payable,
          fine,
          otherReceive,
          downPayment,
          paymentMethod,
          remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }
      setFeedbackMsg({
        type: 'success',
        text: `পেমেন্ট সফলভাবে লিপিবদ্ধ হয়েছে! রশিদ নং: ${data.receipt.receiptNo}`,
      });
      setShowPaymentModal(false);
      await fetchMemberYear();
      onDataMutated();
      window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
      if (data.receipt) {
        onSelectReceipt(data.receipt);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingTx || !reversalReason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/reverse/${reversingTx.id}`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reversalReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reversal failed');
      setReversingTx(null);
      setReversalReason('');
      setFeedbackMsg({
        type: 'success',
        text: `লেনদেন ${reversingTx.receiptNo} অনুমোদিত রিভার্সাল এন্ট্রির মাধ্যমে সমন্বয় করা হয়েছে।`,
      });
      await fetchMemberYear();
      onDataMutated();
      window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditRow = (row: any) => {
    const defaultShare = selectedYear === 2019 ? 1000 : selectedYear === 2020 ? 1500 : 2000;
    const defaultPayable = selectedYear <= 2020 ? 20 : 50;
    const hasCustomExp = (row.expectedShareDeposit || 0) + (row.expectedPayable || 0) > 0;
    setEditingRow(row);
    setEditDate(row.paymentDate ? String(row.paymentDate).slice(0, 10) : '');
    setEditShare(row.shareDeposit || 0);
    setEditPayable(row.payable || 0);
    setEditFine(row.fine || 0);
    setEditOther(row.otherReceive || 0);
    setEditDown(row.downPayment || 0);
    setEditExpShare(hasCustomExp ? row.expectedShareDeposit : defaultShare);
    setEditExpPayable(hasCustomExp ? row.expectedPayable : defaultPayable);
    setEditTargetMonthlyDue('');
    setEditRemarks(row.remarks || '');
  };

  const handleSaveRowEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setSavingEdit(true);
    setFeedbackMsg(null);
    try {
      const payload: Record<string, any> = {
        paymentDate: editDate,
        shareDeposit: editShare,
        payable: editPayable,
        fine: editFine,
        otherReceive: editOther,
        downPayment: editDown,
        expectedShareDeposit: editExpShare,
        expectedPayable: editExpPayable,
        remarks: editRemarks,
      };
      if (editTargetMonthlyDue.trim() !== '') {
        payload.targetMonthlyDue = Math.max(0, Number(editTargetMonthlyDue));
      }
      const res = await fetch(`/api/accounting/obligation/${editingRow.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update record');

      setFeedbackMsg({
        type: 'success',
        text: `${editingRow.monthName} ${selectedYear} এর তথ্য সফলভাবে সংশোধন ও স্থায়ীভাবে ডাটাবেজে সংরক্ষণ করা হয়েছে!`,
      });
      setEditingRow(null);
      await fetchMemberYear();
      onDataMutated();
      window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAdjustDuesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdjustDues(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/accounting/adjust-dues', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          year: selectedYear,
          totalOutstanding: adjustTargetDue,
          reason: adjustReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust dues');

      setFeedbackMsg({
        type: 'success',
        text: `সদস্য ${selectedMemberId} এর ${selectedYear} সালের বকেয়া সফলভাবে ৳${adjustTargetDue.toLocaleString()} তে সমন্বয় করা হয়েছে।`,
      });
      setShowAdjustDuesModal(false);
      setAdjustReason('');
      await fetchMemberYear();
      onDataMutated();
      window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setSavingAdjustDues(false);
    }
  };

  const handleExportYearSheet = (format: 'PDF' | 'EXCEL' | 'CSV') => {
    if (!accountData) return;
    const rows = (accountData.monthlyRows || []).map((r: any) => [
      r.monthName,
      r.paymentDate || '-',
      r.shareDeposit,
      r.payable,
      r.fine,
      r.otherReceive,
      r.downPayment,
      r.totalReceiveAmount,
      r.monthlyDue,
      r.status,
    ]);
    const s = accountData.summary || {};
    rows.push([
      'ANNUAL TOTAL',
      `${selectedYear}`,
      s.totalShareDeposit || 0,
      s.totalPayable || 0,
      s.totalFine || 0,
      s.totalOtherReceive || 0,
      s.totalDownPayment || 0,
      s.totalReceiveAmount || 0,
      s.totalOutstanding || 0,
      'SUMMARY',
    ]);

    exportReportData({
      title: `Member Annual Accounting Ledger (${selectedYear}) - ${accountData.member.name} (${accountData.member.memberId})`,
      subtitle: `Father: ${accountData.member.fatherName} | Mobile: ${accountData.member.mobile} | Status: ${accountData.member.status}`,
      fileName: `Hilful_Fuzul_${accountData.member.memberId}_${selectedYear}`,
      headers: [
        'Month',
        'Date',
        'Share Deposit',
        'Payable',
        'Fine',
        'Other Receive',
        'Down Payment',
        'Total Receive Amount',
        'Due',
        'Status',
      ],
      rows,
      format,
    });
  };

  const canRecord = ['SUPER_ADMIN', 'ACCOUNTANT', 'ADMIN'].includes(role);
  const member = accountData?.member;
  const summary = accountData?.summary;
  const prevSummary = accountData?.previousYearSummary;
  const standaloneYearDue = (accountData?.monthlyRows || []).reduce(
    (acc: number, r: any) => acc + (Number(r.monthlyDue) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            সদস্যভিত্তিক বাৎসরিক ও মাসিক হিসাব বিবরণী (Member Yearly Accounting)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Shomiti Hishab English (1).xlsx কাঠামোর হুবহু ডিজিটাল রূপান্তর · ২০১৯ থেকে ২০২৬
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Member Selector (Disabled for MEMBER role due to RLS) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              সদস্য (Member):
            </label>
            <select
              disabled={role === 'MEMBER'}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-teal-600 focus:outline-hidden disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {membersList.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.memberId} — {m.nameBn || m.name} ({m.name})
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector (2019–2026) */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {YEARS_LIST.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selectedYear === yr
                    ? 'bg-slate-900 text-white shadow-xs dark:bg-teal-600'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {canRecord && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdjustTargetDue(summary?.totalOutstanding || 0);
                  setShowAdjustDuesModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap shrink-0"
                title="চলতি বছরের বাৎসরিক বকেয়া সমন্বয় বা পরিমার্জন করুন"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                বকেয়া সমন্বয় (Adjust Dues)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShareDeposit(
                    selectedYear === 2019
                      ? 1000
                      : selectedYear === 2020
                      ? 1500
                      : member?.monthlyShareDeposit || 2000
                  );
                  setPayable(0);
                  setFine(0);
                  setOtherReceive(selectedYear <= 2020 ? 20 : member?.monthlyPayableAmount || 50);
                  setDownPayment(0);
                  setShowPaymentModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                মাসিক জমা এন্ট্রি (Record Deposit)
              </button>
            </div>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-xs font-medium ${
            feedbackMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Member Account Identity & Balance Overview Bar */}
      {member && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <UserCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>সদস্য পরিচিতি · Member Profile</span>
            </div>
            <p className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
              {member.nameBn} ({member.memberId})
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {member.name} · {member.mobile} · Status: {member.status}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              পূর্ববর্তী বছরের জের · Prev Year ({selectedYear - 1})
            </p>
            <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatBDT(prevSummary?.totalReceiveAmount || 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              পূর্ববর্তী বকেয়া (Prev Due): {formatBDT(summary?.previousYearOutstanding || 0)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              চলতি বছরের মোট জমা · {selectedYear} Total Received
            </p>
            <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatBDT(summary?.totalReceiveAmount || 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Share: {formatBDT(summary?.totalShareDeposit)} · Other: {formatBDT(summary?.totalOtherReceive)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedYear} সালের বকেয়া · {selectedYear} Due Breakdown
            </p>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="font-mono text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatBDT(summary?.totalOutstanding || 0)}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-teal-600 dark:text-teal-400">
                {selectedYear} একক বকেয়া: {formatBDT(standaloneYearDue)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {(summary?.previousYearOutstanding || 0) > 0
                ? `পূর্ববর্তী ৳${(summary.previousYearOutstanding || 0).toLocaleString()} + ${selectedYear} সালের ৳${standaloneYearDue.toLocaleString()}`
                : `মাসিক নির্ধারিত হার: ${formatBDT(member.monthlyShareDeposit)} + ${formatBDT(member.monthlyPayableAmount)}`}
            </p>
          </div>
        </div>
      )}

      {/* Main January to December Accounting Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {selectedYear} সালের মাসিক হিসাব ছক (January – December Monthly Ledger)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportYearSheet('PDF')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => handleExportYearSheet('EXCEL')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => handleExportYearSheet('CSV')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">Month (মাস)</th>
                <th className="px-3 py-3 font-semibold">Date (তারিখ)</th>
                <th className="px-3 py-3 text-right font-semibold">Share Deposit</th>
                <th className="px-3 py-3 text-right font-semibold">Payable</th>
                <th className="px-3 py-3 text-right font-semibold">Fine</th>
                <th className="px-3 py-3 text-right font-semibold">Other Receive</th>
                <th className="px-3 py-3 text-right font-semibold">Down Payment</th>
                <th className="px-3 py-3 text-right font-semibold text-teal-700 dark:text-teal-400">
                  Total Receive Amount
                </th>
                <th className="px-3 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                  Due (বকেয়া)
                </th>
                <th className="px-4 py-3 text-right font-semibold">Action / Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="h-10 animate-pulse bg-slate-50/50 dark:bg-slate-900/40">
                    <td colSpan={10} className="px-4 py-2 text-slate-400">
                      Loading monthly accounting row...
                    </td>
                  </tr>
                ))
              ) : (
                (accountData?.monthlyRows || []).map((row: any) => {
                  const bnMonth = MONTHS_LIST[row.month - 1]?.bn || '';
                  return (
                    <tr
                      key={row.id || row.month}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {row.monthName} <span className="text-slate-400">· {bnMonth}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.paymentDate || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {formatBDT(row.shareDeposit)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {formatBDT(row.payable)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatBDT(row.fine)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatBDT(row.otherReceive)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {formatBDT(row.downPayment)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatBDT(row.totalReceiveAmount)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          row.monthlyDue > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {formatBDT(row.monthlyDue)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {row.totalReceiveAmount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectReceipt({
                                  receiptNo:
                                    row.receiptNo ||
                                    `RCP-${selectedYear}-${selectedMemberId}-${row.month}`,
                                  memberId: selectedMemberId,
                                  memberName: member?.name || selectedMemberId,
                                  paymentDate:
                                    row.paymentDate ||
                                    `${selectedYear}-${String(row.month).padStart(2, '0')}-05`,
                                  month: row.month,
                                  monthName: row.monthName,
                                  year: selectedYear,
                                  shareDeposit: row.shareDeposit,
                                  payable: row.payable,
                                  fine: row.fine,
                                  otherReceive: row.otherReceive,
                                  downPayment: row.downPayment,
                                  totalAmount: row.totalReceiveAmount,
                                  paymentMethod: 'CASH / BANK',
                                  receivedBy: 'হিলফুল ফুজুল সমবায় সমিতি',
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
                            >
                              <Printer className="h-3 w-3" />
                              Receipt
                            </button>
                          )}

                          {row.totalReceiveAmount === 0 && canRecord && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayMonth(row.month);
                                setShareDeposit(
                                  selectedYear === 2019
                                    ? 1000
                                    : selectedYear === 2020
                                    ? 1500
                                    : member?.monthlyShareDeposit || 2000
                                );
                                setPayable(0);
                                setFine(0);
                                setOtherReceive(
                                  selectedYear <= 2020 ? 20 : member?.monthlyPayableAmount || 50
                                );
                                setDownPayment(0);
                                setShowPaymentModal(true);
                              }}
                              className="text-xs font-medium text-slate-600 underline hover:text-teal-600 dark:text-slate-400"
                            >
                              Pay Now
                            </button>
                          )}

                          {row.totalReceiveAmount === 0 && !canRecord && (
                            <span className="text-slate-400">Unpaid</span>
                          )}

                          {canRecord && (
                            <button
                              type="button"
                              onClick={() => openEditRow(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-teal-400 hover:bg-white hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-500 dark:hover:bg-slate-700 dark:hover:text-white transition-all shadow-2xs"
                              title="মাসিক তথ্য পরিবর্তন বা সংশোধন করুন (Edit & Correct Record)"
                            >
                              <Edit3 className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                              সংশোধন
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Mandatory Annual Summary Footer */}
            {summary && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-900 font-mono text-xs font-bold text-white dark:border-slate-700 dark:bg-slate-950">
                <tr>
                  <td className="px-4 py-3.5" colSpan={2}>
                    ANNUAL SUMMARY ({selectedYear} সর্বমোট)
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">
                    {formatBDT(summary.totalShareDeposit)}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">
                    {formatBDT(summary.totalPayable)}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">
                    {formatBDT(summary.totalFine)}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">
                    {formatBDT(summary.totalOtherReceive)}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">
                    {formatBDT(summary.totalDownPayment)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm tabular-nums text-emerald-400">
                    {formatBDT(summary.totalReceiveAmount)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm tabular-nums text-amber-400">
                    <div>{formatBDT(standaloneYearDue)}</div>
                    {(summary.previousYearOutstanding || 0) > 0 && (
                      <div className="mt-0.5 text-[10px] font-normal text-amber-200/90">
                        মোট বকেয়া: {formatBDT(summary.totalOutstanding)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-sans text-xs font-normal text-slate-300">
                    Verified
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Multi-Year Comparison Table (2019–2026) & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              বহু-বার্ষিক তুলনামূলক হিসাব (Multi-Year Comparison: 2019–2026)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Year</th>
                  <th className="px-3 py-2.5 text-right">Share Deposit</th>
                  <th className="px-3 py-2.5 text-right">Payable</th>
                  <th className="px-3 py-2.5 text-right">Down Payment</th>
                  <th className="px-3 py-2.5 text-right">Total Received</th>
                  <th className="px-4 py-2.5 text-right">Closing Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(accountData?.multiYearComparison || []).map((yrRow: any) => (
                  <tr
                    key={yrRow.year}
                    onClick={() => setSelectedYear(yrRow.year)}
                    className={`cursor-pointer transition-colors ${
                      yrRow.year === selectedYear
                        ? 'bg-teal-50/70 font-semibold dark:bg-teal-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      {yrRow.year}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(yrRow.totalShareDeposit)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(yrRow.totalPayable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(yrRow.totalDownPayment)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatBDT(yrRow.totalReceiveAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {formatBDT(yrRow.totalOutstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Member Transaction Audit History & Authorized Reversal */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              লেনদেন ও রশিদ ইতিহাস (Posted Transactions & Reversal Control)
            </h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Receipt No</th>
                  <th className="px-3 py-2.5">Period</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(accountData?.transactions || []).slice(0, 20).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-white">
                      {tx.receiptNo}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {tx.monthName} {tx.year}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {formatBDT(tx.totalAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {tx.approvalStatus}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectReceipt(tx)}
                        className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
                      >
                        Receipt
                      </button>
                      {role === 'SUPER_ADMIN' && tx.approvalStatus === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => setReversingTx(tx)}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                          title="Authorized Double-Entry Reversal"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Record Member Monthly Payment */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              মাসিক জমা ও আদায় এন্ট্রি (Record Member Deposit)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Member: {member?.nameBn} ({selectedMemberId}) · Year: {selectedYear}
            </p>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Month (মাস)
                  </label>
                  <select
                    value={payMonth}
                    onChange={(e) => setPayMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {MONTHS_LIST.map((m) => (
                      <option key={m.num} value={m.num}>
                        {m.en} ({m.bn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Payment Date (তারিখ)
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Share Deposit (শেয়ার জমা ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={shareDeposit}
                    onChange={(e) => setShareDeposit(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Payable (মাসিক প্রদেয় ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={payable}
                    onChange={(e) => setPayable(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Fine (জরিমানা ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fine}
                    onChange={(e) => setFine(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Other Receive (অন্যান্য ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={otherReceive}
                    onChange={(e) => setOtherReceive(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Down Payment (ডাউন পেমেন্ট ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="CASH">Cash in Hand (নগদ)</option>
                    <option value="BANK_TRANSFER">Islami Bank Transfer (ব্যাংক)</option>
                    <option value="BKASH">bKash Merchant (বিকাশ)</option>
                    <option value="NAGAD">Nagad (নগদ মোবাইল)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Remarks (মন্তব্য)
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional note..."
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Automatic Formula Preview Box */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Total Receive Amount (Auto-Calculated):
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBDT(liveTotalReceive)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Monthly Due Remaining: {formatBDT(liveMonthlyDue)}</span>
                  <span>Advance Credit Generated: {formatBDT(liveAdvanceCredit)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {submitting ? 'Posting to Ledger...' : 'Approve & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Authorized Reversal */}
      {reversingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold">
                অনুমোদিত লেনদেন রিভার্সাল (Authorized Transaction Reversal)
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Posted transactions are never permanently deleted. This will post a balanced reversing
              journal entry for receipt <strong>{reversingTx.receiptNo}</strong> ({formatBDT(reversingTx.totalAmount)}).
            </p>
            <form onSubmit={handleReverseTransaction} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Mandatory Audit Reason for Reversal:
                </label>
                <textarea
                  rows={3}
                  required
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="State official accounting reason for reversal..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversingTx(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
                >
                  Confirm Reversal Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit / Correct Monthly Record */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Edit3 className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  মাসিক তথ্য সংশোধন ও পরিমার্জন (Edit Monthly Record)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {accountData?.member?.nameBn} ({selectedMemberId})
                </span>
                <span className="ml-2">· {accountData?.member?.name}</span>
              </div>
              <div className="font-mono font-bold text-teal-700 dark:text-teal-400">
                {editingRow.monthName} ({MONTHS_LIST[editingRow.month - 1]?.bn}) · {selectedYear}
              </div>
            </div>

            <form onSubmit={handleSaveRowEdit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Payment Date (জমা / রশিদের তারিখ):
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Share Deposit (শেয়ার জমা ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editShare}
                    onChange={(e) => setEditShare(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Payable (চাঁদা ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editPayable}
                    onChange={(e) => setEditPayable(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Fine (জরিমানা ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editFine}
                    onChange={(e) => setEditFine(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Other (অন্যান্য ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editOther}
                    onChange={(e) => setEditOther(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Down Payment (৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editDown}
                    onChange={(e) => setEditDown(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Expected Share Deposit (নির্ধারিত শেয়ার ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editExpShare}
                    onChange={(e) => setEditExpShare(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Expected Payable (নির্ধারিত চাঁদা ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editExpPayable}
                    onChange={(e) => setEditExpPayable(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-amber-700 dark:text-amber-400">
                    সরাসরি বকেয়া নির্ধারণ (Target Monthly Due ৳):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editTargetMonthlyDue}
                    onChange={(e) => setEditTargetMonthlyDue(e.target.value)}
                    placeholder={`বর্তমান: ৳${editingRow.monthlyDue || 0} (ঐচ্ছিক)`}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 text-slate-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  সংশোধনের বিবরণ / মন্তব্য (Audit Remarks / Reason):
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="তথ্য পরিবর্তনের কারণ লিখুন..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Live Preview Summary Strip */}
              <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-900/50 dark:bg-teal-950/40">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-teal-900 dark:text-teal-200">
                    নতুন মোট আদায় (New Total): {formatBDT(editShare + editPayable + editFine + editOther + editDown)}
                  </span>
                  <span className="text-amber-800 dark:text-amber-300">
                    নির্ধারিত চাঁদা: {formatBDT(editExpShare + editExpPayable)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingEdit ? 'সংরক্ষণ হচ্ছে...' : 'হালনাগাদ সংরক্ষণ করুন (Save)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Annual Dues & Balances */}
      {showAdjustDuesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Sliders className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  বাৎসরিক বকেয়া সমন্বয় (Adjust Dues)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustDuesModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              সদস্য <strong>{accountData?.member?.nameBn} ({selectedMemberId})</strong> এর {selectedYear} সালের মোট সমাপনী বকেয়া নির্ধারণ করুন।
            </p>

            <form onSubmit={handleAdjustDuesSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  {selectedYear} সালের মোট বকেয়া (Target Outstanding Due ৳):
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={adjustTargetDue}
                  onChange={(e) => setAdjustTargetDue(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  সমন্বয়ের কারণ / অডিট নোট (Audit Reason):
                </label>
                <textarea
                  rows={3}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="বকেয়া সমন্বয়ের কারণ উল্লেখ করুন (যেমন: সাধারণ সভার সিদ্ধান্ত / ঐতিহাসিক হিসাব সমন্বয়)..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustDuesModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={savingAdjustDues}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingAdjustDues ? 'সমন্বয় হচ্ছে...' : 'বকেয়া সমন্বয় নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
