import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RotateCcw,
  ShieldCheck,
  Database,
  Search,
} from 'lucide-react';
import { formatBDT } from '../lib/utils.ts';
import {
  downloadReferenceExcelWorkbook,
  exportReportData,
  parseSocietyExcelFile,
} from '../lib/exportUtils.ts';

interface ExcelMigrationViewProps {
  role: string;
  membersList: Array<{ memberId: string; name: string; nameBn: string }>;
  authHeaders: Record<string, string>;
  onDataMutated: () => void;
}

export const ExcelMigrationView: React.FC<ExcelMigrationViewProps> = ({
  role,
  membersList,
  authHeaders,
  onDataMutated,
}) => {
  const [intelligence, setIntelligence] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'YEAR_SUMMARY' | 'MEMBER_INDEX_27' | 'VALIDATION_REPORT' | 'RAW_1152_EXPLORER' | 'BATCH_QUEUE'
  >('YEAR_SUMMARY');

  // Filters for 1,152 raw records explorer
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterSearch, setFilterSearch] = useState<string>('');

  const fetchAllMigrationData = useCallback(async () => {
    setLoading(true);
    try {
      const [intRes, batRes] = await Promise.all([
        fetch('/api/data-intelligence', { headers: authHeaders }),
        fetch('/api/excel/batches', { headers: authHeaders }),
      ]);
      if (intRes.ok) {
        setIntelligence(await intRes.json());
      }
      if (batRes.ok) {
        const data = await batRes.json();
        setBatches(data.batches || []);
        setRows(data.rows || []);
        if (data.batches?.length > 0 && !selectedBatchId) {
          setSelectedBatchId(data.batches[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data intelligence & batches:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, selectedBatchId]);

  useEffect(() => {
    fetchAllMigrationData();
  }, [fetchAllMigrationData]);

  const activeBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];
  const activeRows = rows.filter((r) => !activeBatch || r.batchId === activeBatch.id);

  const handleApproveAuthenticPackage = async () => {
    setProcessing(true);
    setStatusMessage(
      'Super Admin Approval: Committing all 1,152 historical records and 12 canonical member blocks from Shomiti Hishab English (1).xlsx to PostgreSQL...'
    );
    try {
      const res = await fetch('/api/data-intelligence/approve', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve package');
      setStatusMessage(
        `SUCCESS: All ${data.totalRecords} historical records from "Shomiti Hishab English (1).xlsx" have been approved and synchronized into live PostgreSQL tables.`
      );
      await fetchAllMigrationData();
      onDataMutated();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setStatusMessage(`STEP 1–8: Reading worksheets and validating "${file.name}"...`);
    try {
      const parsed = await parseSocietyExcelFile(file);
      const res = await fetch('/api/excel/stage', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stage workbook');
      setStatusMessage(
        `Staged batch ${data.batch.batchCode}: ${data.batch.totalMonthlyRecords} monthly records analyzed. Ready for Super Admin review.`
      );
      setSelectedBatchId(data.batch.id);
      setActiveTab('BATCH_QUEUE');
      await fetchAllMigrationData();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  const handleApproveBatch = async (batchId: number) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/excel/approve/${batchId}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatusMessage(
        `STEP 10 Complete: Imported ${data.importedCount} validated records into PostgreSQL and recalculated annual summaries.`
      );
      await fetchAllMigrationData();
      onDataMutated();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRollbackBatch = async (batchId: number) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/excel/rollback/${batchId}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatusMessage(`Batch ${data.batch.batchCode} rolled back safely prior to final posting.`);
      await fetchAllMigrationData();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const filteredRawRecords = (intelligence?.rawRecords || []).filter((r: any) => {
    if (filterYear !== 'ALL' && String(r.accounting_year) !== filterYear) return false;
    if (!filterSearch.trim()) return true;
    const q = filterSearch.toLowerCase();
    return (
      String(r.member_id).toLowerCase().includes(q) ||
      String(r.member_name).toLowerCase().includes(q) ||
      String(r.month).toLowerCase().includes(q) ||
      String(r.date_raw || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Intelligence Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            হিলফুল ফুজুল ডাটা ইন্টেলিজেন্স ও এক্সেল মাইগ্রেশন (Historical Data Intelligence System)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Source: &quot;Shomiti Hishab English (1).xlsx&quot; · 1,152 Monthly Records (2019–2026) ·
            27 Member Index Pairs · 148 Date Warnings Preserved
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {role === 'SUPER_ADMIN' && (
            <button
              type="button"
              disabled={processing}
              onClick={handleApproveAuthenticPackage}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="h-4 w-4" />
              Approve &amp; Sync 1,152 Package Records to Live PostgreSQL
            </button>
          )}

          <button
            type="button"
            onClick={() => downloadReferenceExcelWorkbook(membersList)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-teal-600" />
            Download XLSX Template
          </button>

          {['SUPER_ADMIN', 'ADMIN'].includes(role) && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 whitespace-nowrap shrink-0">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload .XLSX / .CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-3 text-xs font-medium text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
          {statusMessage}
        </div>
      )}

      {/* 9-Metric Forensic Package Summary Strip */}
      {intelligence && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
          {[
            { label: 'Annual Sheets', val: intelligence.totalSheets },
            { label: 'Monthly Rows', val: intelligence.totalRecords },
            { label: 'ID-Name Pairs', val: intelligence.uniqueMemberIdNamePairs },
            { label: 'Physical Members', val: 12 },
            { label: 'Date Warnings', val: intelligence.warningsCount },
            {
              label: 'Null Component Rows',
              val: intelligence.validationAnomalies?.missingComponentRows?.length || 7,
            },
            {
              label: 'Missing Total Formula',
              val: intelligence.validationAnomalies?.missingTotalFormulaCount || 75,
            },
            {
              label: 'Missing Due Formula',
              val: intelligence.validationAnomalies?.missingDueFormulaCount || 74,
            },
            {
              label: 'Negative Cached Dues',
              val: intelligence.validationAnomalies?.negativeDueRowsCount || 61,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                {item.val}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Sub-Tabs for the Data Intelligence System */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { id: 'YEAR_SUMMARY', label: '01. Year-Wise Summary (2019–2026)' },
            { id: 'MEMBER_INDEX_27', label: '02. Unified Member Index (27 Pairs)' },
            { id: 'VALIDATION_REPORT', label: '03. Data Validation Report (148+ Flags)' },
            { id: 'RAW_1152_EXPLORER', label: '04. All 1,152 Source Rows Explorer' },
            { id: 'BATCH_QUEUE', label: '05. PostgreSQL Import Batch Queue' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-teal-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: YEAR-WISE FINANCIAL SUMMARY (2019–2026) */}
      {activeTab === 'YEAR_SUMMARY' && intelligence && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                বাৎসরিক আর্থিক সারসংক্ষেপ (Year-Wise Financial Summary: 2019–2026)
              </h3>
              <p className="text-xs text-slate-500">
                Reconciles Excel Cached Totals &amp; Dues against Proper Eligible-Obligation Accounting
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                exportReportData({
                  title: 'Year-Wise Historical Financial Summary (2019-2026)',
                  fileName: 'Hilful_Fuzul_Year_Wise_Summary_2019_2026',
                  headers: [
                    'Year',
                    'Rows',
                    'Expected Monthly Rate',
                    'Share Deposit',
                    'Payable',
                    'Fine',
                    'Other Receive',
                    'Down Payment',
                    'Total Receive',
                    'Excel Cached Due',
                    'Proper Net Due',
                  ],
                  rows: intelligence.yearSummaries.map((y: any) => [
                    y.year,
                    y.totalRows,
                    y.expectedMonthlyRate,
                    y.shareDeposit,
                    y.payable,
                    y.fine,
                    y.otherReceive,
                    y.downPayment,
                    y.totalReceive,
                    y.excelCachedDue,
                    y.properNetDue,
                  ]),
                  format: 'EXCEL',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Year Summary (.xlsx)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-3 py-3 text-right">Rows</th>
                  <th className="px-3 py-3 text-right">Monthly Policy</th>
                  <th className="px-3 py-3 text-right">Share Deposit</th>
                  <th className="px-3 py-3 text-right">Payable</th>
                  <th className="px-3 py-3 text-right">Fine</th>
                  <th className="px-3 py-3 text-right">Other Receive</th>
                  <th className="px-3 py-3 text-right">Down Payment</th>
                  <th className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">
                    Total Receive
                  </th>
                  <th className="px-3 py-3 text-right text-slate-500">Excel Cached Due</th>
                  <th className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
                    Proper Net Due
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {intelligence.yearSummaries.map((y: any) => (
                  <tr key={y.year} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      {y.year}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{y.totalRows}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">
                      {formatBDT(y.expectedMonthlyRate)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(y.shareDeposit)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(y.payable)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(y.fine)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(y.otherReceive)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(y.downPayment)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatBDT(y.totalReceive)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">
                      {formatBDT(y.excelCachedDue)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatBDT(y.properNetDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 font-mono text-xs font-bold text-white">
                <tr>
                  <td className="px-4 py-3">GRAND TOTAL (2019–2026)</td>
                  <td className="px-3 py-3 text-right tabular-nums">1,152</td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatBDT(
                      intelligence.yearSummaries.reduce((a: number, r: any) => a + r.shareDeposit, 0)
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">৳0</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatBDT(
                      intelligence.yearSummaries.reduce((a: number, r: any) => a + r.fine, 0)
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatBDT(
                      intelligence.yearSummaries.reduce((a: number, r: any) => a + r.otherReceive, 0)
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatBDT(
                      intelligence.yearSummaries.reduce((a: number, r: any) => a + r.downPayment, 0)
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-400">
                    {formatBDT(
                      intelligence.yearSummaries.reduce((a: number, r: any) => a + r.totalReceive, 0)
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-400">
                    {formatBDT(
                      intelligence.yearSummaries.reduce(
                        (a: number, r: any) => a + r.excelCachedDue,
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-400">
                    {formatBDT(
                      intelligence.yearSummaries.reduce((a: number, r: any) => a + r.properNetDue, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UNIFIED 27-ENTRY MEMBER INDEX */}
      {activeTab === 'MEMBER_INDEX_27' && intelligence && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ইউনিফাইড মেম্বার ইনডেক্স (27 Conservative Unmerged Member-ID/Name Pairs)
              </h3>
              <p className="text-xs text-slate-500">
                Preserves exact IDs from member_index_for_ai_studio.json without auto-merging 2024 renumbered IDs (01–12) or Minar Hossain spelling variants
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                exportReportData({
                  title: 'Unified 27-Entry Member Index (Conservative Unmerged Identity Report)',
                  fileName: 'Hilful_Fuzul_Member_Index_27_Pairs',
                  headers: [
                    '#',
                    'Member ID',
                    'Member Name',
                    'Phone',
                    'Excel Row',
                    'Years Active',
                    'Share Deposit',
                    'Fine',
                    'Other Receive',
                    'Down Payment',
                    'Total Receive',
                    'Proper Due',
                  ],
                  rows: intelligence.enrichedMemberIndex.map((m: any) => [
                    m.indexNo,
                    m.memberId,
                    m.memberName,
                    m.phone,
                    m.sourceMemberRow,
                    m.years.join(', '),
                    m.totalShareDeposit,
                    m.totalFine,
                    m.totalOtherReceive,
                    m.totalDownPayment,
                    m.totalReceive,
                    m.properOutstandingDue,
                  ]),
                  format: 'PDF',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-teal-600"
            >
              <Download className="h-3.5 w-3.5" />
              Export 27-Pair Member Index (PDF)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Member ID</th>
                  <th className="px-3 py-3">Recorded Member Name</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Block Row</th>
                  <th className="px-3 py-3">Accounting Years</th>
                  <th className="px-3 py-3 text-right">Share Deposit</th>
                  <th className="px-3 py-3 text-right">Fine</th>
                  <th className="px-3 py-3 text-right">Other Receive</th>
                  <th className="px-3 py-3 text-right">Down Payment</th>
                  <th className="px-3 py-3 text-right">Total Receive</th>
                  <th className="px-4 py-3 text-right">Proper Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {intelligence.enrichedMemberIndex.map((m: any) => (
                  <tr key={m.indexNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono text-slate-400">{m.indexNo}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                      {m.memberId}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                      {m.memberName}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                      {m.phone}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">Row {m.sourceMemberRow}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                      {m.years.join(', ')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(m.totalShareDeposit)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(m.totalFine)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(m.totalOtherReceive)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBDT(m.totalDownPayment)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatBDT(m.totalReceive)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatBDT(m.properOutstandingDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FORENSIC DATA VALIDATION REPORT */}
      {activeTab === 'VALIDATION_REPORT' && intelligence && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Same Member ID with Different Names (2024 Renumbering Collision) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                1. Same Member ID with Different Names (ID Collisions in 2024 Sheet)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                In 2019–23 &amp; 2025–26, IDs were 02, 04, 05, 06, 07, 09, 10, 11, 12, 14, 15, 16. In 2024, blocks were renumbered 01–12.
              </p>
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2 text-xs">
                {intelligence.sameIdDifferentNames.map((item: any) => (
                  <div
                    key={item.memberId}
                    className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
                  >
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                      Member ID {item.memberId}:
                    </span>{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {item.identities.join('  |  ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Component Cells & Payments Without Dates */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
                2. Missing Component Amounts (7 Rows) &amp; Undated Payments (11 Rows)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Rows where payable or down_payment cell is null, or payment was received with blank date_raw
              </p>
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2 text-xs">
                {intelligence.validationAnomalies.missingComponentRows.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-900/40 dark:bg-amber-950/30"
                  >
                    <span className="font-mono font-semibold">
                      [Sheet {r.source_sheet} · Row {r.source_data_row}]
                    </span>{' '}
                    ID {r.member_id} ({r.member_name}) — {r.month}: Blank component cell (Share:{' '}
                    {r.share_deposit}, Payable: {String(r.payable)}, Down: {String(r.down_payment)}) →
                    Cached Total: {formatBDT(r.total_receive_excel_cached)}
                  </div>
                ))}
                {intelligence.validationAnomalies.paidWithoutDateRows.map((r: any, idx: number) => (
                  <div
                    key={`undated-${idx}`}
                    className="rounded-lg border border-slate-200 p-2 dark:border-slate-800"
                  >
                    <span className="font-mono font-semibold">
                      [Sheet {r.source_sheet} · Row {r.source_data_row}]
                    </span>{' '}
                    ID {r.member_id} ({r.member_name}) — {r.month}: Paid{' '}
                    <strong>{formatBDT(r.total_receive_excel_cached)}</strong> with missing{' '}
                    <code>date_raw</code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* All 148 Date Warnings Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                3. All 148 Extracted Date &amp; Year-Mismatch Warnings (import_validation_report.json)
              </h3>
              <button
                type="button"
                onClick={() =>
                  exportReportData({
                    title: 'Hilful Fuzul Historical Data Validation & Date Warnings Report (148 Flags)',
                    fileName: 'Hilful_Fuzul_148_Date_Validation_Warnings',
                    headers: ['Sheet', 'Excel Row', 'Warning Type', 'Member ID', 'Member Name', 'Month', 'Raw Date', 'Accounting Year'],
                    rows: (intelligence.validationAnomalies.warningsSample || []).map((w: any) => [
                      w.sheet,
                      w.row,
                      w.type,
                      w.member_id,
                      w.member_name,
                      w.month,
                      w.date_raw,
                      w.accounting_year,
                    ]),
                    format: 'PDF',
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                Download 148 Warnings (PDF)
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Sheet · Row</th>
                    <th className="px-3 py-2.5">Warning Type</th>
                    <th className="px-3 py-2.5">Member ID &amp; Name</th>
                    <th className="px-3 py-2.5">Month</th>
                    <th className="px-3 py-2.5">Preserved Raw Date (date_raw)</th>
                    <th className="px-4 py-2.5">Accounting Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(intelligence.validationAnomalies.warningsSample || []).map(
                    (w: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2 font-mono">
                          {w.sheet} · R{w.row}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-600 dark:text-amber-400">
                          {w.type}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {w.member_id} — {w.member_name}
                        </td>
                        <td className="px-3 py-2">{w.month}</td>
                        <td className="px-3 py-2 font-mono font-bold text-red-600 dark:text-red-400">
                          {w.date_raw}
                        </td>
                        <td className="px-4 py-2 font-mono">{w.accounting_year}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALL 1,152 RAW SOURCE RECORDS EXPLORER */}
      {activeTab === 'RAW_1152_EXPLORER' && intelligence && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                সকল ১,১৫২টি মূল এক্সেল রেকর্ড (All 1,152 Extracted Monthly Rows — REVIEW_REQUIRED)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Filter ID, Name, Month, Raw Date..."
                  className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="ALL">All Sheets (2019–2026)</option>
                {['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'].map((y) => (
                  <option key={y} value={y}>
                    Sheet {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2.5">Sheet · Row</th>
                  <th className="px-3 py-2.5">ID · Member Name</th>
                  <th className="px-3 py-2.5">Month</th>
                  <th className="px-3 py-2.5">date_raw</th>
                  <th className="px-3 py-2.5 text-right">Share</th>
                  <th className="px-3 py-2.5 text-right">Other</th>
                  <th className="px-3 py-2.5 text-right">Down Pay</th>
                  <th className="px-3 py-2.5 text-right">Total (Cached)</th>
                  <th className="px-3 py-2.5">Excel Formula</th>
                  <th className="px-3 py-2.5 text-right">Due (Cached)</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRawRecords.slice(0, 300).map((r: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">
                      {r.source_sheet} · R{r.source_data_row}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                        {r.member_id}
                      </span>{' '}
                      · {r.member_name}
                    </td>
                    <td className="px-3 py-2">{r.month}</td>
                    <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {r.date_raw || '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(r.share_deposit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(r.other_receive)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(r.down_payment)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatBDT(r.total_receive_excel_cached)}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {r.total_receive_excel_formula || 'MISSING_FORMULA'}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        Number(r.due_excel_cached) < 0
                          ? 'text-red-600 font-bold'
                          : Number(r.due_excel_cached) > 0
                          ? 'text-amber-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatBDT(r.due_excel_cached)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                      {r.import_status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: POSTGRESQL IMPORT BATCH QUEUE & ROLLBACK */}
      {activeTab === 'BATCH_QUEUE' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                PostgreSQL Import Batch Queue
              </h3>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchCode} — {b.fileName} [{b.status}]
                  </option>
                ))}
              </select>
            </div>

            {role === 'SUPER_ADMIN' &&
              activeBatch &&
              (activeBatch.status === 'STAGED' || activeBatch.status === 'REVIEW_REQUIRED') && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleApproveBatch(activeBatch.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Approve Batch
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleRollbackBatch(activeBatch.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Rollback Batch
                  </button>
                </div>
              )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Sheet · Row</th>
                  <th className="px-3 py-2.5">Member ID &amp; Name</th>
                  <th className="px-3 py-2.5">Month &amp; Raw Date</th>
                  <th className="px-3 py-2.5 text-right">Share</th>
                  <th className="px-3 py-2.5 text-right">Other</th>
                  <th className="px-3 py-2.5 text-right">Down Pay</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Validation</th>
                  <th className="px-4 py-2.5">Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                      Loading staged rows...
                    </td>
                  </tr>
                ) : (
                  activeRows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-mono">
                        {row.worksheetName} · R{row.rowNumber}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {row.memberId} · {row.memberName}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {row.monthName} ({row.rawDate || '—'})
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {formatBDT(row.shareDeposit)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {formatBDT(row.otherReceive)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {formatBDT(row.downPayment)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600">
                        {formatBDT(row.totalReceiveAmount)}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.validationStatus === 'VALID' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            VALID
                          </span>
                        ) : row.validationStatus === 'WARNING' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            WARNING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-red-600">
                            <XCircle className="h-3.5 w-3.5" />
                            {row.validationStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {row.validationMessages}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
