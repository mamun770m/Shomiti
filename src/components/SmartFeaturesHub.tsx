import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  Share2,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  CreditCard,
  Calculator,
  FileText,
  Vote,
  Landmark,
  Download,
  Printer,
  QrCode,
  Send,
  Plus,
  Trash2,
  Check,
  X,
  Copy,
  Sparkles,
  ShieldCheck,
  Users,
  Calendar,
  TrendingUp,
  Database,
  BookOpen,
} from 'lucide-react';
import { formatBDT, YEARS_LIST, MONTHS_LIST } from '../lib/utils.ts';
import { SocietyLogoAvatar, SocietyBranding } from './SocietyHomePage.tsx';
import { OFFICIAL_SOCIETY_LOGO_URL } from '../lib/officialLogo.ts';

export type SmartTabId =
  | 'HEATMAP_WHATSAPP'
  | 'ONLINE_PAYMENTS'
  | 'ID_CARD_CERTIFICATE'
  | 'DIVIDEND_CALCULATOR'
  | 'MEETINGS_POLLS'
  | 'ASSETS_BACKUP';

interface SmartFeaturesHubProps {
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  currentMemberId: string;
  branding: SocietyBranding;
  kpis: any;
  members: any[];
  authHeaders: Record<string, string>;
  initialTab?: SmartTabId;
  onSelectReceipt: (rcp: any) => void;
  onOpenMemberLedger: (memberId: string) => void;
  onDataMutated: () => void;
}

// Deterministic 11x11 QR matrix generator for ID Cards & Share Certificates
const makeQrGrid = (seed: string): boolean[][] => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const size = 11;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const setCorner = (r0: number, c0: number) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid[r0 + r][c0 + c] = true;
      }
    }
  };
  setCorner(0, 0);
  setCorner(0, size - 3);
  setCorner(size - 3, 0);
  let state = Math.abs(hash) || 9876543;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
      if (!inFinder) {
        state = (state * 1664525 + 1013904223) % 4294967296;
        grid[r][c] = state % 2 === 0;
      }
    }
  }
  return grid;
};

