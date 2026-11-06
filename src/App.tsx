import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch as fetch } from './lib/netlifyStaticEngine.ts';
import {
  Home,
  LayoutDashboard,
  Users,
  CalendarRange,
  FileSpreadsheet,
  CreditCard,
  TrendingUp,
  Landmark,
  BookOpen,
  Receipt,
  Shield,
  ShieldCheck,
  Award,
  Camera,
  CheckCircle2,
  Lock,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Printer,
  Download,
  UserCheck,
  Menu,
  X,
  ChevronRight,
  Edit3,
  RotateCcw,
  Sparkles,
  QrCode,
  Share2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatBDT, YEARS_LIST, compressImageFile } from './lib/utils.ts';
import { exportReportData } from './lib/exportUtils.ts';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { YearlyAccountingView } from './components/YearlyAccountingView.tsx';
import { ExcelMigrationView } from './components/ExcelMigrationView.tsx';
import { ReportsAndLedgerView } from './components/ReportsAndLedgerView.tsx';
import {
  SocietyHomePage,
  SocietyLogoAvatar,
  SocietyBranding,
  SocietyNotice,
  SocietyMemberComment,
  SocietyProgramPhoto,
  SocietyProjectItem,
} from './components/SocietyHomePage.tsx';
import {
  MemberManagementSection,
  DownPaymentSection,
  IncomeExpenseSection,
  LoanInvestmentSection,
  AuditSecuritySection,
} from './components/OperationsModulesView.tsx';
import { MemberProfileModal } from './components/MemberProfileModal.tsx';
import { LoginSecurityModal } from './components/LoginSecurityModal.tsx';
import { UniqueLoginScreen } from './components/UniqueLoginScreen.tsx';
import { UserManagementStudio } from './components/UserManagementStudio.tsx';
import { SmartFeaturesHub, SmartTabId } from './components/SmartFeaturesHub.tsx';
import { OFFICIAL_SOCIETY_LOGO_URL } from './lib/officialLogo.ts';

type NavModule =
  | 'HOME'
  | 'DASHBOARD'
  | 'SMART_HUB'
  | 'MEMBER_PORTAL'
  | 'MEMBERS'
  | 'YEARLY_ACCOUNTING'
  | 'EXCEL_IMPORT'
  | 'DOWN_PAYMENTS'
  | 'INCOME_EXPENSE'
  | 'LOANS_INVESTMENTS'
  | 'ACCOUNTING_REPORTS'
  | 'RECEIPTS'
  | 'AUDIT_SECURITY'
  | 'USER_MANAGEMENT';