export const SmartFeaturesHub: React.FC<SmartFeaturesHubProps> = ({
  role,
  currentMemberId,
  branding,
  kpis,
  members,
  authHeaders,
  initialTab = 'HEATMAP_WHATSAPP',
  onSelectReceipt,
  onOpenMemberLedger,
  onDataMutated,
}) => {
  const [activeTab, setActiveTab] = useState<SmartTabId>(initialTab);
  const [heatmapYear, setHeatmapYear] = useState<number>(2026);
  const [smartData, setSmartData] = useState<any>({
    year: 2026,
    heatmap: [],
    paymentRequests: [],
    meetings: [],
    polls: [],
    assets: [],
    dividends: [],
    targetFund: {
      titleBn: 'সমিতির দীর্ঘমেয়াদী মূলধন ও ল্যান্ড প্রজেক্ট লক্ষ্যমাত্রা (২০১৯–২০২৬)',
      targetAmount: 3500000,
      deadline: '2026-12-31',
      noteBn: '১২ জন প্রতিষ্ঠাতা সদস্যের সম্মিলিত তহবিল লক্ষ্যমাত্রা',
    },
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string>('');

  // Tab 2: Online Payment Request form state
  const [payForm, setPayForm] = useState({
    memberId: currentMemberId || '02',
    year: 2026,
    month: new Date().getMonth() + 1,
    shareDeposit: 2000,
    payable: 50,
    downPayment: 0,
    fine: 0,
    otherReceive: 0,
    paymentMethod: 'bKash',
    transactionId: '',
    senderNumber: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });
  const [submittingPay, setSubmittingPay] = useState(false);

  // Tab 3: Smart ID Card, Share Certificate & Passbook state
  const [selectedCardMemberId, setSelectedCardMemberId] = useState<string>(currentMemberId || '02');
  const [docMode, setDocMode] = useState<'ID_CARD' | 'SHARE_CERTIFICATE' | 'PASSBOOK'>('ID_CARD');

  // Tab 4: Dividend Calculator state
  const [divTitle, setDivTitle] = useState('বার্ষিক মুনাফা ও লভ্যাংশ বণ্টন বিবরণী — ২০২৬');
  const [divFiscalYear, setDivFiscalYear] = useState(2026);
  const [totalProfitInput, setTotalProfitInput] = useState<number>(360000);
  const [reservePercentInput, setReservePercentInput] = useState<number>(10);
  const [distributionMode, setDistributionMode] = useState<'CAPITAL_RATIO' | 'EQUAL_SHARE'>('CAPITAL_RATIO');

  // Tab 5: Meetings & Polls state
  const [meetingForm, setMeetingForm] = useState({
    meetingNo: `সাধারণ সভা — ০২/${new Date().getFullYear()}`,
    title: '',
    meetingDate: new Date().toISOString().slice(0, 10),
    venue: 'সমিতি প্রধান কার্যালয়, কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
    presidedBy: 'হাফেজ মোহাম্মদ কামরুজ্জামান (সভাপতি - #02)',
    secretaryName: 'মোঃ আরিফুল ইসলাম (সাধারণ সম্পাদক - #06)',
    agenda: '',
    resolutionsText: '',
  });
  const [pollForm, setPollForm] = useState({
    title: '',
    description: '',
    deadline: '2026-12-31',
    option1: '',
    option2: '',
    option3: '',
  });

  // Tab 6: Asset Valuation & Target Fund state
  const [assetForm, setAssetForm] = useState({
    nameBn: '',
    location: 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
    purchaseYear: '2026',
    investedAmount: 0,
    currentMarketValue: 0,
    deedOrRefNo: '',
    notes: '',
  });
  const [targetAmountInput, setTargetAmountInput] = useState<number>(3500000);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const isSuperOrAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4500);
  };

  const loadSmartFeatures = useCallback(async () => {
    try {
      const res = await fetch(`/api/smart-features?year=${heatmapYear}&_t=${Date.now()}`, {
        headers: authHeaders,
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        setSmartData(json);
        if (json.targetFund?.targetAmount) {
          setTargetAmountInput(Number(json.targetFund.targetAmount));
        }
      }
    } catch (err) {
      console.error('Load smart features error:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, heatmapYear]);

  useEffect(() => {
    loadSmartFeatures();
  }, [loadSmartFeatures]);

  useEffect(() => {
    if (role === 'MEMBER' && currentMemberId) {
      setPayForm((prev) => ({ ...prev, memberId: currentMemberId }));
      setSelectedCardMemberId(currentMemberId);
    }
  }, [role, currentMemberId]);

  const heatmapRows = useMemo(() => {
    const rows = smartData.heatmap || [];
    if (role === 'MEMBER') {
      return rows.filter((r: any) => r.memberId === currentMemberId);
    }
    return rows;
  }, [smartData.heatmap, role, currentMemberId]);

  // WhatsApp & SMS helper for Due Reminder or Payment Confirmation
  const buildMemberWhatsAppMessage = (row: any) => {
    if (row.totalOutstanding > 0) {
      return `সম্মানিত সদস্য ${row.nameBn || row.name} (আইডি #${row.memberId}), আসসালামু আলাইকুম।\nহিলফুল ফুজুল সমবায় সমিতিতে আপনার ২০১৯–২০২৬ পর্যন্ত সর্বমোট জমা ${formatBDT(
        row.lifetimeTotalReceived
      )} এবং বর্তমান মোট বকেয়া ${formatBDT(
        row.totalOutstanding
      )}।\nপ্রতি মাসের ১–১০ তারিখের মধ্যে মাসিক কিস্তি (শেয়ার আমানত ৳২,০০০ + প্রদেয় ৳৫০ = ৳২,০৫০) এবং বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হলো।\nধন্যবাদান্তে,\nকার্যনির্বাহী কমিটি, হিলফুল ফুজুল সমবায় সমিতি`;
    }
    return `সম্মানিত সদস্য ${row.nameBn || row.name} (আইডি #${row.memberId}), আসসালামু আলাইকুম।\nহিলফুল ফুজুল সমবায় সমিতিতে আপনার সর্বমোট জমা ${formatBDT(
      row.lifetimeTotalReceived
    )} এবং আপনার কোনো বকেয়া নেই (৳০ বকেয়া — গোল্ড মেম্বার)। নিয়মিত কিস্তি পরিশোধের জন্য আপনাকে আন্তরিক ধন্যবাদ ও মোবারকবাদ!\n— হিলফুল ফুজুল সমবায় সমিতি`;
  };

  const getWhatsAppLink = (mobile: string, text: string) => {
    const clean = (mobile || '').replace(/[^0-9]/g, '');
    const phone = clean ? (clean.startsWith('88') ? clean : `88${clean}`) : '';
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Submit Online Payment Request
  const handleSubmitPaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingPay(true);
      const res = await fetch('/api/smart-features/payment-request', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'পেমেন্ট রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে');
        return;
      }
      setSmartData((prev: any) => ({ ...prev, paymentRequests: data.paymentRequests || [] }));
      setPayForm((prev) => ({ ...prev, transactionId: '', remarks: '' }));
      showToast('আপনার অনলাইন পেমেন্ট রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন অনুমোদনের সাথে সাথে রশিদ ইস্যু হবে।');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPay(false);
    }
  };

  // Approve Online Payment Request
  const handleApproveRequest = async (reqId: string) => {
    try {
      const res = await fetch(`/api/smart-features/payment-request/${encodeURIComponent(reqId)}/approve`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'অনুমোদন করতে সমস্যা হয়েছে');
        return;
      }
      await loadSmartFeatures();
      onDataMutated();
      showToast(`পেমেন্ট অনুমোদিত হয়েছে এবং লেজারে পোস্ট করা হয়েছে! রশিদ নং: ${data.receipt?.receiptNo || ''}`);
      if (data.receipt) {
        onSelectReceipt(data.receipt);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reject Online Payment Request
  const handleRejectRequest = async (reqId: string) => {
    try {
      const res = await fetch(`/api/smart-features/payment-request/${encodeURIComponent(reqId)}/reject`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'TrxID যাচাইয়ে অমিল পাওয়া গেছে' }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, paymentRequests: data.paymentRequests || [] }));
        showToast('পেমেন্ট রিকোয়েস্টটি বাতিল (Rejected) করা হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dividend Calculation
  const dividendRows = useMemo(() => {
    const sourceRows = smartData.heatmap?.length > 0 ? smartData.heatmap : members;
    const totalCapital = sourceRows.reduce(
      (sum: number, m: any) =>
        sum + (Number(m.lifetimeShareDeposit || 0) + Number(m.lifetimeDownPayment || 0)),
      0
    );
    const reserveDeduction = Math.round((totalProfitInput * reservePercentInput) / 100);
    const distributableProfit = Math.max(0, totalProfitInput - reserveDeduction);
    const memberCount = sourceRows.length || 12;

    const allocations = sourceRows.map((m: any) => {
      const shareCap = Number(m.lifetimeShareDeposit || 0);
      const downCap = Number(m.lifetimeDownPayment || 0);
      const totalMemberCap = shareCap + downCap;
      const ratioPercent =
        distributionMode === 'EQUAL_SHARE'
          ? 100 / memberCount
          : totalCapital > 0
          ? (totalMemberCap / totalCapital) * 100
          : 100 / memberCount;
      const profitAmount = Math.round((distributableProfit * ratioPercent) / 100);
      return {
        memberId: m.memberId,
        nameBn: m.nameBn || m.name,
        name: m.name,
        shareDeposit: shareCap,
        downPayment: downCap,
        totalCapital: totalMemberCap,
        ratioPercent: Number(ratioPercent.toFixed(2)),
        profitAmount,
        closingWithDividend: totalMemberCap + profitAmount,
      };
    });

    return {
      totalCapital,
      reserveDeduction,
      distributableProfit,
      allocations,
    };
  }, [smartData.heatmap, members, totalProfitInput, reservePercentInput, distributionMode]);

  const handleSaveDividendRecord = async () => {
    try {
      const res = await fetch('/api/smart-features/dividends', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: divTitle,
          fiscalYear: divFiscalYear,
          totalProfit: totalProfitInput,
          reservePercent: reservePercentInput,
          distributionMode,
          allocations: dividendRows.allocations,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, dividends: data.dividends || [] }));
        showToast('লভ্যাংশ ও মুনাফা বণ্টন বিবরণী ডাটাবেজে সংরক্ষিত হয়েছে!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Meeting Resolution
  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title.trim()) return;
    try {
      const res = await fetch('/api/smart-features/meetings', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingNo: meetingForm.meetingNo,
          title: meetingForm.title,
          meetingDate: meetingForm.meetingDate,
          venue: meetingForm.venue,
          presidedBy: meetingForm.presidedBy,
          secretaryName: meetingForm.secretaryName,
          agenda: meetingForm.agenda,
          resolutions: meetingForm.resolutionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, meetings: data.meetings || [] }));
        setMeetingForm((prev) => ({ ...prev, title: '', agenda: '', resolutionsText: '' }));
        showToast('সভার রেজুলেশন ও কার্যবিবরণী সংরক্ষিত হয়েছে!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Poll & Vote
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [pollForm.option1, pollForm.option2, pollForm.option3].filter((o) => o.trim());
    if (!pollForm.title.trim() || opts.length < 2) return;
    try {
      const res = await fetch('/api/smart-features/polls', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pollForm.title,
          description: pollForm.description,
          deadline: pollForm.deadline,
          options: opts,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, polls: data.polls || [] }));
        setPollForm({ title: '', description: '', deadline: '2026-12-31', option1: '', option2: '', option3: '' });
        showToast('নতুন ডিজিটাল ভোটিং পোল তৈরি হয়েছে!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCastVote = async (pollId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/smart-features/polls/${encodeURIComponent(pollId)}/vote`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, memberId: currentMemberId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, polls: data.polls || [] }));
        showToast(`সদস্য #${currentMemberId} হিসেবে আপনার ভোট সফলভাবে গৃহীত হয়েছে!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Asset Valuation
  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.nameBn.trim()) return;
    try {
      const res = await fetch('/api/smart-features/assets', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(assetForm),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, assets: data.assets || [] }));
        setAssetForm({
          nameBn: '',
          location: 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা',
          purchaseYear: '2026',
          investedAmount: 0,
          currentMarketValue: 0,
          deedOrRefNo: '',
          notes: '',
        });
        showToast('জমি/প্রজেক্ট সম্পদের বাজারমূল্য আপডেট হয়েছে!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Target Fund Goal
  const handleSaveTargetFund = async () => {
    try {
      const res = await fetch('/api/smart-features/target-fund', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleBn: smartData.targetFund?.titleBn,
          targetAmount: targetAmountInput,
          deadline: '2026-12-31',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartData((prev: any) => ({ ...prev, targetFund: data.targetFund }));
        showToast('সমিতির তহবিল লক্ষ্যমাত্রা আপডেট হয়েছে!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 1-Click Full Cloud Database Backup Download
  const handleDownloadFullBackup = async () => {
    try {
      setDownloadingBackup(true);
      const res = await fetch('/api/backup/full', { headers: authHeaders });
      if (!res.ok) {
        showToast('ব্যাকআপ ডাউনলোড করতে সমস্যা হয়েছে');
        return;
      }
      const backupJson = await res.json();
      const blob = new Blob([JSON.stringify(backupJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hilful-Fuzul-Full-Cloud-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('সম্পূর্ণ ক্লাউড ডাটাবেজ ব্যাকআপ (JSON) সফলভাবে ডাউনলোড হয়েছে!');
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingBackup(false);
    }
  };

  const selectedCardMember = useMemo(() => {
    const list = smartData.heatmap?.length > 0 ? smartData.heatmap : members;
    return list.find((m: any) => m.memberId === selectedCardMemberId) || list[0];
  }, [smartData.heatmap, members, selectedCardMemberId]);

  const cardQrGrid = useMemo(() => {
    if (!selectedCardMember) return makeQrGrid('HF-DEFAULT');
    return makeQrGrid(
      `HF-CERT|${selectedCardMember.memberId}|${selectedCardMember.name}|${selectedCardMember.lifetimeShareDeposit}`
    );
  }, [selectedCardMember]);

  const pendingRequestCount = (smartData.paymentRequests || []).filter(
    (r: any) => r.status === 'PENDING'
  ).length;

  const totalCollectedSoFar = Number(kpis?.totalCollection || 2585430);
  const targetGoalAmount = Number(smartData.targetFund?.targetAmount || 3500000);
  const targetProgressPercent = Math.min(
    100,
    Math.round((totalCollectedSoFar / Math.max(1, targetGoalAmount)) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="overflow-hidden rounded-2xl border border-teal-500/30 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 p-6 text-white shadow-lg no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SocietyLogoAvatar logoUrl={branding.logoUrl || OFFICIAL_SOCIETY_LOGO_URL} size="md" />
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-teal-400/40 bg-teal-500/20 px-2.5 py-0.5 text-[11px] font-bold text-teal-300">
                <Sparkles className="h-3.5 w-3.5" />
                স্মার্ট সমবায় ডিজিটাল স্টুডিও (Next-Gen Cooperative Suite)
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-white">
                {branding.nameBn} — আধুনিক স্মার্ট ফিচার হাব
              </h1>
              <p className="text-xs text-teal-200/90">
                হোয়াটসঅ্যাপ ওয়ান-ক্লিক অ্যালার্ট · ১২×১২ পেমেন্ট হিটম্যাপ · বিকাশ/নগদ পেমেন্ট রিকোয়েস্ট · স্মার্ট আইডি ও শেয়ার সনদ · মুনাফা বণ্টন · রেজুলেশন ও ক্লাউড ব্যাকআপ
              </p>
            </div>
          </div>

          {/* Target Fund Mini Progress Widget */}
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xs min-w-[240px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-teal-200">তহবিল লক্ষ্যমাত্রা অগ্রগতি:</span>
              <span className="font-mono font-bold text-emerald-300">{targetProgressPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${targetProgressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-300">
              <span>আদায়: {formatBDT(totalCollectedSoFar)}</span>
              <span>লক্ষ্য: {formatBDT(targetGoalAmount)}</span>
            </div>
          </div>
        </div>

        {/* 6 Smart Sub-Module Navigation Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              id: 'HEATMAP_WHATSAPP' as SmartTabId,
              labelBn: '১. হিটম্যাপ ও WhatsApp',
              subBn: '১২×১২ গ্রিড ও বকেয়া মেসেজ',
              icon: Share2,
            },
            {
              id: 'ONLINE_PAYMENTS' as SmartTabId,
              labelBn: '২. বিকাশ/নগদ পেমেন্ট',
              subBn:
                pendingRequestCount > 0
                  ? `${pendingRequestCount}টি অপেক্ষমাণ (Pending)`
                  : 'অনলাইন জমা ও অনুমোদন',
              icon: CreditCard,
              badgeCount: pendingRequestCount,
            },
            {
              id: 'ID_CARD_CERTIFICATE' as SmartTabId,
              labelBn: '৩. আইডি ও শেয়ার সনদ',
              subBn: 'স্মার্ট কার্ড ও পাসবুক',
              icon: QrCode,
            },
            {
              id: 'DIVIDEND_CALCULATOR' as SmartTabId,
              labelBn: '৪. লভ্যাংশ ক্যালকুলেটর',
              subBn: 'শেয়ার অনুপাতে মুনাফা বণ্টন',
              icon: Calculator,
            },
            {
              id: 'MEETINGS_POLLS' as SmartTabId,
              labelBn: '৫. রেজুলেশন ও ভোটিং',
              subBn: 'সভার সিদ্ধান্ত ও সদস্য পোল',
              icon: Vote,
            },
            {
              id: 'ASSETS_BACKUP' as SmartTabId,
              labelBn: '৬. সম্পদ ও ব্যাকআপ',
              subBn: 'জমির মূল্যবৃদ্ধি ও ব্যাকআপ',
              icon: Database,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  active
                    ? 'border-teal-300 bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-md'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-teal-300'}`} />
                  {tab.badgeCount ? (
                    <span className="rounded-full bg-amber-400 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-slate-950">
                      {tab.badgeCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs font-bold leading-snug">{tab.labelBn}</p>
                <p className="text-[10px] opacity-80">{tab.subBn}</p>
              </button>
            );
          })}
        </div>
      </div>

      {toastMsg && (
        <div className="flex items-center justify-between rounded-xl border border-teal-500 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-900 shadow-sm dark:border-teal-700 dark:bg-teal-950/90 dark:text-teal-200 no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{toastMsg}</span>
          </div>
          <button type="button" onClick={() => setToastMsg('')} className="text-slate-500 hover:text-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
       * TAB 1: 12×12 PAYMENT HEATMAP, GOLD BADGES & 1-CLICK WHATSAPP ALERT
       * =================================================================== */}
      {activeTab === 'HEATMAP_WHATSAPP' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                ১২ জন সদস্য × ১২ মাসের পেমেন্ট হিটম্যাপ, গোল্ড মেম্বার ব্যাজ ও ওয়ান-ক্লিক WhatsApp রিমাইন্ডার
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                সবুজ (PAID) = পরিশোধিত · হলুদ (PARTIAL) = আংশিক · লাল (DUE) = বকেয়া · ১ ক্লিকে যেকোনো সদস্যকে হোয়াটসঅ্যাপে হিসাব ও তাগাদা পাঠান
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">অর্থবছর নির্বাচন:</span>
              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {YEARS_LIST.slice(0, 8).map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setHeatmapYear(yr)}
                    className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                      heatmapYear === yr
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 12x12 Heatmap Matrix Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">সদস্য ও সম্মাননা ব্যাজ</th>
                    {MONTHS_LIST.map((m) => (
                      <th key={m.num} className="px-2 py-3 text-center font-mono text-[11px] font-bold">
                        {m.en.slice(0, 3)}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right font-bold">মোট বকেয়া (১৯–২৬)</th>
                    <th className="px-4 py-3 text-right font-bold">WhatsApp / SMS অ্যালার্ট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {heatmapRows.map((row: any) => {
                    const waText = buildMemberWhatsAppMessage(row);
                    const waHref = getWhatsAppLink(row.mobile, waText);
                    return (
                      <tr key={row.memberId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-teal-500/40 bg-slate-100 dark:bg-slate-800">
                              {row.photoUrl ? (
                                <img src={row.photoUrl} alt={row.nameBn} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                                  #{row.memberId}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                                  #{row.memberId}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {row.nameBn || row.name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {row.totalOutstanding === 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
                                    <Award className="h-3 w-3 text-amber-600" />
                                    গোল্ড মেম্বার (০ বকেয়া)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                    বকেয়া তাগাদা প্রযোজ্য
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {(row.months || []).map((mo: any) => {
                          const cellClass =
                            mo.status === 'PAID'
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : mo.status === 'PARTIAL'
                              ? 'bg-amber-400 text-slate-950 border-amber-500'
                              : mo.status === 'DUE'
                              ? 'bg-rose-500/90 text-white border-rose-600'
                              : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
                          return (
                            <td key={mo.month} className="px-1.5 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => onOpenMemberLedger(row.memberId)}
                                title={`${row.nameBn} — ${mo.monthName} ${heatmapYear}: জমা ${formatBDT(
                                  mo.paidAmount
                                )} | বকেয়া ${formatBDT(mo.dueAmount)}`}
                                className={`mx-auto flex h-7 w-11 flex-col items-center justify-center rounded-md border font-mono text-[9px] font-bold transition-transform hover:scale-105 ${cellClass}`}
                              >
                                {mo.paidAmount > 0 ? (
                                  <span>{Math.round(mo.paidAmount / 100) / 10}k</span>
                                ) : mo.dueAmount > 0 ? (
                                  <span>বকেয়া</span>
                                ) : (
                                  <span>—</span>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
                          <span
                            className={
                              row.totalOutstanding > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {formatBDT(row.totalOutstanding)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs"
                              title="হোয়াটসঅ্যাপে ১ ক্লিকে বার্তা পাঠান"
                            >
                              <Share2 className="h-3 w-3" />
                              WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(waText);
                                setCopiedId(row.memberId);
                                setTimeout(() => setCopiedId(''), 2500);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              title="এসএমএস টেক্সট কপি করুন"
                            >
                              <Copy className="h-3 w-3" />
                              {copiedId === row.memberId ? 'কপি!' : 'SMS'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 2: ONLINE PAYMENT REQUEST (bKash / Nagad / Bank) & 1-CLICK APPROVAL
       * =================================================================== */}
      {activeTab === 'ONLINE_PAYMENTS' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Submit Online Payment Slip Form */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  অনলাইন কিস্তি জমা রিকোয়েস্ট (bKash / Nagad / Bank)
                </h3>
                <p className="text-xs text-slate-500">
                  সদস্যরা ঘরে বসেই বিকাশ/নগদ TrxID দিয়ে কিস্তি জমার তথ্য পাঠাতে পারবেন
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitPaymentRequest} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    সদস্য নির্বাচন (Member)
                  </label>
                  <select
                    value={payForm.memberId}
                    disabled={role === 'MEMBER'}
                    onChange={(e) => setPayForm({ ...payForm, memberId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {members.map((m: any) => (
                      <option key={m.memberId} value={m.memberId}>
                        #{m.memberId} — {m.nameBn || m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    পেমেন্ট মাধ্যম (Method)
                  </label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="bKash">বিকাশ (bKash)</option>
                    <option value="Nagad">নগদ (Nagad)</option>
                    <option value="Rocket">রকেট (Rocket)</option>
                    <option value="Bank Transfer">ব্যাংক ট্রান্সফার (Bank Deposit)</option>
                    <option value="Cash">নগদ ক্যাশ (Direct Cash)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    অর্থবছর (Year)
                  </label>
                  <select
                    value={payForm.year}
                    onChange={(e) => setPayForm({ ...payForm, year: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {YEARS_LIST.slice(0, 8).map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    মাস (Month)
                  </label>
                  <select
                    value={payForm.month}
                    onChange={(e) => setPayForm({ ...payForm, month: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {MONTHS_LIST.map((m) => (
                      <option key={m.num} value={m.num}>
                        {m.num}. {m.bn} ({m.en})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    শেয়ার আমানত (৳)
                  </label>
                  <input
                    type="number"
                    value={payForm.shareDeposit}
                    onChange={(e) => setPayForm({ ...payForm, shareDeposit: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    মাসিক প্রদেয় (৳)
                  </label>
                  <input
                    type="number"
                    value={payForm.payable}
                    onChange={(e) => setPayForm({ ...payForm, payable: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    ডাউন পেমেন্ট (৳)
                  </label>
                  <input
                    type="number"
                    value={payForm.downPayment}
                    onChange={(e) => setPayForm({ ...payForm, downPayment: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    ট্রানজেকশন আইডি (TrxID / স্লিপ নং) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: BKA84920X"
                    value={payForm.transactionId}
                    onChange={(e) => setPayForm({ ...payForm, transactionId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold uppercase dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    প্রেরকের মোবাইল নম্বর (Sender No)
                  </label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={payForm.senderNumber}
                    onChange={(e) => setPayForm({ ...payForm, senderNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  মন্তব্য বা নোট (Remarks)
                </label>
                <input
                  type="text"
                  placeholder="মাসিক কিস্তি পরিশোধ..."
                  value={payForm.remarks}
                  onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-teal-50 p-3 dark:bg-teal-950/50">
                <span className="font-semibold text-teal-900 dark:text-teal-200">মোট জমার পরিমাণ:</span>
                <span className="font-mono text-base font-extrabold text-teal-700 dark:text-teal-300">
                  {formatBDT(
                    Number(payForm.shareDeposit || 0) +
                      Number(payForm.payable || 0) +
                      Number(payForm.downPayment || 0)
                  )}
                </span>
              </div>

              <button
                type="submit"
                disabled={submittingPay}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submittingPay ? 'পাঠানো হচ্ছে...' : 'অনলাইন পেমেন্ট রিকোয়েস্ট সাবমিট করুন'}
              </button>
            </form>
          </div>

          {/* Right: Admin 1-Click Approval Queue & History */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  অনলাইন পেমেন্ট রিকোয়েস্ট ও ১-ক্লিক অনুমোদন তালিকা
                </h3>
                <p className="text-xs text-slate-500">
                  এডমিন &quot;Approve&quot; বাটনে ক্লিক করলেই স্বয়ংক্রিয়ভাবে লেজারে জমা হবে এবং মানি রশিদ তৈরি হবে
                </p>
              </div>
              <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                অপেক্ষমাণ: {pendingRequestCount}টি
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {(smartData.paymentRequests || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                  এখনো কোনো অনলাইন পেমেন্ট রিকোয়েস্ট জমা পড়েনি। বাম পাশের ফর্ম থেকে বিকাশ/নগদ পেমেন্ট রিকোয়েস্ট পাঠাতে পারেন।
                </div>
              ) : (
                (smartData.paymentRequests || [])
                  .filter((r: any) => role !== 'MEMBER' || r.memberId === currentMemberId)
                  .map((reqItem: any) => (
                    <div
                      key={reqItem.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-teal-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                            #{reqItem.memberId}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {reqItem.memberNameBn}
                          </span>
                          <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {reqItem.paymentMethod} · TrxID: {reqItem.transactionId}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              reqItem.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : reqItem.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {reqItem.status === 'APPROVED'
                              ? `অনুমোদিত (${reqItem.receiptNo || 'Posted'})`
                              : reqItem.status === 'REJECTED'
                              ? 'বাতিলকৃত'
                              : 'অপেক্ষমাণ (Pending)'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          মাস: <strong>{reqItem.monthName} {reqItem.year}</strong> · সর্বমোট:{' '}
                          <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                            {formatBDT(reqItem.totalAmount)}
                          </strong>{' '}
                          (শেয়ার: {formatBDT(reqItem.shareDeposit)}, প্রদেয়: {formatBDT(reqItem.payable)}
                          {reqItem.downPayment > 0 ? `, ডাউন পেমেন্ট: ${formatBDT(reqItem.downPayment)}` : ''})
                        </p>
                        <p className="text-[11px] text-slate-400">
                          তারিখ: {reqItem.paymentDate}{' '}
                          {reqItem.senderNumber ? `· প্রেরক নম্বর: ${reqItem.senderNumber}` : ''}{' '}
                          {reqItem.remarks ? `· নোট: ${reqItem.remarks}` : ''}
                        </p>
                      </div>

                      {isSuperOrAdmin && reqItem.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(reqItem.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            ১-ক্লিক অনুমোদন ও রশিদ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequest(reqItem.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                          >
                            <X className="h-3.5 w-3.5" />
                            বাতিল
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 3: SMART ID CARD, OFFICIAL SHARE CERTIFICATE & DIGITAL PASSBOOK
       * =================================================================== */}
      {activeTab === 'ID_CARD_CERTIFICATE' && selectedCardMember && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 no-print">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">সদস্য নির্বাচন:</span>
              <select
                value={selectedCardMemberId}
                disabled={role === 'MEMBER'}
                onChange={(e) => setSelectedCardMemberId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
              >
                {(smartData.heatmap?.length > 0 ? smartData.heatmap : members).map((m: any) => (
                  <option key={m.memberId} value={m.memberId}>
                    #{m.memberId} — {m.nameBn || m.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setDocMode('ID_CARD')}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    docMode === 'ID_CARD'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  স্মার্ট মেম্বার আইডি কার্ড
                </button>
                <button
                  type="button"
                  onClick={() => setDocMode('SHARE_CERTIFICATE')}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    docMode === 'SHARE_CERTIFICATE'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  অফিসিয়াল শেয়ার সনদপত্র
                </button>
                <button
                  type="button"
                  onClick={() => setDocMode('PASSBOOK')}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    docMode === 'PASSBOOK'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ডিজিটাল পাসবুক (২০১৯–২৬)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-emerald-600"
            >
              <Printer className="h-4 w-4" />
              প্রিন্ট / PDF ডাউনলোড করুন
            </button>
          </div>

          {/* MODE A: Printable Front & Back Smart Member ID Card */}
          {docMode === 'ID_CARD' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              {/* Front Side of Smart ID Card */}
              <div className="overflow-hidden rounded-2xl border-2 border-teal-600/50 bg-white shadow-xl dark:bg-slate-900">
                <div className="bg-gradient-to-r from-slate-950 via-teal-900 to-emerald-900 p-4 text-center text-white">
                  <div className="mx-auto mb-1.5 flex justify-center">
                    <SocietyLogoAvatar logoUrl={branding.logoUrl || OFFICIAL_SOCIETY_LOGO_URL} size="sm" />
                  </div>
                  <h3 className="text-base font-extrabold tracking-tight">{branding.nameBn}</h3>
                  <p className="text-[10px] text-teal-200">{branding.nameEn}</p>
                  <span className="mt-1 inline-block rounded-full bg-teal-400/20 px-2.5 py-0.5 text-[10px] font-bold text-teal-200 border border-teal-400/30">
                    দাপ্তরিক সদস্য পরিচয়পত্র · MEMBER IDENTITY CARD
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-teal-600 bg-slate-100 shadow-md">
                      {selectedCardMember.photoUrl ? (
                        <img
                          src={selectedCardMember.photoUrl}
                          alt={selectedCardMember.nameBn}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-mono text-2xl font-extrabold text-teal-700">
                          #{selectedCardMember.memberId}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <span className="inline-block rounded bg-teal-100 px-2 py-0.5 font-mono text-[11px] font-extrabold text-teal-900 dark:bg-teal-950 dark:text-teal-300">
                        ID NO: HF-MEM-{selectedCardMember.memberId}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {selectedCardMember.nameBn || selectedCardMember.name}
                      </h4>
                      <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                        {branding.committeeRoles?.[selectedCardMember.memberId] || 'সম্মানিত প্রতিষ্ঠাতা সদস্য'}
                      </p>
                      <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        মোবাইল: <strong>{selectedCardMember.mobile}</strong>
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        রক্তের গ্রুপ: <strong className="text-rose-600">{selectedCardMember.bloodGroup || 'O+'}</strong> · যোগদান: ২০১৯ ইং
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] dark:border-slate-800">
                    <div>
                      <p className="text-slate-500">মনোনীত নমিনি:</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedCardMember.nomineeName || 'সংরক্ষিত'} ({selectedCardMember.nomineeRelation || 'পরিবার'})
                      </p>
                    </div>
                    <div className="rounded border border-slate-300 bg-white p-1">
                      <svg width="42" height="42" viewBox="0 0 11 11">
                        {cardQrGrid.map((r, ri) =>
                          r.map((c, ci) =>
                            c ? <rect key={`${ri}-${ci}`} x={ci} y={ri} width={1} height={1} fill="#0f172a" /> : null
                          )
                        )}
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Back Side of Smart ID Card */}
              <div className="flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900 text-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
                    <span className="font-bold text-teal-800 dark:text-teal-300">
                      কার্ডের অপর পৃষ্ঠা (গুরুত্বপূর্ণ তথ্য ও শর্তাবলী)
                    </span>
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      ESTD: 2019
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    এই কার্ডটি <strong>{branding.nameBn}</strong>-এর একজন নিবন্ধিত ও সম্মানিত শেয়ারহোল্ডার সদস্যের দাপ্তরিক পরিচয়পত্র।
                  </p>
                  <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-[11px] dark:bg-slate-950">
                    <p>
                      <strong>কার্যালয়:</strong> {branding.addressBn}
                    </p>
                    <p>
                      <strong>হেল্পলাইন:</strong> {branding.phone}
                    </p>
                    <p>
                      <strong>ইমেইল:</strong> {branding.email}
                    </p>
                    <p>
                      <strong>জাতীয় পরিচয়পত্র (NID):</strong> {selectedCardMember.nidNumber || 'যাচাইকৃত'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-4 text-[11px] dark:border-slate-800">
                  <div className="text-center">
                    <div className="mb-1 h-px w-28 bg-slate-400" />
                    <p className="font-bold">সাধারণ সম্পাদক</p>
                  </div>
                  <div className="text-center">
                    <div className="mb-1 h-px w-28 bg-slate-400" />
                    <p className="font-bold">সভাপতি</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE B: Official Share Certificate */}
          {docMode === 'SHARE_CERTIFICATE' && (
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-4 border-double border-teal-700 bg-white p-8 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-teal-700/40 pb-6">
                <div className="flex items-center gap-4">
                  <SocietyLogoAvatar logoUrl={branding.logoUrl || OFFICIAL_SOCIETY_LOGO_URL} size="lg" />
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-teal-900 dark:text-teal-300">
                      {branding.nameBn}
                    </h2>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {branding.nameEn} · স্থাপিত: ২০১৯ ইং
                    </p>
                    <p className="text-xs text-slate-500">{branding.addressBn}</p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="inline-block rounded-lg bg-teal-900 px-3 py-1 font-bold text-amber-300">
                    SHARE CERTIFICATE
                  </span>
                  <p className="mt-1 font-bold">সনদ নং: HF-SH-2019-{selectedCardMember.memberId}</p>
                  <p className="text-slate-500">ইস্যু তারিখ: {new Date().toISOString().slice(0, 10)}</p>
                </div>
              </div>

              <div className="my-6 text-center">
                <h3 className="inline-block rounded-xl border border-amber-500/50 bg-amber-50/80 px-6 py-2 text-lg font-extrabold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  সম্মানিত শেয়ার হোল্ডার ও মূলধন আমানত সনদপত্র
                </h3>
              </div>

              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                এই মর্মে প্রত্যয়ন করা যাইতেছে যে, জনাব{' '}
                <strong className="text-base text-teal-800 dark:text-teal-300">
                  {selectedCardMember.nameBn || selectedCardMember.name}
                </strong>{' '}
                (সদস্য আইডি: <strong className="font-mono">#{selectedCardMember.memberId}</strong>, পদবী:{' '}
                <strong>
                  {branding.committeeRoles?.[selectedCardMember.memberId] || 'সম্মানিত প্রতিষ্ঠাতা সদস্য'}
                </strong>
                ), <strong>{branding.nameBn}</strong>-এর একজন নিবন্ধিত ও পূর্ণাঙ্গ শেয়ারহোল্ডার সদস্য। ২০১৯ ইং থেকে ২০২৬ ইং পর্যন্ত সমিতির কেন্দ্রীয় লেজার অনুযায়ী তাঁহার জমাকৃত মূলধন ও আমানতের বিবরণ নিম্নরূপ:
              </p>

              <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-center dark:border-teal-900 dark:bg-teal-950/40">
                  <p className="text-xs text-slate-500">মোট শেয়ার আমানত</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-teal-800 dark:text-teal-300">
                    {formatBDT(selectedCardMember.lifetimeShareDeposit || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                  <p className="text-xs text-slate-500">ডাউন পেমেন্ট জমা</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-emerald-800 dark:text-emerald-300">
                    {formatBDT(selectedCardMember.lifetimeDownPayment || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-500">সর্বমোট জমা (২০১৯–২৬)</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-slate-900 dark:text-white">
                    {formatBDT(selectedCardMember.lifetimeTotalReceived || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-center dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="text-xs text-slate-500">মালিকানা অনুপাত</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-amber-800 dark:text-amber-300">
                    ১/১২ অংশ (৮.৩৩%)
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-t border-slate-200 pt-6 text-xs dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-slate-300 bg-white p-1.5">
                    <svg width="56" height="56" viewBox="0 0 11 11">
                      {cardQrGrid.map((r, ri) =>
                        r.map((c, ci) =>
                          c ? <rect key={`${ri}-${ci}`} x={ci} y={ri} width={1} height={1} fill="#0f172a" /> : null
                        )
                      )}
                    </svg>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <p className="font-bold text-slate-800 dark:text-slate-200">ডিজিটাল কিউআর ভেরিফাইড সনদ</p>
                    <p>নমিনি: {selectedCardMember.nomineeName || 'সংরক্ষিত'} (১০০%)</p>
                    <p className="font-mono">Ref: HF-SH-2019-{selectedCardMember.memberId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="text-center">
                    <div className="mb-1 h-px w-32 bg-slate-400" />
                    <p className="font-bold">কোষাধ্যক্ষ (Treasurer)</p>
                  </div>
                  <div className="text-center">
                    <div className="mb-1 h-px w-32 bg-slate-400" />
                    <p className="font-bold">সাধারণ সম্পাদক</p>
                  </div>
                  <div className="text-center">
                    <div className="mb-1 h-px w-32 bg-slate-400" />
                    <p className="font-bold">সভাপতি (President)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE C: Printable Member Digital Passbook */}
          {docMode === 'PASSBOOK' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    ডিজিটাল সদস্য পাসবুক — {selectedCardMember.nameBn || selectedCardMember.name} (#{selectedCardMember.memberId})
                  </h3>
                  <p className="text-xs text-slate-500">
                    অর্থবছর {heatmapYear}-এর ১২ মাসের মাসিক কিস্তি ও রশিদ বিবরণী
                  </p>
                </div>
                <span className="rounded-lg bg-teal-50 px-3 py-1.5 font-mono text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  সর্বমোট জমা (১৯–২৬): {formatBDT(selectedCardMember.lifetimeTotalReceived || 0)}
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2.5">মাস ({heatmapYear})</th>
                      <th className="px-3 py-2.5 text-right">শেয়ার আমানত</th>
                      <th className="px-3 py-2.5 text-right">মাসিক প্রদেয়</th>
                      <th className="px-3 py-2.5 text-right">ডাউন পেমেন্ট</th>
                      <th className="px-3 py-2.5 text-right">মোট জমা</th>
                      <th className="px-3 py-2.5 text-right">বকেয়া</th>
                      <th className="px-3 py-2.5">রশিদ নং ও তারিখ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(selectedCardMember.months || []).map((mo: any) => (
                      <tr key={mo.month}>
                        <td className="px-3 py-2 font-semibold">
                          {mo.month}. {mo.monthName}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatBDT(mo.shareDeposit)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatBDT(mo.payable)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatBDT(mo.downPayment)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {formatBDT(mo.paidAmount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-amber-600">
                          {formatBDT(mo.dueAmount)}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {mo.receiptNo ? `${mo.receiptNo} (${mo.paymentDate})` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
       * TAB 4: ANNUAL PROFIT & DIVIDEND DISTRIBUTION CALCULATOR
       * =================================================================== */}
      {activeTab === 'DIVIDEND_CALCULATOR' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  বার্ষিক লভ্যাংশ ও মুনাফা বণ্টন ক্যালকুলেটর (Shariah-Compliant Profit Distribution Studio)
                </h2>
                <p className="text-xs text-slate-500">
                  সমিতির প্রজেক্ট বা বিনিয়োগ থেকে অর্জিত মুনাফা ১২ জন সদস্যের জমাকৃত মূলধন অনুপাতে বা সমান হারে স্বয়ংক্রিয়ভাবে হিসাব করুন
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                {isSuperOrAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveDividendRecord}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    বণ্টন বিবরণী সংরক্ষণ করুন
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  প্রিন্ট করুন
                </button>
              </div>
            </div>

            {/* Calculator Controls */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4 text-xs no-print">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  বণ্টন বিবরণীর শিরোনাম
                </label>
                <input
                  type="text"
                  value={divTitle}
                  onChange={(e) => setDivTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  অর্জিত মোট নিট মুনাফা (Total Profit ৳)
                </label>
                <input
                  type="number"
                  value={totalProfitInput}
                  onChange={(e) => setTotalProfitInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  কল্যাণ/রিজার্ভ তহবিল কর্তন (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={reservePercentInput}
                  onChange={(e) => setReservePercentInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  মুনাফা বণ্টন পদ্ধতি (Method)
                </label>
                <select
                  value={distributionMode}
                  onChange={(e) =>
                    setDistributionMode(e.target.value as 'CAPITAL_RATIO' | 'EQUAL_SHARE')
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="CAPITAL_RATIO">জমাকৃত মূলধন অনুপাতে (Capital Ratio)</option>
                  <option value="EQUAL_SHARE">সমান ১২ ভাগে (Equal 12 Shares)</option>
                </select>
              </div>
            </div>

            {/* Summary Strip */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[11px] text-slate-500">১২ সদস্যের মোট মূলধন (শেয়ার+ডাউন)</p>
                <p className="mt-0.5 font-mono text-base font-extrabold text-slate-900 dark:text-white">
                  {formatBDT(dividendRows.totalCapital)}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">ঘোষিত মোট মুনাফা</p>
                <p className="mt-0.5 font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  {formatBDT(totalProfitInput)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  রিজার্ভ তহবিল সংরক্ষণ ({reservePercentInput}%)
                </p>
                <p className="mt-0.5 font-mono text-base font-extrabold text-amber-700 dark:text-amber-400">
                  {formatBDT(dividendRows.reserveDeduction)}
                </p>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 dark:border-teal-900/50 dark:bg-teal-950/30">
                <p className="text-[11px] text-teal-800 dark:text-teal-300">বণ্টনযোগ্য নিট লভ্যাংশ</p>
                <p className="mt-0.5 font-mono text-base font-extrabold text-teal-700 dark:text-teal-300">
                  {formatBDT(dividendRows.distributableProfit)}
                </p>
              </div>
            </div>

            {/* 12 Members Dividend Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-3">আইডি</th>
                    <th className="px-3 py-3">সদস্যের নাম</th>
                    <th className="px-3 py-3 text-right">শেয়ার আমানত</th>
                    <th className="px-3 py-3 text-right">ডাউন পেমেন্ট</th>
                    <th className="px-3 py-3 text-right">মোট মূলধন</th>
                    <th className="px-3 py-3 text-right">অংশীদারিত্ব (%)</th>
                    <th className="px-3 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      প্রাপ্ত লভ্যাংশ (Dividend)
                    </th>
                    <th className="px-3 py-3 text-right font-bold">লভ্যাংশসহ মোট তহবিল</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dividendRows.allocations.map((row: any) => (
                    <tr key={row.memberId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                        #{row.memberId}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                        {row.nameBn}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatBDT(row.shareDeposit)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatBDT(row.downPayment)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">
                        {formatBDT(row.totalCapital)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{row.ratioPercent}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        +{formatBDT(row.profitAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatBDT(row.closingWithDividend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 5: MEETING RESOLUTIONS BOOK & DIGITAL MEMBER VOTING POLLS
       * =================================================================== */}
      {activeTab === 'MEETINGS_POLLS' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 Cols: Meeting Minutes & Resolutions Book */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    সভার কার্যবিবরণী ও রেজুলেশন বই (Official Meeting Resolutions)
                  </h3>
                  <p className="text-xs text-slate-500">
                    সমিতির সাধারণ ও কার্যনির্বাহী সভার গৃহীত সিদ্ধান্তসমূহ স্থায়ীভাবে সংরক্ষণ ও প্রিন্ট করুন
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 no-print"
                >
                  <Printer className="h-3.5 w-3.5" />
                  রেজুলেশন প্রিন্ট
                </button>
              </div>

              {isSuperOrAdmin && (
                <form onSubmit={handleSaveMeeting} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-950 no-print">
                  <p className="font-bold text-teal-800 dark:text-teal-300">
                    + নতুন সভার কার্যবিবরণী (Resolution) যুক্ত করুন
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="সভার নম্বর (যেমন: সাধারণ সভা — ০২/২০২৬)"
                      value={meetingForm.meetingNo}
                      onChange={(e) => setMeetingForm({ ...meetingForm, meetingNo: e.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <input
                      type="date"
                      value={meetingForm.meetingDate}
                      onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="সভার মূল শিরোনাম / আলোচ্য বিষয় *"
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-900"
                  />
                  <textarea
                    rows={3}
                    placeholder="গৃহীত সিদ্ধান্তসমূহ (প্রতি লাইনে একটি করে সিদ্ধান্ত লিখুন)..."
                    value={meetingForm.resolutionsText}
                    onChange={(e) => setMeetingForm({ ...meetingForm, resolutionsText: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700"
                  >
                    <Plus className="h-4 w-4" />
                    রেজুলেশন বইয়ে সংরক্ষণ করুন
                  </button>
                </form>
              )}

              <div className="mt-4 space-y-4">
                {(smartData.meetings || []).map((mtg: any) => (
                  <div
                    key={mtg.id}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md bg-teal-100 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-300">
                        {mtg.meetingNo} · তারিখ: {mtg.meetingDate}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        উপস্থিত সদস্য: {(mtg.attendees || []).length} জন
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                      {mtg.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      সভাপতিত্ব: {mtg.presidedBy} · স্থান: {mtg.venue}
                    </p>
                    <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
                      <p className="font-bold text-slate-700 dark:text-slate-300">গৃহীত সিদ্ধান্তসমূহ:</p>
                      <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                        {(mtg.resolutions || []).map((resLine: string, idx: number) => (
                          <li key={idx}>{resLine}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Interactive Member Voting Polls */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ডিজিটাল ভোটিং ও মতামত পোল (Member Decision Polling)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                সমিতির বিনিয়োগ বা গুরুত্বপূর্ণ সিদ্ধান্তে ১২ জন সদস্য সরাসরি অনলাইনে ভোট দিতে পারবেন
              </p>

              {isSuperOrAdmin && (
                <form onSubmit={handleCreatePoll} className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-950 no-print">
                  <p className="font-bold text-teal-800 dark:text-teal-300">+ নতুন ভোটিং পোল চালু করুন</p>
                  <input
                    type="text"
                    required
                    placeholder="পোলের প্রশ্ন লিখুন *"
                    value={pollForm.title}
                    onChange={(e) => setPollForm({ ...pollForm, title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    required
                    placeholder="অপশন ১ (যেমন: সাভারে জমি ক্রয়)"
                    value={pollForm.option1}
                    onChange={(e) => setPollForm({ ...pollForm, option1: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    required
                    placeholder="অপশন ২ (যেমন: হালাল অ্যাগ্রো প্রজেক্ট)"
                    value={pollForm.option2}
                    onChange={(e) => setPollForm({ ...pollForm, option2: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="অপশন ৩ (ঐচ্ছিক)"
                    value={pollForm.option3}
                    onChange={(e) => setPollForm({ ...pollForm, option3: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white hover:bg-emerald-700"
                  >
                    ভোটিং পোল প্রকাশ করুন
                  </button>
                </form>
              )}

              <div className="mt-4 space-y-4">
                {(smartData.polls || []).map((poll: any) => {
                  const totalVotes = (poll.options || []).reduce(
                    (acc: number, o: any) => acc + (o.votes?.length || 0),
                    0
                  );
                  return (
                    <div
                      key={poll.id}
                      className="rounded-xl border border-teal-500/30 bg-teal-50/30 p-4 dark:bg-teal-950/20"
                    >
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{poll.title}</h4>
                      {poll.description && (
                        <p className="mt-1 text-xs text-slate-500">{poll.description}</p>
                      )}
                      <div className="mt-3 space-y-2.5">
                        {(poll.options || []).map((opt: any) => {
                          const vCount = opt.votes?.length || 0;
                          const pct = totalVotes > 0 ? Math.round((vCount / totalVotes) * 100) : 0;
                          const votedByMe = (opt.votes || []).includes(currentMemberId);
                          return (
                            <div
                              key={opt.id}
                              className={`rounded-xl border p-3 transition-all ${
                                votedByMe
                                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60'
                                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {opt.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCastVote(poll.id, opt.id)}
                                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                    votedByMe
                                      ? 'bg-teal-600 text-white'
                                      : 'border border-teal-600 text-teal-700 hover:bg-teal-50 dark:text-teal-300'
                                  }`}
                                >
                                  {votedByMe ? '✓ আপনার ভোট' : 'ভোট দিন'}
                                </button>
                              </div>
                              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-teal-600"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                                <span>
                                  ভোট দিয়েছেন: {vCount} জন{' '}
                                  {vCount > 0 ? `(আইডি: #${opt.votes.join(', #')})` : ''}
                                </span>
                                <span className="font-mono font-bold">{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 6: LAND/PROJECT ASSET TRACKER, TARGET FUND & 1-CLICK CLOUD BACKUP
       * =================================================================== */}
      {activeTab === 'ASSETS_BACKUP' && (
        <div className="space-y-6">
          {/* Top Row: 1-Click Cloud Backup Vault & Target Fund Goal Setting */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1-Click Full Database Backup Card */}
            <div className="rounded-2xl border border-teal-500/40 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-6 text-white shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    ১০০% ডাটা নিরাপত্তা ও অফলাইন আর্কাইভ
                  </span>
                  <h3 className="mt-2 text-lg font-bold">
                    ওয়ান-ক্লিক সম্পূর্ণ ক্লাউড ডাটাবেজ ব্যাকআপ (Full JSON Backup)
                  </h3>
                  <p className="mt-1 text-xs text-teal-100/80 leading-relaxed">
                    ২০১৯ থেকে ২০২৬ পর্যন্ত ১২ জন সদস্যের সকল প্রোফাইল, ছবি, ৯৬২+ ট্রানজেকশন, রশিদ, ডাউন পেমেন্ট এবং খরচের সম্পূর্ণ ডাটাবেজ এক ক্লিকে আপনার মোবাইল বা কম্পিউটারে ডাউনলোড করে রাখুন।
                  </p>
                </div>
                <Database className="h-10 w-10 shrink-0 text-teal-300" />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {isSuperOrAdmin ? (
                  <button
                    type="button"
                    onClick={handleDownloadFullBackup}
                    disabled={downloadingBackup}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-md hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {downloadingBackup
                      ? 'ব্যাকআপ তৈরি হচ্ছে...'
                      : 'সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড করুন (.JSON)'}
                  </button>
                ) : (
                  <span className="text-xs text-teal-200">
                    শুধুমাত্র সুপার এডমিন ও এডমিন সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড করতে পারবেন।
                  </span>
                )}
              </div>
            </div>

            {/* Target Fund Progress Goal Setting */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                সমিতির তহবিল লক্ষ্যমাত্রা মিটার (Target Capital Progress Meter)
              </h3>
              <p className="text-xs text-slate-500">
                সমিতির মোট আদায় বনাম নির্ধারিত মূলধন লক্ষ্যমাত্রার ভিজ্যুয়াল অগ্রগতি
              </p>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>বর্তমান মোট আদায়: {formatBDT(totalCollectedSoFar)}</span>
                  <span className="text-teal-600">{targetProgressPercent}% সম্পন্ন</span>
                </div>
                <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all duration-500"
                    style={{ width: `${targetProgressPercent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  লক্ষ্যমাত্রা পূরণে অবশিষ্ট: {formatBDT(Math.max(0, targetGoalAmount - totalCollectedSoFar))}
                </p>
              </div>

              {isSuperOrAdmin && (
                <div className="mt-4 flex items-end gap-3 text-xs">
                  <div className="flex-1">
                    <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                      নতুন তহবিল লক্ষ্যমাত্রা নির্ধারণ করুন (৳)
                    </label>
                    <input
                      type="number"
                      value={targetAmountInput}
                      onChange={(e) => setTargetAmountInput(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTargetFund}
                    className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700"
                  >
                    লক্ষ্যমাত্রা আপডেট
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Land & Project Asset Market Valuation Growth Tracker */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  জমি ও প্রজেক্ট সম্পদ মূল্যবৃদ্ধি ট্র্যাকার (Land & Asset Valuation Growth Tracker)
                </h3>
                <p className="text-xs text-slate-500">
                  সমিতির ক্রয়কৃত জমি বা প্রজেক্টের ক্রয়মূল্য বনাম বর্তমান বাজারমূল্য এবং প্রতি সদস্যের সম্পদের প্রবৃদ্ধি হিসাব
                </p>
              </div>
            </div>

            {isSuperOrAdmin && (
              <form onSubmit={handleSaveAsset} className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-5 dark:bg-slate-950 no-print">
                <input
                  type="text"
                  required
                  placeholder="সম্পদ বা প্রজেক্টের নাম *"
                  value={assetForm.nameBn}
                  onChange={(e) => setAssetForm({ ...assetForm, nameBn: e.target.value })}
                  className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="number"
                  placeholder="বিনিয়োগকৃত ক্রয়মূল্য (৳)"
                  value={assetForm.investedAmount || ''}
                  onChange={(e) => setAssetForm({ ...assetForm, investedAmount: Number(e.target.value) })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="number"
                  placeholder="বর্তমান বাজারমূল্য (৳)"
                  value={assetForm.currentMarketValue || ''}
                  onChange={(e) => setAssetForm({ ...assetForm, currentMarketValue: Number(e.target.value) })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700"
                >
                  + সম্পদ যুক্ত করুন
                </button>
              </form>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4">
              {(smartData.assets || []).map((ast: any) => {
                const gain = Number(ast.currentMarketValue || 0) - Number(ast.investedAmount || 0);
                const gainPct =
                  Number(ast.investedAmount) > 0
                    ? ((gain / Number(ast.investedAmount)) * 100).toFixed(1)
                    : '0';
                const perMemberValue = Math.round(Number(ast.currentMarketValue || 0) / 12);
                return (
                  <div
                    key={ast.id}
                    className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="rounded bg-teal-100 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-300">
                          {ast.deedOrRefNo || 'HF-ASSET'} · ক্রয়কাল: {ast.purchaseYear}
                        </span>
                        <h4 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {ast.nameBn}
                        </h4>
                        <p className="text-xs text-slate-500">অবস্থান: {ast.location}</p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right dark:bg-emerald-950/50">
                        <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                          মূল্যবৃদ্ধি (Appreciation): +{gainPct}%
                        </span>
                        <p className="font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                          +{formatBDT(gain)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                        <span className="text-slate-500">বিনিয়োগকৃত ক্রয়মূল্য:</span>
                        <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {formatBDT(ast.investedAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-teal-50/70 p-3 dark:bg-teal-950/40">
                        <span className="text-teal-800 dark:text-teal-300">বর্তমান আনুমানিক বাজারমূল্য:</span>
                        <p className="mt-0.5 font-mono text-sm font-extrabold text-teal-700 dark:text-teal-300">
                          {formatBDT(ast.currentMarketValue)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-amber-50/70 p-3 dark:bg-amber-950/40">
                        <span className="text-amber-900 dark:text-amber-300">
                          প্রতি সদস্যের অংশের বর্তমান মূল্য (১/১২):
                        </span>
                        <p className="mt-0.5 font-mono text-sm font-extrabold text-amber-800 dark:text-amber-300">
                          {formatBDT(perMemberValue)}
                        </p>
                      </div>
                    </div>
                    {ast.notes && <p className="mt-2.5 text-xs text-slate-500">{ast.notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