const FALLBACK_BRANDING: SocietyBranding = {
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
  committeeRoles: {
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
  },
  rules: [
    'প্রতি মাসের ১ থেকে ১০ তারিখের মধ্যে নির্ধারিত মাসিক শেয়ার আমানত (৳২,০০০) ও প্রদেয় (৳৫০) সর্বমোট ৳২,০৫০ টাকা পরিশোধ করতে হবে।',
    'প্রতিটি অর্থ জমার বিপরীতে সফটওয়্যার থেকে স্বয়ংক্রিয়ভাবে অফিসিয়াল মানি রশিদ (Receipt No সহ) ইস্যু করা হয়।',
    'সমিতির সকল মূলধন, ডাউন পেমেন্ট এবং আয়-ব্যয়ের হিসাব ডাবল-এন্ট্রি লেজার পদ্ধতিতে সংরক্ষিত থাকে যা যেকোনো সদস্য নিজস্ব পোর্টাল থেকে দেখতে পারবেন।',
    'বিনিয়োগ ও কল্যাণ তহবিলের যেকোনো বড় সিদ্ধান্ত কার্যনির্বাহী কমিটি ও সাধারণ সভার অনুমোদনক্রমে গৃহীত হবে।',
    'বার্ষিক হিসাব সমাপনীতে অডিট রিপোর্ট ও সদস্যভিত্তিক চূড়ান্ত বিবরণী প্রকাশ করা হবে।',
  ],
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [idToken] = useState<string>('demo-session-token');
  const [activeRole, setActiveRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'>(() => {
    try {
      const meta = localStorage.getItem('hf_society_session_meta_v1');
      if (meta) {
        const parsed = JSON.parse(meta);
        if (['SUPER_ADMIN', 'ADMIN', 'MEMBER'].includes(parsed.activeRole)) {
          return parsed.activeRole;
        }
      }
      const savedUser = localStorage.getItem('hf_auth_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (['SUPER_ADMIN', 'ADMIN', 'MEMBER'].includes(parsedUser.role)) {
          return parsedUser.role;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 'SUPER_ADMIN';
  });
  const [activeMemberId, setActiveMemberId] = useState<string>(() => {
    try {
      const meta = localStorage.getItem('hf_society_session_meta_v1');
      if (meta) {
        const parsed = JSON.parse(meta);
        if (parsed.activeMemberId) return String(parsed.activeMemberId);
      }
      const savedUser = localStorage.getItem('hf_auth_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.memberId) return String(parsedUser.memberId);
      }
    } catch {
      // ignore storage errors
    }
    return '09';
  });
  const [activeModule, setActiveModule] = useState<NavModule>('HOME');
  const [smartHubInitialTab, setSmartHubInitialTab] = useState<SmartTabId>('HEATMAP_WHATSAPP');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Filter states for Dashboard
  const [dashboardYear, setDashboardYear] = useState<number>(0); // 0 = All years (2019–2026)
  const [dashboardMemberFilter, setDashboardMemberFilter] = useState<string>('');

  // Server data states
  const [bootstrapData, setBootstrapData] = useState<any>(null);
  const [societyHomeData, setSocietyHomeData] = useState<{
    branding: SocietyBranding;
    notices: SocietyNotice[];
    memberComments: SocietyMemberComment[];
    programsGallery: SocietyProgramPhoto[];
    projectsGallery: SocietyProjectItem[];
  }>({
    branding: FALLBACK_BRANDING,
    notices: [],
    memberComments: [],
    programsGallery: [],
    projectsGallery: [],
  });
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [membersData, setMembersData] = useState<any[]>([]);
  const [downPaymentsData, setDownPaymentsData] = useState<any>(null);
  const [incomeExpenseData, setIncomeExpenseData] = useState<any>(null);
  const [loansInvestmentsData, setLoansInvestmentsData] = useState<any>(null);
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [selectedProfileMember, setSelectedProfileMember] = useState<any | null>(null);
  const [profileModalEditMode, setProfileModalEditMode] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<string>(() => {
    try {
      const meta = localStorage.getItem('hf_society_session_meta_v1');
      if (meta) {
        const parsed = JSON.parse(meta);
        if (parsed.sessionToken) return String(parsed.sessionToken);
      }
      const saved = localStorage.getItem('hf_society_session_v1');
      if (saved && !saved.startsWith('{')) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return '';
  });
  const [portalPhotoNotice, setPortalPhotoNotice] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('hf_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('hf_explicit_logout') !== 'true';
    } catch {
      return true;
    }
  });

  const handleLogout = () => {
    try {
      sessionStorage.setItem('hf_explicit_logout', 'true');
    } catch {
      // ignore
    }
    localStorage.removeItem('hf_auth_user');
    localStorage.removeItem('hf_society_session_v1');
    localStorage.removeItem('hf_society_session_meta_v1');
    localStorage.removeItem('hf_society_role');
    localStorage.removeItem('hf_society_member_id');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSessionToken('');
    setActiveRole('SUPER_ADMIN');
    setActiveMemberId('09');
    setActiveModule('HOME');
  };
  const [uploadingPortalPhoto, setUploadingPortalPhoto] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('bn-BD'));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const portalMemberPhotoRef = useRef<HTMLInputElement | null>(null);
  const portalNomineePhotoRef = useRef<HTMLInputElement | null>(null);
  const loadSeqRef = useRef<number>(0);
  const mutationPauseUntilRef = useRef<number>(0);

  // Pause background auto-sync whenever a native OS file picker is opened or a file is selected
  useEffect(() => {
    const pauseForFilePicker = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file') {
        mutationPauseUntilRef.current = Date.now() + 10000;
        loadSeqRef.current += 1; // Invalidate any in-flight background poll
      }
    };
    window.addEventListener('click', pauseForFilePicker, true);
    window.addEventListener('change', pauseForFilePicker, true);
    return () => {
      window.removeEventListener('click', pauseForFilePicker, true);
      window.removeEventListener('change', pauseForFilePicker, true);
    };
  }, []);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${idToken}`,
      'x-society-role': activeRole,
      'x-society-member-id': activeMemberId,
      ...(sessionToken ? { 'x-society-session-token': sessionToken } : {}),
    }),
    [idToken, activeRole, activeMemberId, sessionToken]
  );

  const loadSocietyHomeOnly = useCallback(async () => {
    try {
      mutationPauseUntilRef.current = Date.now() + 4000;
      const ts = Date.now();
      const homeRes = await fetch(`/api/society-home?_t=${ts}`, {
        headers: authHeaders,
        cache: 'no-store',
      });
      if (homeRes.ok) {
        const hJson = await homeRes.json();
        setSocietyHomeData({
          branding: hJson.branding || FALLBACK_BRANDING,
          notices: hJson.notices || [],
          memberComments: hJson.memberComments || [],
          programsGallery: hJson.programsGallery || [],
          projectsGallery: hJson.projectsGallery || [],
        });
      }
    } catch (err) {
      console.error('Error loading society home data:', err);
    }
  }, [authHeaders]);

  const isFetchingAllRef = useRef<boolean>(false);

  const loadAllData = useCallback(
    async (silent = false, forceAfterMutation = false) => {
      if (silent && !forceAfterMutation && Date.now() < mutationPauseUntilRef.current) {
        return;
      }
      // Prevent background polls from stacking if a previous loadAllData is still in flight
      if (silent && !forceAfterMutation && isFetchingAllRef.current) {
        return;
      }
      isFetchingAllRef.current = true;
      const mySeq = ++loadSeqRef.current;
      if (!silent) setLoading(true);
      const ts = Date.now();
      try {
        const [bootRes, homeRes, dashRes, memRes, dpRes, ieRes, liRes, rcpRes] =
          await Promise.all([
            fetch(`/api/bootstrap?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
            fetch(`/api/society-home?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
            fetch(
              `/api/dashboard?year=${dashboardYear}&memberId=${encodeURIComponent(
                activeRole === 'MEMBER' ? activeMemberId : dashboardMemberFilter
              )}&_t=${ts}`,
              { headers: authHeaders, cache: 'no-store' }
            ),
            fetch(`/api/members?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
            fetch(`/api/down-payments?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
            fetch(`/api/income-expense?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
            fetch(`/api/loans-investments?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
            fetch(`/api/receipts?_t=${ts}`, { headers: authHeaders, cache: 'no-store' }),
          ]);

        // Discard stale background responses if a newer load or photo upload started
        if (mySeq !== loadSeqRef.current) return;

        if (bootRes.ok) setBootstrapData(await bootRes.json());
        if (homeRes.ok) {
          const hJson = await homeRes.json();
          if (mySeq === loadSeqRef.current) {
            setSocietyHomeData({
              branding: hJson.branding || FALLBACK_BRANDING,
              notices: hJson.notices || [],
              memberComments: hJson.memberComments || [],
              programsGallery: hJson.programsGallery || [],
              projectsGallery: hJson.projectsGallery || [],
            });
          }
        }
        if (dashRes.ok) setDashboardData(await dashRes.json());
        if (memRes.ok) {
          const mJson = await memRes.json();
          const freshMembers = mJson.members || [];
          if (mySeq === loadSeqRef.current) {
            setMembersData(freshMembers);
            setSelectedProfileMember((prev: any) => {
              if (!prev) return null;
              const fresh = freshMembers.find((m: any) => m.memberId === prev.memberId);
              return fresh ? { ...prev, ...fresh } : prev;
            });
          }
        }
        if (dpRes.ok) setDownPaymentsData(await dpRes.json());
        if (ieRes.ok) setIncomeExpenseData(await ieRes.json());
        if (liRes.ok) setLoansInvestmentsData(await liRes.json());
        if (rcpRes.ok) {
          const rJson = await rcpRes.json();
          setReceiptsList(rJson.receipts || []);
        }
        window.dispatchEvent(new CustomEvent('hf_background_sync'));
      } catch (error) {
        console.error('Error loading cooperative society data:', error);
      } finally {
        isFetchingAllRef.current = false;
        if (!silent) setLoading(false);
        setIsRefreshing(false);
        setLastSyncTime(new Date().toLocaleTimeString('bn-BD'));
      }
    },
    [authHeaders, dashboardYear, dashboardMemberFilter, activeRole, activeMemberId]
  );

  // Persist active role & member session when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      localStorage.setItem(
        'hf_society_session_meta_v1',
        JSON.stringify({ activeRole, activeMemberId, sessionToken })
      );
      if (sessionToken) {
        localStorage.setItem('hf_society_session_v1', sessionToken);
      }
    } catch {
      // ignore storage errors
    }
  }, [isAuthenticated, activeRole, activeMemberId, sessionToken]);

  // Refetch instantly when activeModule changes so user never sees stale tab data
  useEffect(() => {
    loadAllData(true);
  }, [activeModule, loadAllData]);

  // Global event listener for instant financial cross-component synchronization
  useEffect(() => {
    const handleSyncTrigger = () => {
      loadAllData(true, true);
    };
    window.addEventListener('hf_financial_sync_trigger', handleSyncTrigger);
    return () => {
      window.removeEventListener('hf_financial_sync_trigger', handleSyncTrigger);
    };
  }, [loadAllData]);

  // Multi-device & Published-to-Dev real-time cloud sync: automatically refresh when tab regains focus or every 5s
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() >= mutationPauseUntilRef.current) {
        loadAllData(true);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() >= mutationPauseUntilRef.current) {
        loadAllData(true);
      }
    }, 5000); // 5s silent auto-sync across all devices & published/dev links
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(interval);
    };
  }, [loadAllData]);

  // Switch default module if MEMBER role is selected while on an admin-only module
  const handleRoleSwitch = (newRole: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER') => {
    setActiveRole(newRole);
    if (
      newRole === 'MEMBER' &&
      ![
        'HOME',
        'SMART_HUB',
        'MEMBER_PORTAL',
        'YEARLY_ACCOUNTING',
        'DOWN_PAYMENTS',
        'ACCOUNTING_REPORTS',
        'RECEIPTS',
      ].includes(activeModule)
    ) {
      setActiveModule('MEMBER_PORTAL');
    }
  };

  const kpis = dashboardData?.kpis || {};
  const charts = dashboardData?.charts || {};
  const allMembersSelector = bootstrapData?.allMembersList || [
    { memberId: '02', name: 'Hafez Mohammad Kamruzzaman', nameBn: 'হাফেজ মোহাম্মদ কামরুজ্জামান', status: 'ACTIVE' },
  ];

  const myMemberRecord =
    membersData.find((m) => m.memberId === activeMemberId) || membersData[0];

  const handlePortalPhotoUpload = async (
    field: 'photoUrl' | 'nomineePhotoUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !myMemberRecord) return;
    try {
      mutationPauseUntilRef.current = Date.now() + 8000;
      loadSeqRef.current += 1;
      setUploadingPortalPhoto(true);
      const compressedDataUrl = await compressImageFile(file, 600, 0.86);
      // Optimistically update local member record immediately
      setMembersData((prev) =>
        prev.map((m) =>
          m.memberId === myMemberRecord.memberId ? { ...m, [field]: compressedDataUrl } : m
        )
      );
      const res = await fetch(`/api/members/${encodeURIComponent(myMemberRecord.memberId)}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'x-society-member-id': myMemberRecord.memberId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: compressedDataUrl }),
      });
      const result = await res.json();
      if (res.ok && result.member) {
        setMembersData((prev) =>
          prev.map((m) =>
            m.memberId === myMemberRecord.memberId
              ? { ...m, ...result.member, [field]: compressedDataUrl }
              : m
          )
        );
        await loadAllData(true, true);
        setPortalPhotoNotice(
          field === 'nomineePhotoUrl'
            ? 'মনোনীত নমিনির ছবি সফলভাবে আপলোড ও ডাটাবেজে সংরক্ষিত হয়েছে!'
            : 'আপনার প্রোফাইল ছবি সফলভাবে আপলোড ও ডাটাবেজে সংরক্ষিত হয়েছে!'
        );
        setTimeout(() => setPortalPhotoNotice(''), 5000);
      }
    } catch (err) {
      console.error('Portal photo upload error:', err);
    } finally {
      setUploadingPortalPhoto(false);
    }
  };

  const navSections: Array<{
    categoryBn: string;
    categoryEn: string;
    items: Array<{
      id: NavModule;
      labelBn: string;
      labelEn: string;
      icon: React.FC<{ className?: string }>;
      roles: string[];
      badge?: string;
    }>;
  }> = [
    {
      categoryBn: 'সমিতি ও ওভারভিউ',
      categoryEn: 'Overview & Portal',
      items: [
        {
          id: 'HOME',
          labelBn: 'সমিতির হোম পেজ ও নোটিশ',
          labelEn: 'Society Home & Notices',
          icon: Home,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
          badge: 'নোটিশ বোর্ড',
        },
        {
          id: 'SMART_HUB',
          labelBn: 'স্মার্ট ফিচার ও ডিজিটাল সেবা',
          labelEn: 'Smart Society Hub (6-in-1)',
          icon: Sparkles,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
          badge: 'নতুন ★',
        },
        {
          id: 'DASHBOARD',
          labelBn: 'আর্থিক ড্যাশবোর্ড',
          labelEn: 'Financial Dashboard',
          icon: LayoutDashboard,
          roles: ['SUPER_ADMIN', 'ADMIN'],
          badge: '২০১৯–২৬',
        },
        {
          id: 'MEMBER_PORTAL',
          labelBn: 'সদস্য সেলফ-সার্ভিস পোর্টাল',
          labelEn: 'Member Self-Service',
          icon: UserCheck,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
          badge: 'স্বীয় প্রোফাইল',
        },
      ],
    },
    {
      categoryBn: 'হিসাবরক্ষণ ও সঞ্চয় তহবিল',
      categoryEn: 'Treasury & Accounts',
      items: [
        {
          id: 'YEARLY_ACCOUNTING',
          labelBn: 'বাৎসরিক ও মাসিক হিসাব',
          labelEn: 'Yearly Accounting',
          icon: CalendarRange,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
          badge: '৮ বছর',
        },
        {
          id: 'DOWN_PAYMENTS',
          labelBn: 'ডাউন পেমেন্ট সঞ্চয় তহবিল',
          labelEn: 'Down Payment Reserves',
          icon: CreditCard,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
          badge: 'রিজার্ভ',
        },
        {
          id: 'INCOME_EXPENSE',
          labelBn: 'আয় ও ব্যয় ভাউচার',
          labelEn: 'Income & Expenses',
          icon: TrendingUp,
          roles: ['SUPER_ADMIN', 'ADMIN'],
        },
        {
          id: 'LOANS_INVESTMENTS',
          labelBn: 'ঋণ ও কল্যাণমূলক বিনিয়োগ',
          labelEn: 'Loans & Investments',
          icon: Landmark,
          roles: ['SUPER_ADMIN', 'ADMIN'],
        },
      ],
    },
    {
      categoryBn: 'প্রশাসন, রিপোর্ট ও নিরাপত্তা',
      categoryEn: 'Administration & Reports',
      items: [
        {
          id: 'MEMBERS',
          labelBn: 'সদস্য ব্যবস্থাপনা ও নমিনি',
          labelEn: 'Member Directory & Nominee',
          icon: Users,
          roles: ['SUPER_ADMIN', 'ADMIN'],
          badge: '১২ জন',
        },
        {
          id: 'EXCEL_IMPORT',
          labelBn: 'এক্সেল ডাটা মাইগ্রেশন',
          labelEn: 'Excel Shomiti Import',
          icon: FileSpreadsheet,
          roles: ['SUPER_ADMIN', 'ADMIN'],
        },
        {
          id: 'ACCOUNTING_REPORTS',
          labelBn: 'ডাবল-এন্ট্রি ও ১৭টি রিপোর্ট',
          labelEn: '17 Financial Reports',
          icon: BookOpen,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
          badge: '১৭টি',
        },
        {
          id: 'RECEIPTS',
          labelBn: 'অফিসিয়াল মানি রশিদ',
          labelEn: 'Money Receipts Archive',
          icon: Receipt,
          roles: ['SUPER_ADMIN', 'ADMIN', 'MEMBER'],
        },
        {
          id: 'AUDIT_SECURITY',
          labelBn: 'অডিট লগ ও আরএলএস নিরাপত্তা',
          labelEn: 'Audit Logs & RLS',
          icon: ShieldCheck,
          roles: ['SUPER_ADMIN', 'ADMIN'],
        },
        {
          id: 'USER_MANAGEMENT',
          labelBn: 'ইউজার ও পাসওয়ার্ড নিয়ন্ত্রণ',
          labelEn: 'User Credentials Studio',
          icon: Users,
          roles: ['SUPER_ADMIN', 'ADMIN'],
          badge: 'সুপার এডমিন',
        },
      ],
    },
  ];

  const allVisibleSidebarItems = navSections.flatMap((s) => s.items).filter((it) => it.roles.includes(activeRole));

  const renderSidebarContent = (isDrawer: boolean = false) => (
    <div className="flex h-full flex-col justify-between overflow-y-auto bg-slate-900 text-slate-200">
      <div>
        {/* Sidebar Brand Header */}
        <div className="border-b border-slate-800 bg-slate-950/80 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SocietyLogoAvatar logoUrl={societyHomeData.branding.logoUrl} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {societyHomeData.branding.nameBn}
                </p>
                <p className="truncate text-[10px] font-medium text-teal-400">
                  {societyHomeData.branding.nameEn}
                </p>
              </div>
            </div>
            {isDrawer && (
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Active Security Role Badge Card (Role-isolated for Member vs Admin/Super Admin) */}
          <div className="mt-3.5 rounded-xl border border-teal-500/30 bg-teal-950/40 p-2.5">
            {activeRole === 'MEMBER' ? (
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold text-cyan-300">
                  <Lock className="h-3 w-3" />
                  সদস্য পোর্টাল (RLS):
                </span>
                <span className="font-mono font-bold text-white">
                  সদস্য #{activeMemberId}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">সক্রিয় রোল:</span>
                <span className="font-bold text-teal-300 inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {activeRole === 'SUPER_ADMIN'
                    ? 'সুপার এডমিন (পূর্ণ ক্ষমতা)'
                    : 'এডমিন (চাঁদা ও নোটিশ)'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Categorized Navigation Menu Links */}
        <div className="p-3 space-y-5">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => item.roles.includes(activeRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.categoryBn} className="space-y-1">
                <div className="px-3 pb-1 pt-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {section.categoryBn}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {section.categoryEn}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveModule(item.id);
                          if (isDrawer) setMobileSidebarOpen(false);
                        }}
                        className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-md shadow-teal-950/40 border-l-4 border-teal-300'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-teal-300'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold leading-tight">{item.labelBn}</p>
                            <p className="truncate text-[10px] opacity-75">{item.labelEn}</p>
                          </div>
                        </div>

                        {item.badge && (
                          <span
                            className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-teal-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer: Active Member Profile & Theme Switch */}
      <div className="border-t border-slate-800 bg-slate-950/60 p-4 space-y-3">
        {/* Active Member Summary Card */}
        {myMemberRecord && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-teal-500/40 bg-teal-950">
                {myMemberRecord.photoUrl ? (
                  <img
                    src={myMemberRecord.photoUrl}
                    alt={myMemberRecord.nameBn}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-teal-300">
                    {myMemberRecord.memberId}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">
                  {myMemberRecord.nameBn || myMemberRecord.name}
                </p>
                <p className="truncate text-[10px] text-teal-400">
                  সদস্য #{myMemberRecord.memberId} · {myMemberRecord.mobile}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedProfileMember(myMemberRecord);
                if (isDrawer) setMobileSidebarOpen(false);
              }}
              className="rounded-lg border border-teal-500/30 bg-teal-950/60 p-1.5 text-teal-300 hover:bg-teal-900 shrink-0"
              title="আমার প্রোফাইল ও নমিনি দেখুন"
            >
              <UserCheck className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700"
          >
            {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isDrawer) setMobileSidebarOpen(false);
              handleLogout();
            }}
            className="inline-flex items-center gap-1 font-semibold text-xs text-rose-400 hover:underline"
          >
            <LogOut className="h-3.5 w-3.5" />
            লগআউট
          </button>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <UniqueLoginScreen
        onLoginSuccess={(userData, token) => {
          try {
            sessionStorage.removeItem('hf_explicit_logout');
          } catch {
            // ignore
          }
          setIsAuthenticated(true);
          setCurrentUser(userData);
          if (userData.role) setActiveRole(userData.role);
          if (userData.memberId) setActiveMemberId(userData.memberId);
          if (token) setSessionToken(token);
          loadAllData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* =====================================================================
       * TOP BAR (With Mobile Menu Button + Role Badge + Fast Quick Action)
       * =================================================================== */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900 no-print">
        {/* Left: Mobile Menu Toggle & Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex md:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            title="সাইডবার মেনু খুলুন"
          >
            <Menu className="h-5 w-5" />
          </button>

          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('HOME');
            }}
            className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
          >
            <SocietyLogoAvatar logoUrl={societyHomeData.branding.logoUrl} size="sm" />
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold leading-tight">
                {societyHomeData.branding.nameBn || 'হিলফুল ফুজুল সমবায় সমিতি'}
              </p>
              <p className="text-[10px] text-teal-700 dark:text-teal-400 font-medium hidden sm:block">
                {societyHomeData.branding.nameEn}
              </p>
            </div>
          </a>
        </div>

        {/* Right Controls: Role Switcher, Theme & Fast Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Interactive Role Switcher & Member Selector */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900 dark:border-teal-700/60 dark:bg-teal-950 dark:text-teal-200 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <select
              value={activeRole}
              onChange={(e) => {
                const nextRole = e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
                setSessionToken('');
                localStorage.removeItem('hf_society_session_v1');
                handleRoleSwitch(nextRole);
              }}
              className="bg-transparent font-bold text-teal-900 dark:text-teal-200 focus:outline-none cursor-pointer text-xs"
              title="সক্রিয় রোল পরিবর্তন করুন"
            >
              <option value="SUPER_ADMIN" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                সুপার এডমিন (পূর্ণ নিয়ন্ত্রণ)
              </option>
              <option value="ADMIN" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                এডমিন (চাঁদা ও ভাউচার)
              </option>
              <option value="MEMBER" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                সদস্য পোর্টাল (সেলফ-সার্ভিস)
              </option>
            </select>
            {activeRole === 'MEMBER' && (
              <select
                value={activeMemberId}
                onChange={(e) => {
                  setSessionToken('');
                  localStorage.removeItem('hf_society_session_v1');
                  setActiveMemberId(e.target.value);
                }}
                className="ml-1 rounded-lg border border-teal-500/40 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-900 dark:bg-slate-900 dark:text-teal-200 focus:outline-none"
                title="সদস্য নির্বাচন করুন"
              >
                {(membersData.length > 0 ? membersData : allMembersSelector).map((m: any) => (
                  <option key={m.memberId} value={m.memberId}>
                    #{m.memberId} - {m.nameBn || m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Smart Hub Button */}
          <button
            type="button"
            onClick={() => setActiveModule('SMART_HUB')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:from-teal-500 hover:to-emerald-500 transition-all whitespace-nowrap shadow-xs"
            title="স্মার্ট ফিচার হাব (হোয়াটসঅ্যাপ অ্যালার্ট, বিকাশ পেমেন্ট, স্মার্ট আইডি ও লভ্যাংশ)"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            <span className="hidden sm:inline">স্মার্ট ফিচার হাব</span>
          </button>

          {/* Super Admin Quick User Management Studio Button */}
          {activeRole === 'SUPER_ADMIN' && (
            <button
              type="button"
              onClick={() => setActiveModule('USER_MANAGEMENT')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 transition-colors whitespace-nowrap shadow-2xs"
              title="সুপার এডমিন ইউজার নেম ও পাসওয়ার্ড স্টুডিও"
            >
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">ইউজার ও পাসওয়ার্ড</span>
            </button>
          )}

          {/* Real-time Multi-Device Sync Indicator & Instant Refresh Button */}
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              loadAllData();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 transition-colors shadow-2xs"
            title="ক্লাউড ডাটাবেজ থেকে তাৎক্ষণিক সর্বশেষ তথ্য রিফ্রেশ করুন"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 text-teal-600 dark:text-teal-400 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span className="hidden lg:inline text-[11px] text-slate-600 dark:text-slate-300">
              হালনাগাদঃ {lastSyncTime}
            </span>
            <span className="hidden sm:inline lg:hidden text-[11px]">রিফ্রেশ</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="hidden sm:inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            title="Theme Mode"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {activeRole === 'MEMBER' ? (
            <button
              type="button"
              onClick={() => {
                if (myMemberRecord) {
                  setProfileModalEditMode(false);
                  setSelectedProfileMember(myMemberRecord);
                }
              }}
              className="rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shadow-xs"
            >
              আমার প্রোফাইল ও নমিনি
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveModule('YEARLY_ACCOUNTING')}
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 transition-colors whitespace-nowrap shadow-xs"
            >
              মাসিক জমা এন্ট্রি
            </button>
          )}

          {/* Secure Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 transition-colors whitespace-nowrap shadow-2xs"
            title="সফটওয়্যার থেকে লগআউট করুন"
          >
            <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
       * WORKSPACE LAYOUT (Permanent Sidebar on Desktop + Mobile Slide-over Drawer)
       * =================================================================== */}
      <div className="flex min-h-[calc(100vh-57px)]">
        {/* Mobile Slide-Over Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative flex w-72 max-w-[85vw] flex-col z-10 shadow-2xl">
              {renderSidebarContent(true)}
            </div>
          </div>
        )}

        {/* Desktop Permanent 280px Sidebar */}
        <aside className="hidden md:flex md:w-72 md:flex-col md:shrink-0 border-r border-slate-800/80 bg-slate-900 text-slate-200 no-print">
          {renderSidebarContent(false)}
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 overflow-x-hidden p-6">
          {/* Mobile Module Switcher (Only visible on small screens) */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs md:hidden dark:border-slate-800 dark:bg-slate-900 no-print">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">মেনু নির্বাচন:</span>
            <select
              value={activeModule}
              onChange={(e) => setActiveModule(e.target.value as NavModule)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
            >
              {allVisibleSidebarItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.labelBn}
                </option>
              ))}
            </select>
          </div>

          {/* =================================================================
           * MODULE 0: SOCIETY HOME PAGE, LOGO STUDIO & NOTICE BOARD
           * =============================================================== */}
          {activeModule === 'HOME' && (
            <SocietyHomePage
              role={activeRole}
              currentMemberId={activeMemberId}
              branding={societyHomeData.branding}
              notices={societyHomeData.notices}
              memberComments={societyHomeData.memberComments}
              programsGallery={societyHomeData.programsGallery}
              projectsGallery={societyHomeData.projectsGallery}
              kpis={kpis}
              members={membersData}
              memberDuesChart={charts.memberCollectionChart || []}
              authHeaders={authHeaders}
              onNavigateModule={(mod) => setActiveModule(mod)}
              onOpenMemberLedger={(mId) => {
                setActiveMemberId(mId);
                setActiveModule('YEARLY_ACCOUNTING');
              }}
              onRefreshHomeData={loadSocietyHomeOnly}
              onOpenMemberProfile={(m, editMode) => {
                setProfileModalEditMode(Boolean(editMode));
                setSelectedProfileMember(m);
              }}
            />
          )}

          {/* =================================================================
           * MODULE 1: FINANCIAL DASHBOARD (SECTION 8)
           * =============================================================== */}
          {activeModule === 'DASHBOARD' && (
            <div className="space-y-6">
              {/* Dashboard Header & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    হিলফুল ফুজুল সমবায় সমিতি — আর্থিক ড্যাশবোর্ড (Financial Overview)
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Real-time PostgreSQL Accounting · Historical Records (2019–2026) from &quot;Shomiti Hishab English (1).xlsx&quot;
                  </p>
                </div>

                {/* Filters: Current Year, Previous Year, Custom Year, Individual Member */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setDashboardYear(0)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        dashboardYear === 0
                          ? 'bg-slate-900 text-white dark:bg-teal-600'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      All Years (2019–2026)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardYear(2026)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        dashboardYear === 2026
                          ? 'bg-slate-900 text-white dark:bg-teal-600'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Current Year (2026)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardYear(2025)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        dashboardYear === 2025
                          ? 'bg-slate-900 text-white dark:bg-teal-600'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Previous Year (2025)
                    </button>
                  </div>

                  <select
                    value={dashboardYear}
                    onChange={(e) => setDashboardYear(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value={0}>Custom Year: All</option>
                    {YEARS_LIST.slice(0, 8).map((yr) => (
                      <option key={yr} value={yr}>
                        Year {yr}
                      </option>
                    ))}
                  </select>

                  <select
                    value={dashboardMemberFilter}
                    onChange={(e) => setDashboardMemberFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">All Society Members (সকল সদস্য)</option>
                    {allMembersSelector.map((m: any) => (
                      <option key={m.memberId} value={m.memberId}>
                        {m.memberId} — {m.nameBn || m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* All 13 Mandatory KPI Metrics */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  {
                    labelBn: 'মোট সদস্য সংখ্যা',
                    labelEn: 'Total Members',
                    val: `${kpis.totalMembers || 12} (Active: ${kpis.activeMembers || 12})`,
                    isMoney: false,
                    accent: 'text-slate-900 dark:text-white',
                  },
                  {
                    labelBn:
                      activeRole === 'MEMBER' || dashboardMemberFilter !== 'ALL'
                        ? 'আপনার মোট শেয়ার আমানত'
                        : 'মোট শেয়ার আমানত',
                    labelEn: 'Total Share Deposits',
                    val: kpis.totalShareDeposits,
                    isMoney: true,
                    accent: 'text-teal-700 dark:text-teal-400',
                  },
                  {
                    labelBn: 'মোট মাসিক প্রদেয়',
                    labelEn: 'Total Payable',
                    val: kpis.totalPayable,
                    isMoney: true,
                    accent: 'text-slate-900 dark:text-white',
                  },
                  {
                    labelBn: 'মোট জরিমানা আদায়',
                    labelEn: 'Total Fine',
                    val: kpis.totalFine,
                    isMoney: true,
                    accent: 'text-slate-900 dark:text-white',
                  },
                  {
                    labelBn: 'অন্যান্য প্রাপ্তি',
                    labelEn: 'Total Other Receipts',
                    val: kpis.totalOtherReceipts,
                    isMoney: true,
                    accent: 'text-slate-900 dark:text-white',
                  },
                  {
                    labelBn: 'মোট ডাউন পেমেন্ট',
                    labelEn: 'Total Down Payments',
                    val: kpis.totalDownPayments,
                    isMoney: true,
                    accent: 'text-teal-700 dark:text-teal-400',
                  },
                  {
                    labelBn: 'সর্বমোট আদায় (Collection)',
                    labelEn: 'Total Collection',
                    val: kpis.totalCollection,
                    isMoney: true,
                    accent: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    labelBn:
                      activeRole === 'MEMBER' || dashboardMemberFilter !== 'ALL'
                        ? 'আপনার মোট বকেয়া'
                        : dashboardYear === 0
                        ? 'সকল সদস্যের মোট বকেয়া (২০১৯–২০২৬)'
                        : `মোট বকেয়া (${dashboardYear} পর্যন্ত)`,
                    labelEn:
                      dashboardYear === 0
                        ? 'Total Outstanding Dues (2019–2026)'
                        : `Total Outstanding Dues (${dashboardYear})`,
                    val: kpis.totalOutstandingDues,
                    isMoney: true,
                    accent: 'text-amber-600 dark:text-amber-400',
                  },
                  {
                    labelBn: 'সমিতির সর্বমোট খরচ (২০১৯–২০২৬)',
                    labelEn: 'Total Society Expenses',
                    val: kpis.totalExpenses ?? 2526729,
                    isMoney: true,
                    accent: 'text-rose-600 dark:text-rose-400',
                  },
                  {
                    labelBn: 'খরচ বাদে অবশিষ্ট নিট তহবিল',
                    labelEn: 'Net Available Cash Balance',
                    val: kpis.availableCashBalance ?? 58701,
                    isMoney: true,
                    accent: 'text-emerald-700 dark:text-emerald-400',
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {stat.labelBn} · {stat.labelEn}
                    </p>
                    <p
                      className={`mt-1.5 font-mono text-lg font-bold tabular-nums ${stat.accent}`}
                    >
                      {stat.isMoney ? formatBDT(stat.val as number) : stat.val}
                    </p>
                  </div>
                ))}
              </div>

              {/* Official Horizontal Expense Summary Table (খরচের হিসাব: 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026) */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/80 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      খরচের হিসাব (2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      হিলফুল ফুজুল সমবায় সমিতির বার্ষিক খরচের অফিশিয়াল বিবরণী · সর্বমোট খরচ: ৳২৫,২০,৫০৯
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule('INCOME_EXPENSE')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    খরচ এন্ট্রি / সংশোধন করুন →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <th className="border-r border-slate-200 px-4 py-2.5 text-left font-bold dark:border-slate-800">
                          মোট খরচঃ
                        </th>
                        {[
                          { year: 2019, label: '২০১৯', fallback: 10698 },
                          { year: 2020, label: '২০২০', fallback: 6990 },
                          { year: 2021, label: '২০২১', fallback: 7702 },
                          { year: 2022, label: '২০২২', fallback: 600 },
                          { year: 2023, label: '২০২৩', fallback: 1592199 },
                          { year: 2024, label: '২০২৪', fallback: 902320 },
                          { year: 2025, label: '২০২৫', fallback: 0 },
                          { year: 2026, label: '২০২৬', fallback: 0 },
                        ].map((col) => (
                          <th
                            key={col.year}
                            className="border-r border-slate-200 px-3 py-2.5 font-bold dark:border-slate-800"
                          >
                            {col.label} ({col.year})
                          </th>
                        ))}
                        <th className="bg-rose-50/70 px-4 py-2.5 font-extrabold text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                          মোট (Total)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white font-mono text-sm font-bold dark:bg-slate-900">
                        <td className="border-r border-slate-200 px-4 py-3 text-left font-sans text-xs font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                          মোট খরচ
                        </td>
                        {[
                          { year: 2019, fallback: 10698 },
                          { year: 2020, fallback: 6990 },
                          { year: 2021, fallback: 7702 },
                          { year: 2022, fallback: 600 },
                          { year: 2023, fallback: 1592199 },
                          { year: 2024, fallback: 902320 },
                          { year: 2025, fallback: 0 },
                          { year: 2026, fallback: 6220 },
                        ].map((col) => {
                          const expenseList =
                            dashboardData?.yearlyExpenseSummary ||
                            charts?.yearlyExpenseSummary ||
                            [];
                          const found = expenseList.find(
                            (y: any) => Number(y.year) === col.year
                          );
                          const val =
                            found &&
                            (found.expense !== undefined || found.totalExpense !== undefined)
                              ? Number(found.expense ?? found.totalExpense)
                              : dashboardData
                              ? 0
                              : col.fallback;
                          return (
                            <td
                              key={col.year}
                              className="border-r border-slate-200 px-3 py-3 tabular-nums text-rose-600 dark:border-slate-800 dark:text-rose-400"
                            >
                              {formatBDT(val)}
                            </td>
                          );
                        })}
                        <td className="bg-rose-50/80 px-4 py-3 text-base font-extrabold tabular-nums text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          {formatBDT(
                            kpis.totalExpenses ??
                              (dashboardData
                                ? (
                                    dashboardData?.yearlyExpenseSummary ||
                                    charts?.yearlyExpenseSummary ||
                                    []
                                  ).reduce(
                                    (s: number, y: any) =>
                                      s + Number(y.expense ?? y.totalExpense ?? 0),
                                    0
                                  )
                                : 2526729)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Interactive Financial Charts Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Chart 1: Yearly Collection & Expense (2019–2026) */}
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    বাৎসরিক আদায় ও খরচের চিত্র (Yearly Collection & Expense: 2019–2026)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Share Deposit, Other Receive, Down Payment & Yearly Expense (2019–2026)
                  </p>
                  <div className="mt-4 h-64 min-w-0">
                    <ResponsiveContainer width="100%" height={250} minWidth={100} minHeight={200}>
                      <BarChart data={charts.yearlyCollectionChart || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.4} />
                        <XAxis dataKey="year" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(val: any) => formatBDT(Number(val))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="shareDeposit" name="Share Deposit" fill="#0d9488" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="downPayment" name="Down Payment" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" name="Yearly Expense (খরচ)" fill="#e11d48" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Monthly Collection & Monthly Outstanding Dues */}
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    মাসিক আদায় বনাম বকেয়া ({charts.chartYear || 2026} Monthly Collection vs Outstanding Dues)
                  </h3>
                  <p className="text-xs text-slate-500">
                    January to December Collection & Remaining Monthly Due
                  </p>
                  <div className="mt-4 h-64 min-w-0">
                    <ResponsiveContainer width="100%" height={250} minWidth={100} minHeight={200}>
                      <LineChart data={charts.monthlyCollectionChart || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.4} />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(val: any) => formatBDT(Number(val))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line
                          type="monotone"
                          dataKey="totalCollection"
                          name="Monthly Collection"
                          stroke="#059669"
                          strokeWidth={2.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="outstandingDue"
                          name="Outstanding Due"
                          stroke="#d97706"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Share Deposit Growth & Down Payment Growth */}
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    শেয়ার আমানত ও ডাউন পেমেন্ট প্রবৃদ্ধি (Cumulative Capital Growth: 2019–2026)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cumulative Member Share Capital & Down Payment Reserve
                  </p>
                  <div className="mt-4 h-64 min-w-0">
                    <ResponsiveContainer width="100%" height={250} minWidth={100} minHeight={200}>
                      <AreaChart data={charts.yearlyCollectionChart || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.4} />
                        <XAxis dataKey="year" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(val: any) => formatBDT(Number(val))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area
                          type="monotone"
                          dataKey="cumulativeShare"
                          name="Share Deposit Growth"
                          stroke="#0d9488"
                          fill="#0d9488"
                          fillOpacity={0.2}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativeDown"
                          name="Down Payment Growth"
                          stroke="#1e3a8a"
                          fill="#1e3a8a"
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: Member-wise Collection */}
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    সদস্যভিত্তিক মোট জমা ও বকেয়া (Member-wise Collection & Dues)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Individual Member Contribution Comparison (IDs: 02, 04, 05, 06, 07, 09, 10, 11, 12, 14, 15, 16)
                  </p>
                  <div className="mt-4 h-64 min-w-0">
                    <ResponsiveContainer width="100%" height={250} minWidth={100} minHeight={200}>
                      <BarChart data={charts.memberCollectionChart || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.4} />
                        <XAxis dataKey="memberId" fontSize={10} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(val: any) => formatBDT(Number(val))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="totalReceived" name="Total Received" fill="#0d9488" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outstanding" name="Total Due" fill="#d97706" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Member-wise Complete Outstanding Dues Table (2019–2026) */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      সকল সদস্যের বকেয়া হিসাব বিবরণী (All Members Outstanding Dues Breakdown: 2019–2026)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ২০১৯–২০২৪ বকেয়া (সদস্য ০৯: ৳২৩,৮১০ এবং সদস্য ১৪: ৳১,১৫০) + ২০২৫ বকেয়া + ২০২৬ বকেয়া = সর্বমোট বকেয়া
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-1.5 font-mono text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    সর্বমোট বকেয়া ({dashboardYear === 0 ? '2019–2026' : dashboardYear}):{' '}
                    {formatBDT(kpis.totalOutstandingDues)}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Member ID</th>
                        <th className="px-3 py-3">সদস্যের নাম (Member Name)</th>
                        <th className="px-3 py-3 text-right">মোট জমা (Total Received)</th>
                        <th className="px-3 py-3 text-right">২০১৯–২০২৪ বকেয়া</th>
                        <th className="px-3 py-3 text-right">২০২৫ বকেয়া</th>
                        <th className="px-3 py-3 text-right">২০২৬ বকেয়া</th>
                        <th className="px-3 py-3 text-right font-bold">
                          মোট বকেয়া (2019–2026 Total Due)
                        </th>
                        <th className="px-4 py-3 text-right">সংশোধন / লেজার</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(charts.memberCollectionChart || []).map((row: any) => (
                        <tr key={row.memberId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                            #{row.memberId}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                            {row.nameBn || row.fullName}
                            <span className="ml-1.5 text-[11px] text-slate-400">({row.fullName || row.name})</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatBDT(row.totalReceived)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            <span
                              className={
                                row.due2019To2024 > 0
                                  ? 'font-bold text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400'
                              }
                            >
                              {formatBDT(row.due2019To2024 || 0)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatBDT(row.due2025 || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatBDT(row.due2026 || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                            {formatBDT(
                              dashboardYear === 0
                                ? row.totalOutstanding2019To2026 ?? row.outstanding
                                : row.outstanding
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMemberId(row.memberId);
                                setActiveModule('YEARLY_ACCOUNTING');
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              হিসাব দেখুন / Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-mono text-xs font-bold dark:border-slate-700 dark:bg-slate-950">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-slate-900 dark:text-white">
                          সর্বমোট (All 12 Members Grand Total)
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">
                          {formatBDT(
                            (charts.memberCollectionChart || []).reduce(
                              (sum: number, r: any) => sum + (r.totalReceived || 0),
                              0
                            )
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-amber-700 dark:text-amber-400">
                          {formatBDT(
                            (charts.memberCollectionChart || []).reduce(
                              (sum: number, r: any) => sum + (r.due2019To2024 || 0),
                              0
                            )
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatBDT(
                            (charts.memberCollectionChart || []).reduce(
                              (sum: number, r: any) => sum + (r.due2025 || 0),
                              0
                            )
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatBDT(
                            (charts.memberCollectionChart || []).reduce(
                              (sum: number, r: any) => sum + (r.due2026 || 0),
                              0
                            )
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-amber-600 dark:text-amber-400">
                          {formatBDT(kpis.totalOutstandingDues)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
           * MODULE 2: INDIVIDUAL MEMBER DASHBOARD PORTAL (SECTION 13)
           * =============================================================== */}
          {activeModule === 'MEMBER_PORTAL' && myMemberRecord && (
            <div className="space-y-6">
              {/* Hidden file inputs for 1-click Member & Nominee photo upload directly inside Member Portal */}
              <input
                ref={portalMemberPhotoRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePortalPhotoUpload('photoUrl', e)}
                className="hidden"
              />
              <input
                ref={portalNomineePhotoRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePortalPhotoUpload('nomineePhotoUrl', e)}
                className="hidden"
              />

              {portalPhotoNotice && (
                <div className="flex items-center gap-2 rounded-xl border border-teal-400 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-900 dark:border-teal-700 dark:bg-teal-950/80 dark:text-teal-200 shadow-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                  <span>{portalPhotoNotice}</span>
                </div>
              )}

              {/* Executive Member Digital Passbook & Dual Identity Vault */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                {/* Royal Header */}
                <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 px-6 py-6 text-white dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-teal-400 bg-slate-900 shadow-lg">
                          {myMemberRecord.photoUrl ? (
                            <img
                              src={myMemberRecord.photoUrl}
                              alt={myMemberRecord.nameBn || myMemberRecord.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-mono text-xl font-bold text-teal-300">
                              #{myMemberRecord.memberId}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => portalMemberPhotoRef.current?.click()}
                          className="inline-flex items-center gap-1 rounded-md border border-teal-400/50 bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-200 hover:bg-teal-500/40 no-print"
                        >
                          <Camera className="h-2.5 w-2.5" />
                          সদস্য ছবি আপলোড
                        </button>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-teal-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-300 border border-teal-500/30">
                            সদস্য আইডি #{myMemberRecord.memberId}
                          </span>
                          <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                            {societyHomeData.branding.committeeRoles?.[myMemberRecord.memberId] ||
                              'সম্মানিত প্রতিষ্ঠাতা সদস্য'}
                          </span>
                          <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] text-slate-200">
                            সনদ: HF-SH-2019-{myMemberRecord.memberId}
                          </span>
                        </div>
                        <h2 className="mt-1.5 text-xl sm:text-2xl font-bold text-white">
                          {myMemberRecord.nameBn || myMemberRecord.name}
                        </h2>
                        <p className="text-xs text-teal-200/90">{myMemberRecord.name}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => portalMemberPhotoRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-500"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {myMemberRecord.photoUrl ? 'নিজের ছবি পরিবর্তন করুন' : 'নিজের ছবি পোস্ট করুন'}
                      </button>
                      <button
                        type="button"
                        onClick={() => portalNomineePhotoRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {myMemberRecord.nomineePhotoUrl
                          ? 'নমিনির ছবি পরিবর্তন করুন'
                          : 'নমিনির ছবি পোস্ট করুন'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSmartHubInitialTab('ONLINE_PAYMENTS');
                          setActiveModule('SMART_HUB');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 shadow-xs hover:bg-amber-400"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        বিকাশ/নগদ কিস্তি জমা দিন
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSmartHubInitialTab('ID_CARD_CERTIFICATE');
                          setActiveModule('SMART_HUB');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/70 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30"
                      >
                        <QrCode className="h-3.5 w-3.5 text-emerald-300" />
                        স্মার্ট আইডি ও শেয়ার সনদ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileModalEditMode(false);
                          setSelectedProfileMember(myMemberRecord);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-teal-400/80 bg-teal-500/20 px-3.5 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-500/30"
                      >
                        <UserCheck className="h-3.5 w-3.5 text-teal-300" />
                        ডিজিটাল পরিচয়পত্র ও নমিনি সনদ
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        প্রিন্ট
                      </button>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Dual Identity Vault: Member Bio-Data + Verified Nominee Certificate */}
                <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-y-0 lg:divide-x dark:divide-slate-800">
                  {/* Left: Member Personal Identity Card */}
                  <div className="p-6 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-teal-800 dark:text-teal-300">
                        ১. সদস্যের ব্যক্তিগত পরিচিতি (Member Personal Identity)
                      </p>
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                        সক্রিয় সদস্য
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="block text-[10px] text-slate-400">পিতার নাম:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {myMemberRecord.fatherName || 'সমিতি সদস্য'}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="block text-[10px] text-slate-400">মাতার নাম:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {myMemberRecord.motherName || 'সংরক্ষিত'}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="block text-[10px] text-slate-400">মোবাইল নম্বর:</span>
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                          {myMemberRecord.mobile}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="block text-[10px] text-slate-400">রক্তের গ্রুপ ও পেশা:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          <strong className="text-rose-600">{myMemberRecord.bloodGroup || 'A+'}</strong> ·{' '}
                          {myMemberRecord.occupation || 'ব্যবসায়ী'}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="block text-[10px] text-slate-400">জাতীয় পরিচয়পত্র (NID):</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {myMemberRecord.nidNumber || 'যাচাইকৃত'}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="block text-[10px] text-slate-400">ঠিকানা:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {myMemberRecord.address || 'ঢাকা, বাংলাদেশ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Verified Nominee Identity & Direct Photo Studio */}
                  <div className="p-6 space-y-4 text-xs bg-emerald-50/30 dark:bg-emerald-950/15">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        ২. মনোনীত নমিনি ও ছবি (Verified Nominee Information)
                      </p>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {myMemberRecord.nomineeSharePercent || 100}% উত্তরাধিকারী
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-emerald-200/80 bg-white p-3.5 shadow-2xs dark:border-emerald-900/50 dark:bg-slate-900">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/60 bg-emerald-50 dark:bg-slate-800">
                        {myMemberRecord.nomineePhotoUrl ? (
                          <img
                            src={myMemberRecord.nomineePhotoUrl}
                            alt={myMemberRecord.nomineeName || 'নমিনি'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center font-bold text-emerald-700 dark:text-emerald-300 text-[10px] text-center p-1">
                            <Users className="h-6 w-6 opacity-75" />
                            <span>নমিনির ছবি</span>
                          </div>
                        )}
                        {uploadingPortalPhoto && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-[9px] font-bold text-white">
                            আপলোড...
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {myMemberRecord.nomineeName || 'নির্ধারিত নমিনি'}
                        </div>
                        <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          সম্পর্ক: {myMemberRecord.nomineeRelation || 'স্ত্রী / পিতা / পরিবার'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          মোবাইল: {myMemberRecord.nomineeMobile || myMemberRecord.mobile} · এনআইডি:{' '}
                          {myMemberRecord.nomineeNid || 'সংরক্ষিত'}
                        </div>

                        <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 no-print">
                          <button
                            type="button"
                            onClick={() => portalNomineePhotoRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            {myMemberRecord.nomineePhotoUrl
                              ? 'নমিনির ছবি পরিবর্তন করুন'
                              : 'নমিনির ছবি পোস্ট / আপলোড করুন'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4-Column Financial Passbook Strip inside Member Portal */}
                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-500">আপনার মোট শেয়ার আমানত</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-teal-700 dark:text-teal-400">
                      {formatBDT(myMemberRecord.lifetimeShareDeposit || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-500">মোট ডাউন পেমেন্ট</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatBDT(myMemberRecord.lifetimeDownPayment || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-500">সর্বমোট জমা (২০১৯–২৬)</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatBDT(myMemberRecord.lifetimeTotalReceived || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">আপনার মোট বকেয়া</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatBDT(myMemberRecord.currentOutstanding || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <YearlyAccountingView
                role="MEMBER"
                currentMemberId={myMemberRecord.memberId}
                membersList={[myMemberRecord]}
                authHeaders={authHeaders}
                onSelectReceipt={(rcp) => setSelectedReceipt(rcp)}
                onDataMutated={() => loadAllData(true, true)}
              />
            </div>
          )}

          {/* =================================================================
           * MODULE 3: MAIN MEMBER YEARLY ACCOUNTING (SECTIONS 5 & 6)
           * =============================================================== */}
          {activeModule === 'YEARLY_ACCOUNTING' && (
            <YearlyAccountingView
              role={activeRole}
              currentMemberId={activeMemberId}
              membersList={allMembersSelector}
              authHeaders={authHeaders}
              onSelectReceipt={(rcp) => setSelectedReceipt(rcp)}
              onDataMutated={() => loadAllData(true, true)}
            />
          )}

          {/* =================================================================
           * MODULE 4: MEMBER MANAGEMENT (SECTION 4)
           * =============================================================== */}
          {activeModule === 'MEMBERS' && (
            <MemberManagementSection
              role={activeRole}
              members={membersData}
              authHeaders={authHeaders}
              onOpenMemberLedger={(mId) => {
                setActiveMemberId(mId);
                setActiveModule('YEARLY_ACCOUNTING');
              }}
              onDataMutated={() => loadAllData(true, true)}
              onOpenMemberProfile={(m) => setSelectedProfileMember(m)}
            />
          )}

          {/* =================================================================
           * MODULE 5: EXCEL IMPORT & MIGRATION (SECTION 7)
           * =============================================================== */}
          {activeModule === 'EXCEL_IMPORT' && (
            <ExcelMigrationView
              role={activeRole}
              membersList={allMembersSelector}
              authHeaders={authHeaders}
              onDataMutated={() => loadAllData(true, true)}
            />
          )}

          {/* =================================================================
           * MODULE 6: DOWN PAYMENT MANAGEMENT (SECTION 9)
           * =============================================================== */}
          {activeModule === 'DOWN_PAYMENTS' && (
            <DownPaymentSection
              data={downPaymentsData}
              role={activeRole}
              authHeaders={authHeaders}
              onDataMutated={() => loadAllData(true, true)}
              onSelectReceipt={(rcp) => setSelectedReceipt(rcp)}
            />
          )}

          {/* =================================================================
           * MODULE 7: INCOME & EXPENSE MANAGEMENT (SECTION 10)
           * =============================================================== */}
          {activeModule === 'INCOME_EXPENSE' && (
            <IncomeExpenseSection
              role={activeRole}
              data={incomeExpenseData}
              authHeaders={authHeaders}
              onDataMutated={() => loadAllData(true, true)}
            />
          )}

          {/* =================================================================
           * MODULE 8: LOANS & INVESTMENTS (SECTION 11)
           * =============================================================== */}
          {activeModule === 'LOANS_INVESTMENTS' && (
            <LoanInvestmentSection
              role={activeRole}
              data={loansInvestmentsData}
              membersList={allMembersSelector}
              authHeaders={authHeaders}
              onDataMutated={() => loadAllData(true, true)}
            />
          )}

          {/* =================================================================
           * MODULE 9: DOUBLE-ENTRY LEDGER & 17 REPORTS (SECTIONS 12 & 15)
           * =============================================================== */}
          {activeModule === 'ACCOUNTING_REPORTS' && (
            <ReportsAndLedgerView
              authHeaders={authHeaders}
              members={membersData}
              downPayments={downPaymentsData}
              incomeExpense={incomeExpenseData}
              loansInvestments={loansInvestmentsData}
            />
          )}

          {/* =================================================================
           * MODULE 10: OFFICIAL RECEIPT SYSTEM (SECTION 14)
           * =============================================================== */}
          {activeModule === 'RECEIPTS' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    অফিসিয়াল মানি রশিদ আর্কাইভ (Official Payment Receipts — A4 & Thermal)
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Every approved payment generates a unique receipt number with A4 and 80mm POS thermal printing
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Receipt No</th>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Member ID & Name</th>
                        <th className="px-3 py-3">Billing Period</th>
                        <th className="px-3 py-3 text-right">Share Deposit</th>
                        <th className="px-3 py-3 text-right">Payable</th>
                        <th className="px-3 py-3 text-right">Down Payment</th>
                        <th className="px-3 py-3 text-right">Total Amount</th>
                        <th className="px-4 py-3 text-right">Print / Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {receiptsList.map((rcp: any) => (
                        <tr key={rcp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                            {rcp.receiptNo}
                          </td>
                          <td className="px-3 py-2.5 font-mono">{rcp.paymentDate}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                            {rcp.memberId} · {rcp.memberName}
                          </td>
                          <td className="px-3 py-2.5">
                            {rcp.monthName} {rcp.year}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatBDT(rcp.shareDeposit)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatBDT(rcp.payable)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatBDT(rcp.downPayment)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatBDT(rcp.totalAmount)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(rcp)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                            >
                              <Printer className="h-3 w-3" />
                              A4 / Thermal Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
           * MODULE 11: AUDIT LOGS & SECURITY (SECTION 16)
           * =============================================================== */}
          {activeModule === 'AUDIT_SECURITY' && (
            <AuditSecuritySection authHeaders={authHeaders} />
          )}

          {/* =================================================================
           * MODULE 12: USER MANAGEMENT STUDIO (SUPER ADMIN CREDENTIALS)
           * =============================================================== */}
          {activeModule === 'USER_MANAGEMENT' && (
            <UserManagementStudio
              currentProfile={currentUser || bootstrapData?.profile}
              allMembersList={allMembersSelector}
              authHeaders={authHeaders}
              onClose={() => setActiveModule('HOME')}
            />
          )}

          {/* =================================================================
           * MODULE 13: SMART SOCIETY FEATURES HUB (6-IN-1 NEXT-GEN SUITE)
           * =============================================================== */}
          {activeModule === 'SMART_HUB' && (
            <SmartFeaturesHub
              role={activeRole}
              currentMemberId={activeMemberId}
              branding={societyHomeData.branding}
              kpis={kpis}
              members={membersData.length > 0 ? membersData : allMembersSelector}
              authHeaders={authHeaders}
              initialTab={smartHubInitialTab}
              onSelectReceipt={(rcp) => setSelectedReceipt(rcp)}
              onOpenMemberLedger={(mId) => {
                setActiveMemberId(mId);
                setActiveModule('YEARLY_ACCOUNTING');
              }}
              onDataMutated={() => loadAllData(true, true)}
            />
          )}
        </main>
      </div>

      {/* Printable / PDF Receipt Modal */}
      <ReceiptModal
        receipt={selectedReceipt}
        logoUrl={societyHomeData.branding.logoUrl}
        onClose={() => setSelectedReceipt(null)}
      />

      {/* Member Profile & Nominee Management Modal */}
      {selectedProfileMember && (
        <MemberProfileModal
          member={selectedProfileMember}
          role={activeRole}
          currentMemberId={activeMemberId}
          societyLogoUrl={societyHomeData.branding.logoUrl}
          committeeRoleLabel={
            societyHomeData.branding.committeeRoles?.[selectedProfileMember.memberId]
          }
          authHeaders={authHeaders}
          initialEditMode={profileModalEditMode}
          onClose={() => {
            setSelectedProfileMember(null);
            setProfileModalEditMode(false);
          }}
          onMemberUpdated={async (updatedMember?: any) => {
            mutationPauseUntilRef.current = Date.now() + 5000;
            if (updatedMember) {
              setSelectedProfileMember((prev: any) =>
                prev ? { ...prev, ...updatedMember } : updatedMember
              );
              setMembersData((prev) =>
                prev.map((m) =>
                  m.memberId === updatedMember.memberId ? { ...m, ...updatedMember } : m
                )
              );
            }
            await loadAllData(true, true);
          }}
          onOpenLedger={(mId) => {
            setSelectedProfileMember(null);
            setProfileModalEditMode(false);
            setActiveMemberId(mId);
            setActiveModule('YEARLY_ACCOUNTING');
          }}
          onSwitchActiveMember={(mId) => {
            setActiveMemberId(mId);
          }}
        />
      )}
    </div>
  );
}
