import React, { useState, useEffect, useRef } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  Bell,
  Upload,
  Plus,
  Edit3,
  Trash2,
  Pin,
  Printer,
  Check,
  X,
  Users,
  Calendar,
  FileText,
  Calculator,
  Phone,
  Mail,
  MapPin,
  Award,
  ArrowRight,
  Search,
  Settings,
  BookOpen,
  Landmark,
  Shield,
  ShieldCheck,
  UserCheck,
  User,
  MessageSquare,
  MessageSquarePlus,
  Send,
  Lock,
  Camera,
  Image as ImageIcon,
  Briefcase,
  Maximize2,
} from 'lucide-react';
import { formatBDT, compressImageFile } from '../lib/utils.ts';
import { OFFICIAL_SOCIETY_LOGO_URL } from '../lib/officialLogo.ts';

export interface SocietyBranding {
  logoUrl: string;
  nameBn: string;
  nameEn: string;
  sloganBn: string;
  sloganEn: string;
  establishedYear: string;
  registrationInfo: string;
  addressBn: string;
  phone: string;
  email: string;
  meetingScheduleBn: string;
  aboutBn: string;
  visionBn: string;
  committeeRoles: Record<string, string>;
  rules: string[];
}

export interface SocietyNotice {
  id: number;
  title: string;
  message: string;
  type: 'URGENT' | 'MEETING' | 'PAYMENT_DUE' | 'POLICY' | 'ANNOUNCEMENT' | string;
  targetRole: string;
  isPinned: boolean;
  noticeDate: string;
  refNo: string;
  createdBy: string;
  createdAt?: string;
}

export interface SocietyMemberComment {
  id: number;
  memberId: string;
  memberName: string;
  memberNameBn: string;
  photoUrl?: string;
  committeeRole?: string;
  comment: string;
  category: string;
  commentDate: string;
  isHighlighted?: boolean;
  createdAt?: string;
}

export interface SocietyProgramPhoto {
  id: number;
  title: string;
  category: string;
  programDate: string;
  location: string;
  description: string;
  photoUrl: string;
  uploadedBy: string;
  createdAt?: string;
}

export interface SocietyProjectItem {
  id: number;
  projectCode: string;
  projectName: string;
  category: string;
  budgetAmount: number;
  investedAmount: number;
  location: string;
  startDate: string;
  status: string;
  description: string;
  photoUrl: string;
  updatedBy: string;
  createdAt?: string;
}

export const LOGO_PRESETS = [
  {
    id: 'preset:official-logo',
    labelBn: 'হিলফুল ফুজুল অফিসিয়াল লোগো',
    labelEn: 'Official Society Logo',
  },
  {
    id: 'preset:emerald-crest',
    labelBn: 'সবুজ ঐক্য প্রতীক',
    labelEn: 'Emerald Unity Crest',
  },
  {
    id: 'preset:gold-minaret',
    labelBn: 'সোনালী ঐতিহ্য সিলমোহর',
    labelEn: 'Golden Heritage Seal',
  },
  {
    id: 'preset:royal-octagonal',
    labelBn: 'রাজকীয় অষ্টভুজ প্রতীক',
    labelEn: 'Royal Octagonal Emblem',
  },
];

export const SocietyLogoAvatar: React.FC<{
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ logoUrl = OFFICIAL_SOCIETY_LOGO_URL, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const dims =
    size === 'sm'
      ? 'h-9 w-9'
      : size === 'md'
      ? 'h-14 w-14'
      : size === 'lg'
      ? 'h-20 w-20'
      : 'h-28 w-28';

  const resolvedUrl =
    !logoUrl ||
    logoUrl === 'preset:official-logo' ||
    logoUrl === 'preset:emerald-crest' ||
    logoUrl === '/assets/society-logo.jpg'
      ? OFFICIAL_SOCIETY_LOGO_URL
      : logoUrl;

  const isCustomImage =
    resolvedUrl &&
    !resolvedUrl.startsWith('preset:') &&
    (resolvedUrl.startsWith('data:image/') ||
      resolvedUrl.startsWith('http://') ||
      resolvedUrl.startsWith('https://') ||
      resolvedUrl.startsWith('/'));

  if (isCustomImage && !imgError) {
    return (
      <div
        className={`relative overflow-hidden rounded-full border-2 border-emerald-600/40 bg-white shadow-xs dark:border-emerald-500/40 dark:bg-slate-900 shrink-0 ${dims} ${className}`}
      >
        <img
          src={resolvedUrl}
          alt="হিলফুল ফুজুল সমবায় সমিতি লোগো"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-contain p-0.5"
        />
      </div>
    );
  }

  // Render crisp SVG Cooperative Emblem Preset
  if (logoUrl === 'preset:gold-minaret') {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-amber-300/80 bg-slate-900 p-1.5 shadow-xs shrink-0 ${dims} ${className}`}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="46" fill="#0f172a" stroke="#f59e0b" strokeWidth="3" />
          <circle
            cx="50"
            cy="50"
            r="39"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
          <path
            d="M50 18 L66 36 L60 36 L60 66 L40 66 L40 36 L34 36 Z"
            fill="#f59e0b"
            opacity="0.9"
          />
          <path d="M28 70 H72 V76 H28 Z" fill="#fbbf24" />
          <text
            x="50"
            y="56"
            textAnchor="middle"
            fill="#0f172a"
            fontSize="14"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            HF
          </text>
        </svg>
      </div>
    );
  }

  if (logoUrl === 'preset:royal-octagonal') {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-teal-500/40 bg-teal-950 p-1.5 shadow-xs shrink-0 ${dims} ${className}`}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="30,8 70,8 92,30 92,70 70,92 30,92 8,70 8,30"
            fill="#115e59"
            stroke="#2dd4bf"
            strokeWidth="3"
          />
          <polygon
            points="34,15 66,15 85,34 85,66 66,85 34,85 15,66 15,34"
            fill="#0f172a"
            stroke="#99f6e4"
            strokeWidth="1.2"
          />
          <text
            x="50"
            y="47"
            textAnchor="middle"
            fill="#5eead4"
            fontSize="16"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            হিলফুল
          </text>
          <text
            x="50"
            y="65"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="13"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            ফুজুল
          </text>
        </svg>
      </div>
    );
  }

  if (logoUrl === 'preset:modern-shield') {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-900 p-1.5 shadow-xs dark:border-slate-700 shrink-0 ${dims} ${className}`}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <path
            d="M50 10 L86 24 V50 C86 73 70 87 50 94 C30 87 14 73 14 50 V24 Z"
            fill="#0d9488"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <path
            d="M50 18 L78 29 V49 C78 67 65 79 50 85 C35 79 22 67 22 49 V29 Z"
            fill="#0f172a"
          />
          <text
            x="50"
            y="55"
            textAnchor="middle"
            fill="#2dd4bf"
            fontSize="22"
            fontWeight="bold"
            fontFamily="monospace"
          >
            ৳HF
          </text>
        </svg>
      </div>
    );
  }

  // Default: preset:emerald-crest
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-teal-600/30 bg-teal-900 p-1.5 shadow-xs shrink-0 ${dims} ${className}`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle cx="50" cy="50" r="46" fill="#064e3b" stroke="#34d399" strokeWidth="3" />
        <circle
          cx="50"
          cy="50"
          r="39"
          fill="#022c22"
          stroke="#10b981"
          strokeWidth="1.2"
          strokeDasharray="4 2"
        />
        {/* Cooperative interlocking emblem */}
        <path
          d="M32 58 C32 40, 50 26, 50 26 C50 26, 68 40, 68 58"
          fill="none"
          stroke="#34d399"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="50" cy="36" r="6" fill="#fbbf24" />
        <path
          d="M28 66 Q50 76 72 66"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="15"
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          HFCS
        </text>
        <text
          x="50"
          y="83"
          textAnchor="middle"
          fill="#a7f3d0"
          fontSize="9"
          fontWeight="bold"
          fontFamily="monospace"
        >
          EST. 2019
        </text>
      </svg>
    </div>
  );
};

interface SocietyHomePageProps {
  role: 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'MEMBER';
  currentMemberId?: string;
  branding: SocietyBranding;
  notices: SocietyNotice[];
  memberComments?: SocietyMemberComment[];
  programsGallery?: SocietyProgramPhoto[];
  projectsGallery?: SocietyProjectItem[];
  kpis: any;
  members: any[];
  memberDuesChart: any[];
  authHeaders: Record<string, string>;
  onNavigateModule: (module: any) => void;
  onOpenMemberLedger: (memberId: string) => void;
  onRefreshHomeData: () => Promise<void>;
  onOpenMemberProfile?: (member: any, editMode?: boolean) => void;
  onOpenLoginModal?: () => void;
}

const NOTICE_CATEGORIES = [
  { id: 'ALL', labelBn: 'সকল নোটিশ', labelEn: 'All Notices' },
  { id: 'URGENT', labelBn: 'জরুরি ঘোষণা', labelEn: 'Urgent' },
  { id: 'MEETING', labelBn: 'সাধারণ ও মাসিক সভা', labelEn: 'Meeting' },
  { id: 'PAYMENT_DUE', labelBn: 'কিস্তি ও বকেয়া তাগাদা', labelEn: 'Payment & Dues' },
  { id: 'POLICY', labelBn: 'সমিতির নীতিমালা', labelEn: 'Policy' },
  { id: 'ANNOUNCEMENT', labelBn: 'সাধারণ বিজ্ঞপ্তি', labelEn: 'General' },
];

const PROGRAM_CATEGORIES = [
  'সকল প্রোগ্রাম',
  'বার্ষিক সাধারণ সভা',
  'ইফতার ও দোয়া মাহফিল',
  'প্রকল্প পরিদর্শন',
  'বনভোজন ও মিলনমেলা',
  'বিশেষ অনুষ্ঠান ও প্রোগ্রাম',
];

const PROJECT_CATEGORIES = [
  'জমি ও আবাসন প্রকল্প',
  'মুদারাবা ও কৃষি বাণিজ্য প্রকল্প',
  'হালাল এসএমই ও ব্যবসা বিনিয়োগ',
  'মৎস্য ও ডেইরি খামার প্রকল্প',
  'সমবায় কল্যাণ ও উন্নয়ন প্রকল্প',
];

export const SocietyHomePage: React.FC<SocietyHomePageProps> = ({
  role,
  currentMemberId = '09',
  branding,
  notices,
  memberComments = [],
  programsGallery = [],
  projectsGallery = [],
  kpis,
  members,
  memberDuesChart,
  authHeaders,
  onNavigateModule,
  onOpenMemberLedger,
  onRefreshHomeData,
  onOpenMemberProfile,
  onOpenLoginModal,
}) => {
  const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickProgramPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const quickProjectPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const programModalFileInputRef = useRef<HTMLInputElement | null>(null);
  const projectModalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Notice Board states
  const [noticeFilter, setNoticeFilter] = useState<string>('ALL');
  const [noticeSearch, setNoticeSearch] = useState<string>('');
  const [showNoticeModal, setShowNoticeModal] = useState<boolean>(false);
  const [editingNotice, setEditingNotice] = useState<SocietyNotice | null>(null);
  const [viewingNotice, setViewingNotice] = useState<SocietyNotice | null>(null);

  // Notice Form fields
  const [noticeTitle, setNoticeTitle] = useState<string>('');
  const [noticeMessage, setNoticeMessage] = useState<string>('');
  const [noticeType, setNoticeType] = useState<string>('URGENT');
  const [noticeDate, setNoticeDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [noticeRefNo, setNoticeRefNo] = useState<string>('');
  const [noticeCreatedBy, setNoticeCreatedBy] = useState<string>('সভাপতি ও সাধারণ সম্পাদক');
  const [noticePinned, setNoticePinned] = useState<boolean>(true);
  const [savingNotice, setSavingNotice] = useState<boolean>(false);

  // Member Comment states
  const [showCommentForm, setShowCommentForm] = useState<boolean>(false);
  const [selectedCommentMemberId, setSelectedCommentMemberId] = useState<string>(
    currentMemberId || '09'
  );
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [newCommentCategory, setNewCommentCategory] = useState<string>('সদস্যের মতামত ও পরামর্শ');
  const [savingComment, setSavingComment] = useState<boolean>(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);

  // Society Programs Photo Gallery states
  const [programFilter, setProgramFilter] = useState<string>('সকল প্রোগ্রাম');
  const [showProgramModal, setShowProgramModal] = useState<boolean>(false);
  const [editingProgram, setEditingProgram] = useState<SocietyProgramPhoto | null>(null);
  const [programTitle, setProgramTitle] = useState<string>('');
  const [programCategory, setProgramCategory] = useState<string>('বার্ষিক সাধারণ সভা');
  const [programDate, setProgramDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [programLocation, setProgramLocation] = useState<string>(
    'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা'
  );
  const [programDescription, setProgramDescription] = useState<string>('');
  const [programPhotoUrl, setProgramPhotoUrl] = useState<string>('');
  const [savingProgram, setSavingProgram] = useState<boolean>(false);
  const [quickTargetProgramId, setQuickTargetProgramId] = useState<number | null>(null);

  // Society Projects Showcase & Photo states
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<SocietyProjectItem | null>(null);
  const [projectCode, setProjectCode] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [projectCategory, setProjectCategory] = useState<string>('জমি ও আবাসন প্রকল্প');
  const [projectBudget, setProjectBudget] = useState<number>(500000);
  const [projectInvested, setProjectInvested] = useState<number>(500000);
  const [projectLocation, setProjectLocation] = useState<string>('বিরুলিয়া, সাভার, ঢাকা');
  const [projectStartDate, setProjectStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [projectStatus, setProjectStatus] = useState<string>('চলমান প্রকল্প');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [projectPhotoUrl, setProjectPhotoUrl] = useState<string>('');
  const [savingProject, setSavingProject] = useState<boolean>(false);
  const [quickTargetProjectId, setQuickTargetProjectId] = useState<number | null>(null);

  // Lightbox image preview modal
  const [lightboxItem, setLightboxItem] = useState<{
    title: string;
    subtitle: string;
    description: string;
    photoUrl: string;
  } | null>(null);

  // Branding & Logo Studio Modal states
  const [showBrandingModal, setShowBrandingModal] = useState<boolean>(false);
  const [brandingTab, setBrandingTab] = useState<'LOGO' | 'INFO' | 'COMMITTEE' | 'RULES'>(
    'LOGO'
  );
  const [draftBranding, setDraftBranding] = useState<SocietyBranding>(branding);
  const [savingBranding, setSavingBranding] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>('');

  // Calculator state
  const [calcMonths, setCalcMonths] = useState<number>(12);
  const [calcIncludeDown, setCalcIncludeDown] = useState<number>(0);

  const openCreateProgramModal = () => {
    setEditingProgram(null);
    setProgramTitle('');
    setProgramCategory('বার্ষিক সাধারণ সভা');
    setProgramDate(new Date().toISOString().slice(0, 10));
    setProgramLocation('কমলাপুর, বিরুলিয়া, সাভার, ঢাকা');
    setProgramDescription('');
    setProgramPhotoUrl('');
    setShowProgramModal(true);
  };

  const openEditProgramModal = (item: SocietyProgramPhoto) => {
    setEditingProgram(item);
    setProgramTitle(item.title);
    setProgramCategory(item.category || 'বার্ষিক সাধারণ সভা');
    setProgramDate(item.programDate || new Date().toISOString().slice(0, 10));
    setProgramLocation(item.location || 'কমলাপুর, বিরুলিয়া, সাভার, ঢাকা');
    setProgramDescription(item.description || '');
    setProgramPhotoUrl(item.photoUrl || '');
    setShowProgramModal(true);
  };

  const handleProgramModalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 960, 0.85);
      if (dataUrl) {
        setProgramPhotoUrl(dataUrl);
        if (editingProgram && programTitle.trim()) {
          await fetch(`/api/society-programs/${editingProgram.id}`, {
            method: 'PUT',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: programTitle.trim(),
              category: programCategory,
              programDate,
              location: programLocation.trim(),
              description: programDescription.trim(),
              photoUrl: dataUrl,
            }),
          });
          await onRefreshHomeData();
        }
      }
    } catch (err: any) {
      setStatusBanner(err.message || 'ছবি প্রসেস করতে সমস্যা হয়েছে।');
    }
  };

  const handleQuickProgramCardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !quickTargetProgramId) return;
    try {
      setSavingProgram(true);
      const dataUrl = await compressImageFile(file, 960, 0.85);
      if (!dataUrl) return;
      const res = await fetch(`/api/society-programs/${quickTargetProgramId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: dataUrl }),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setStatusBanner('প্রোগ্রামের ছবি সফলভাবে ডাটাবেজে স্থায়ীভাবে সংরক্ষণ করা হয়েছে!');
        setTimeout(() => setStatusBanner(''), 4500);
      }
    } catch (err: any) {
      setStatusBanner(err.message || 'প্রোগ্রামের ছবি আপলোড করতে সমস্যা হয়েছে।');
    } finally {
      setSavingProgram(false);
      setQuickTargetProgramId(null);
    }
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programTitle.trim()) return;
    try {
      setSavingProgram(true);
      const url = editingProgram
        ? `/api/society-programs/${editingProgram.id}`
        : '/api/society-programs';
      const method = editingProgram ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: programTitle.trim(),
          category: programCategory,
          programDate,
          location: programLocation.trim(),
          description: programDescription.trim(),
          photoUrl: programPhotoUrl,
        }),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setShowProgramModal(false);
        setStatusBanner(
          editingProgram
            ? 'প্রোগ্রামের ছবি ও তথ্য সফলভাবে আপডেট করা হয়েছে!'
            : 'নতুন প্রোগ্রামের ছবি সফলভাবে হোম পেজে যুক্ত ও সংরক্ষণ করা হয়েছে!'
        );
        setTimeout(() => setStatusBanner(''), 4500);
      }
    } finally {
      setSavingProgram(false);
    }
  };

  const openCreateProjectModal = () => {
    setEditingProject(null);
    setProjectCode(`PRJ-2026-0${(projectsGallery?.length || 0) + 1}`);
    setProjectName('');
    setProjectCategory('জমি ও আবাসন প্রকল্প');
    setProjectBudget(500000);
    setProjectInvested(500000);
    setProjectLocation('বিরুলিয়া, সাভার, ঢাকা');
    setProjectStartDate(new Date().toISOString().slice(0, 10));
    setProjectStatus('চলমান প্রকল্প');
    setProjectDescription('');
    setProjectPhotoUrl('');
    setShowProjectModal(true);
  };

  const openEditProjectModal = (proj: SocietyProjectItem) => {
    setEditingProject(proj);
    setProjectCode(proj.projectCode || 'PRJ-2026-01');
    setProjectName(proj.projectName);
    setProjectCategory(proj.category || 'জমি ও আবাসন প্রকল্প');
    setProjectBudget(proj.budgetAmount || 0);
    setProjectInvested(proj.investedAmount || 0);
    setProjectLocation(proj.location || 'বিরুলিয়া, সাভার, ঢাকা');
    setProjectStartDate(proj.startDate || new Date().toISOString().slice(0, 10));
    setProjectStatus(proj.status || 'চলমান প্রকল্প');
    setProjectDescription(proj.description || '');
    setProjectPhotoUrl(proj.photoUrl || '');
    setShowProjectModal(true);
  };

  const handleProjectModalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 960, 0.85);
      if (dataUrl) {
        setProjectPhotoUrl(dataUrl);
        if (editingProject && projectName.trim()) {
          await fetch(`/api/society-projects/${editingProject.id}`, {
            method: 'PUT',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectCode: projectCode.trim(),
              projectName: projectName.trim(),
              category: projectCategory,
              budgetAmount: Number(projectBudget) || 0,
              investedAmount: Number(projectInvested) || 0,
              location: projectLocation.trim(),
              startDate: projectStartDate,
              status: projectStatus,
              description: projectDescription.trim(),
              photoUrl: dataUrl,
            }),
          });
          await onRefreshHomeData();
        }
      }
    } catch (err: any) {
      setStatusBanner(err.message || 'প্রকল্পের ছবি প্রসেস করতে সমস্যা হয়েছে।');
    }
  };

  const handleQuickProjectCardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !quickTargetProjectId) return;
    try {
      setSavingProject(true);
      const dataUrl = await compressImageFile(file, 960, 0.85);
      if (!dataUrl) return;
      const res = await fetch(`/api/society-projects/${quickTargetProjectId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: dataUrl }),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setStatusBanner('প্রকল্পের ছবি সফলভাবে ডাটাবেজে স্থায়ীভাবে সংরক্ষণ করা হয়েছে!');
        setTimeout(() => setStatusBanner(''), 4500);
      }
    } catch (err: any) {
      setStatusBanner(err.message || 'প্রকল্পের ছবি আপলোড করতে সমস্যা হয়েছে।');
    } finally {
      setSavingProject(false);
      setQuickTargetProjectId(null);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    try {
      setSavingProject(true);
      const url = editingProject
        ? `/api/society-projects/${editingProject.id}`
        : '/api/society-projects';
      const method = editingProject ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectCode: projectCode.trim(),
          projectName: projectName.trim(),
          category: projectCategory,
          budgetAmount: Number(projectBudget) || 0,
          investedAmount: Number(projectInvested) || 0,
          location: projectLocation.trim(),
          startDate: projectStartDate,
          status: projectStatus,
          description: projectDescription.trim(),
          photoUrl: projectPhotoUrl,
        }),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setShowProjectModal(false);
        setStatusBanner(
          editingProject
            ? 'প্রকল্পের ছবি ও তথ্য সফলভাবে আপডেট করা হয়েছে!'
            : 'নতুন প্রকল্প ও ছবি সফলভাবে হোম পেজে যুক্ত করা হয়েছে!'
        );
        setTimeout(() => setStatusBanner(''), 4500);
      }
    } finally {
      setSavingProject(false);
    }
  };

  const openBrandingStudio = (tab: 'LOGO' | 'INFO' | 'COMMITTEE' | 'RULES' = 'LOGO') => {
    setDraftBranding({
      ...branding,
      committeeRoles: { ...(branding.committeeRoles || {}) },
      rules: [...(branding.rules || [])],
    });
    setBrandingTab(tab);
    setShowBrandingModal(true);
  };

  // Direct quick logo file upload handler
  const handleQuickLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatusBanner('লোগো ফাইলের সাইজ ১০ মেগাবাইটের কম হতে হবে।');
      return;
    }
    try {
      const dataUrl = await compressImageFile(file, 640, 0.9);
      if (!dataUrl) return;
      const baseBranding = showBrandingModal ? draftBranding : branding;
      const updatedDraft = { ...baseBranding, logoUrl: dataUrl };
      setDraftBranding(updatedDraft);
      setSavingBranding(true);
      const res = await fetch('/api/society-branding', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDraft),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setStatusBanner('সমিতির নতুন লোগো ও তথ্য সফলভাবে ডাটাবেজে স্থায়ীভাবে সংরক্ষণ করা হয়েছে!');
        setTimeout(() => setStatusBanner(''), 4000);
      }
    } catch (err: any) {
      setStatusBanner(err.message || 'লোগো আপলোড করতে সমস্যা হয়েছে।');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingBranding(true);
      const res = await fetch('/api/society-branding', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(draftBranding),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setShowBrandingModal(false);
        setStatusBanner('হিলফুল ফুজুল সমবায় সমিতির হোম পেজ তথ্য ও লোগো আপডেট করা হয়েছে!');
        setTimeout(() => setStatusBanner(''), 4000);
      }
    } finally {
      setSavingBranding(false);
    }
  };

  const openCreateNotice = () => {
    setEditingNotice(null);
    setNoticeTitle('');
    setNoticeMessage('');
    setNoticeType('URGENT');
    setNoticeDate(new Date().toISOString().slice(0, 10));
    setNoticeRefNo(`HF-NOT-2026-${String((notices?.length || 0) + 1).padStart(2, '0')}`);
    setNoticeCreatedBy('সভাপতি ও সাধারণ সম্পাদক');
    setNoticePinned(true);
    setShowNoticeModal(true);
  };

  const openEditNotice = (n: SocietyNotice) => {
    setEditingNotice(n);
    setNoticeTitle(n.title);
    setNoticeMessage(n.message);
    setNoticeType(n.type || 'ANNOUNCEMENT');
    setNoticeDate(n.noticeDate || new Date().toISOString().slice(0, 10));
    setNoticeRefNo(n.refNo || '');
    setNoticeCreatedBy(n.createdBy || 'কার্যনির্বাহী কমিটি');
    setNoticePinned(Boolean(n.isPinned));
    setShowNoticeModal(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;
    try {
      setSavingNotice(true);
      const url = editingNotice ? `/api/notices/${editingNotice.id}` : '/api/notices';
      const method = editingNotice ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noticeTitle.trim(),
          message: noticeMessage.trim(),
          type: noticeType,
          isPinned: noticePinned,
          noticeDate,
          refNo: noticeRefNo.trim(),
          createdBy: noticeCreatedBy.trim(),
        }),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setShowNoticeModal(false);
        setStatusBanner(
          editingNotice
            ? 'নোটিশটি সফলভাবে সংশোধন করা হয়েছে!'
            : 'নতুন নোটিশ সফলভাবে হোম পেজে প্রকাশ করা হয়েছে!'
        );
        setTimeout(() => setStatusBanner(''), 4000);
      }
    } finally {
      setSavingNotice(false);
    }
  };

  const handleTogglePinNotice = async (n: SocietyNotice) => {
    if (!canManage) return;
    await fetch(`/api/notices/${n.id}`, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: !n.isPinned }),
    });
    await onRefreshHomeData();
  };

  const handleDeleteNotice = async (id: number) => {
    if (!canManage) return;
    const res = await fetch(`/api/notices/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      await onRefreshHomeData();
      setStatusBanner('নোটিশটি মুছে ফেলা হয়েছে।');
      setTimeout(() => setStatusBanner(''), 3000);
    }
  };

  const handleSaveMemberComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      setSavingComment(true);
      const url = editingCommentId
        ? `/api/member-comments/${editingCommentId}`
        : '/api/member-comments';
      const method = editingCommentId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: role === 'MEMBER' ? currentMemberId : selectedCommentMemberId,
          comment: newCommentText.trim(),
          category: newCommentCategory,
        }),
      });
      if (res.ok) {
        await onRefreshHomeData();
        setNewCommentText('');
        setEditingCommentId(null);
        setShowCommentForm(false);
        setStatusBanner(
          editingCommentId
            ? 'সদস্যের মন্তব্য সফলভাবে আপডেট করা হয়েছে!'
            : 'আপনার মন্তব্য সফলভাবে সমিতির হোমপেজে প্রকাশিত হয়েছে!'
        );
        setTimeout(() => setStatusBanner(''), 4000);
      }
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteMemberComment = async (id: number) => {
    const res = await fetch(`/api/member-comments/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      await onRefreshHomeData();
      setStatusBanner('মন্তব্যটি মুছে ফেলা হয়েছে।');
      setTimeout(() => setStatusBanner(''), 3000);
    }
  };

  const handleDeleteProgram = async (id: number) => {
    if (!canManage) return;
    const res = await fetch(`/api/society-programs/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      await onRefreshHomeData();
      setStatusBanner('প্রোগ্রাম অ্যালবামটি মুছে ফেলা হয়েছে।');
      setTimeout(() => setStatusBanner(''), 3000);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!canManage) return;
    const res = await fetch(`/api/society-projects/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      await onRefreshHomeData();
      setStatusBanner('প্রকল্পটি মুছে ফেলা হয়েছে।');
      setTimeout(() => setStatusBanner(''), 3000);
    }
  };

  const pinnedNotices = (notices || []).filter((n) => n.isPinned);
  const filteredNotices = (notices || []).filter((n) => {
    if (noticeFilter !== 'ALL' && n.type !== noticeFilter) return false;
    if (
      noticeSearch.trim() &&
      !`${n.title} ${n.message} ${n.refNo}`
        .toLowerCase()
        .includes(noticeSearch.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getCategoryLabel = (type: string) => {
    const found = NOTICE_CATEGORIES.find((c) => c.id === type);
    return found ? `${found.labelBn} (${found.labelEn})` : 'সাধারণ বিজ্ঞপ্তি';
  };

  // Merge member details with 2019–2026 collection & due statistics
  const enrichedMembers = (members || []).map((m) => {
    const chartItem = (memberDuesChart || []).find((c: any) => c.memberId === m.memberId);
    const committeeRole =
      branding.committeeRoles?.[m.memberId] || 'সম্মানিত সদস্য (Executive Member)';
    return {
      ...m,
      committeeRole,
      totalReceived2019To2026: chartItem?.totalReceived ?? m.totalDeposited ?? 0,
      due2019To2024: chartItem?.due2019To2024 ?? m.historicalDue2024 ?? 0,
      totalDue2019To2026:
        chartItem?.totalOutstanding2019To2026 ?? m.currentOutstanding ?? 0,
    };
  });

  const calcShare = calcMonths * 2000;
  const calcPayable = calcMonths * 50;
  const calcTotal = calcShare + calcPayable + Number(calcIncludeDown || 0);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const totalProjectBudget = (projectsGallery || []).reduce(
    (sum, p) => sum + (Number(p.budgetAmount) || 0),
    0
  );
  const totalProjectInvested = (projectsGallery || []).reduce(
    (sum, p) => sum + (Number(p.investedAmount || p.budgetAmount) || 0),
    0
  );

  return (
    <div id="section-top" className="space-y-8 pb-6">
      {/* Hidden file input for instant logo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickLogoUpload}
        className="hidden"
      />
      {/* Hidden file inputs for 1-click program photo & project photo replacement */}
      <input
        ref={quickProgramPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickProgramCardPhotoUpload}
        className="hidden"
      />
      <input
        ref={quickProjectPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickProjectCardPhotoUpload}
        className="hidden"
      />

      {/* Instant feedback banner */}
      {statusBanner && (
        <div className="flex items-center justify-between rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900 shadow-xs dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            className="text-teal-700 hover:text-teal-900 dark:text-teal-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
       * OFFICIAL WEBSITE QUICK-JUMP NAVIGATION BAR
       * =================================================================== */}
      <nav
        aria-label="হোম পেজ সেকশন নেভিগেশন"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print"
      >
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {[
            { id: 'section-hero', label: 'পরিচিতি ও তহবিল' },
            { id: 'section-notices', label: `নোটিশ বোর্ড (${(notices || []).length})` },
            { id: 'society-projects-showcase', label: `প্রকল্পসমূহ (${(projectsGallery || []).length})` },
            { id: 'society-programs-gallery', label: `প্রোগ্রাম গ্যালারি (${(programsGallery || []).length})` },
            { id: 'section-pillars', label: 'আর্থিক কাঠামো' },
            { id: 'section-members', label: `সদস্য ডিরেক্টরি (${enrichedMembers.length})` },
            { id: 'section-comments', label: 'সদস্যদের মতামত' },
            { id: 'section-constitution', label: 'ক্যালকুলেটর ও সংবিধান' },
          ].map((navItem) => (
            <button
              key={navItem.id}
              type="button"
              onClick={() => scrollToSection(navItem.id)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-300 whitespace-nowrap"
            >
              {navItem.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigateModule('RECEIPTS')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            মানি রশিদ
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('ACCOUNTING_REPORTS')}
            className="rounded-lg border border-teal-600/30 bg-teal-50/70 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-200 whitespace-nowrap"
          >
            ১৭টি অডিট রিপোর্ট
          </button>
        </div>
      </nav>

      {/* =====================================================================
       * TOP PINNED / URGENT NOTICE ALERT STRIP
       * =================================================================== */}
      {pinnedNotices.length > 0 && (
        <div className="rounded-2xl border border-amber-300/90 bg-amber-50/90 px-5 py-4 shadow-2xs dark:border-amber-800/80 dark:bg-amber-950/35">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold">সর্বশেষ জরুরি বিজ্ঞপ্তি</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{pinnedNotices[0].refNo}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">তারিখ: {pinnedNotices[0].noticeDate}</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                  {pinnedNotices[0].title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {pinnedNotices[0].message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setViewingNotice(pinnedNotices[0])}
                className="rounded-xl border border-amber-400 bg-white px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 whitespace-nowrap shrink-0"
              >
                পূর্ণ নোটিশ পড়ুন
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={openCreateNotice}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  নতুন নোটিশ দিন
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * SECTION 01: OFFICIAL WEBSITE HERO & EXECUTIVE TREASURY SUMMARY
       * =================================================================== */}
      <section
        id="section-hero"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
          {/* Left Column (7 cols): Society Identity, Narrative, Vision & Website CTAs */}
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
            <div className="space-y-6">
              {/* Institutional Kicker */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-teal-700 dark:text-teal-400">
                  ০১ · অফিসিয়াল ওয়েব পোর্টাল
                </span>
                <span aria-hidden="true">·</span>
                <span>{branding.establishedYear}</span>
                <span aria-hidden="true">·</span>
                <span>{branding.registrationInfo}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-teal-600" />
                  {branding.addressBn}
                </span>
              </div>

              {/* Official Logo & Title Lockup */}
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex flex-col items-start gap-2.5 shrink-0">
                  <SocietyLogoAvatar logoUrl={branding.logoUrl} size="xl" />
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
                      >
                        <Upload className="h-3 w-3 text-teal-600" />
                        লোগো আপলোড
                      </button>
                      <button
                        type="button"
                        onClick={() => openBrandingStudio('LOGO')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 whitespace-nowrap shrink-0"
                      >
                        প্রতীক বাছাই
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                    {branding.nameBn}
                  </h1>
                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                    {branding.nameEn}
                  </p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    “{branding.sloganBn}”
                  </p>
                </div>
              </div>

              {/* About the Cooperative Society */}
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {branding.aboutBn}
              </p>

              {/* Vision & Mission Card */}
              <div className="rounded-xl border border-teal-500/25 bg-teal-50/40 p-4 dark:border-teal-900/50 dark:bg-teal-950/25">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    সমিতির লক্ষ্য ও দীর্ঘমেয়াদী রূপকল্প (Our Vision & Commitment)
                  </p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {branding.visionBn}
                </p>
              </div>
            </div>

            {/* Organized Primary Website Action Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-5 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => onNavigateModule('YEARLY_ACCOUNTING')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 whitespace-nowrap shrink-0"
              >
                বাৎসরিক ও মাসিক হিসাব লেজার
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateModule(role === 'MEMBER' ? 'MEMBER_PORTAL' : 'DASHBOARD')
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0"
              >
                {role === 'MEMBER' ? 'আমার সদস্য পোর্টাল' : 'আর্থিক ড্যাশবোর্ড (২০১৯–২০২৬)'}
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('society-projects-showcase')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-50/70 px-3.5 py-2.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-600/40 dark:bg-teal-950/50 dark:text-teal-200 whitespace-nowrap shrink-0"
              >
                <Briefcase className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                প্রকল্প ও বিনিয়োগ
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('society-programs-gallery')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ফটো গ্যালারি
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openBrandingStudio('INFO')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
                >
                  <Settings className="h-3.5 w-3.5 text-teal-600" />
                  হোম পেজ সেটিংস
                </button>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Executive Financial & Treasury Summary */}
          <div className="flex flex-col justify-between border-t border-slate-200 bg-slate-900 p-6 text-slate-100 sm:p-8 lg:col-span-5 lg:border-t-0 lg:border-l dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-medium text-teal-400">
                    সমিতির কেন্দ্রীয় তহবিল প্রতিবেদন
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-white">
                    আর্থিক সারসংক্ষেপ (২০১৯ – ২০২৬)
                  </h2>
                </div>
                <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs text-teal-300">
                  ৳ BDT · ৮ বছর
                </span>
              </div>

              {/* Primary Highlight: Total Collection */}
              <div className="rounded-xl border border-teal-500/30 bg-teal-950/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-teal-200">
                    সর্বমোট আদায়কৃত তহবিল (২০১৯–২০২৬)
                  </span>
                  <span className="font-mono text-[11px] text-teal-300">১২ জন সদস্য</span>
                </div>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
                  {formatBDT(kpis.totalCollection || 2719360)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  শেয়ার আমানত, মাসিক প্রদেয়, জরিমানা, ডাউন পেমেন্ট ও অন্যান্য জমার সমন্বিত যোগফল
                </p>
              </div>

              {/* 4 Key Financial Breakdown Cards */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5">
                  <p className="text-[11px] text-slate-400">
                    {role === 'MEMBER' ? 'আপনার মোট শেয়ার আমানত' : 'মোট শেয়ার আমানত'}
                  </p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-teal-400">
                    {formatBDT(
                      role === 'MEMBER'
                        ? members.find((m) => m.memberId === currentMemberId)
                            ?.lifetimeShareDeposit ??
                            kpis.totalShareDeposits ??
                            1655000
                        : kpis.totalShareDeposits || 1655000
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5">
                  <p className="text-[11px] text-slate-400">মোট ডাউন পেমেন্ট</p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-400">
                    {formatBDT(
                      role === 'MEMBER'
                        ? members.find((m) => m.memberId === currentMemberId)
                            ?.lifetimeDownPayment ??
                            kpis.totalDownPayments ??
                            1026270
                        : kpis.totalDownPayments || 1026270
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5">
                  <p className="text-[11px] text-slate-400">সর্বমোট অনুমোদিত ব্যয়</p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-rose-400">
                    {formatBDT(kpis.totalExpenses ?? 2526729)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5">
                  <p className="text-[11px] text-slate-400">
                    {role === 'MEMBER' ? 'আপনার মোট বকেয়া' : 'সকল সদস্যের মোট বকেয়া'}
                  </p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-amber-400">
                    {formatBDT(
                      role === 'MEMBER'
                        ? members.find((m) => m.memberId === currentMemberId)
                            ?.currentOutstanding ??
                            kpis.totalOutstandingDues ??
                            431610
                        : kpis.totalOutstandingDues ?? 431610
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-300">
              <span>চলমান মাসিক কিস্তির হার: ৳২,০৫০</span>
              <span className="font-mono font-bold text-emerald-400">
                নিট ক্যাশ ও ব্যাংক স্থিতি: {formatBDT(kpis.availableCashBalance ?? 198851)}
              </span>
            </div>
          </div>
        </div>

        {/* Full-Width 5-Column Proof & Key Metrics Row Below Hero Split */}
        <div className="grid grid-cols-1 divide-y divide-slate-200 border-t border-slate-200 bg-slate-50/70 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-5 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ০১ · প্রতিষ্ঠাতা ও সক্রিয় সদস্য
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {kpis.totalMembers || 12} জন সদস্য
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              সদস্য আইডি: #02, #04, #05, #06, #07, #09, #10, #11, #12, #14, #15, #16
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ০২ · সর্বমোট আদায়কৃত অর্থ (২০১৯–২৬)
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatBDT(kpis.totalCollection || 2719360)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ৮টি বার্ষিক হিসাব শিট থেকে সমন্বিত মোট জমা
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ০৩ · সর্বমোট খরচ (২০১৯–২৬)
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {formatBDT(kpis.totalExpenses ?? 2526729)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              জমি ও প্রকল্প বিনিয়োগ এবং পরিচালন ব্যয়সহ
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ০৪ · অবশিষ্ট নিট তহবিল
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
              {formatBDT(kpis.availableCashBalance ?? 198851)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              মোট আদায় ও আয় থেকে সর্বমোট খরচ বাদে স্থিতি
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {role === 'MEMBER'
                ? '০৫ · আপনার মোট বকেয়া'
                : '০৫ · সকল সদস্যের মোট বকেয়া'}
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {formatBDT(
                role === 'MEMBER'
                  ? members.find((m) => m.memberId === currentMemberId)?.currentOutstanding ??
                      kpis.totalOutstandingDues ??
                      431610
                  : kpis.totalOutstandingDues ?? 431610
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ২০১৯–২৪ বকেয়া + ২০২৫–২৬ চলমান কিস্তি
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
       * SECTION 02: OFFICIAL NOTICE BOARD & ANNOUNCEMENTS (নোটিশ বোর্ড)
       * =================================================================== */}
      <section
        id="section-notices"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              ০২ · অফিসিয়াল বিজ্ঞপ্তি ও সভার নোটিশ
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              নোটিশ বোর্ড ও অফিসিয়াল ঘোষণা (Official Notice Board)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              হিলফুল ফুজুল সমবায় সমিতির জরুরি ঘোষণা, সাধারণ সভার আহ্বান, মাসিক কিস্তির তাগাদা ও নীতিমালা
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreateNotice}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              নতুন নোটিশ প্রকাশ করুন
            </button>
          )}
        </div>

        {/* Filter Bar & Search */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {NOTICE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setNoticeFilter(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  noticeFilter === cat.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-teal-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                {cat.labelBn}
              </button>
            ))}
          </div>

          <div className="relative min-w-[230px]">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={noticeSearch}
              onChange={(e) => setNoticeSearch(e.target.value)}
              placeholder="নোটিশ খুঁজুন (শিরোনাম বা স্মারক নং)..."
              className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Notice Cards Grid */}
        {filteredNotices.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              এই ক্যাটাগরিতে কোনো নোটিশ পাওয়া যায়নি।
            </p>
            {canManage && (
              <button
                type="button"
                onClick={openCreateNotice}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                প্রথম নোটিশ যুক্ত করুন
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredNotices.map((notice) => (
              <article
                key={notice.id}
                className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                  notice.isPinned
                    ? 'border-amber-300 bg-amber-50/25 dark:border-amber-800/70 dark:bg-amber-950/20'
                    : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/40'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          notice.type === 'URGENT'
                            ? 'font-bold text-amber-700 dark:text-amber-400'
                            : 'font-semibold text-teal-700 dark:text-teal-400'
                        }
                      >
                        {getCategoryLabel(notice.type)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{notice.refNo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{notice.noticeDate}</span>
                    </div>

                    {notice.isPinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        <Pin className="h-3 w-3" />
                        পিন করা নোটিশ
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2.5 text-base font-bold text-slate-900 dark:text-white">
                    {notice.title}
                  </h3>

                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {notice.message}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3 text-xs dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    প্রচারে:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {notice.createdBy}
                    </strong>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingNotice(notice)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
                    >
                      <Printer className="h-3 w-3" />
                      অফিসিয়াল ভিউ / প্রিন্ট
                    </button>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTogglePinNotice(notice)}
                          title={notice.isPinned ? 'পিন সরান' : 'হোম পেজের উপরে পিন করুন'}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                            notice.isPinned
                              ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {notice.isPinned ? 'আনপিন' : 'পিন করুন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditNotice(notice)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNotice(notice.id)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          ডিলিট
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================================
       * SECTION 03: SOCIETY PROJECTS SHOWCASE & INVESTMENT PORTFOLIO
       * =================================================================== */}
      <section
        id="society-projects-showcase"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              ০৩ · প্রকল্প ও বিনিয়োগ পোর্টফোলিও
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              সমিতির চলমান ও বাস্তবায়িত প্রকল্পসমূহ (Projects & Investment Portfolio)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              হিলফুল ফুজুল সমবায় সমিতির জমি, আবাসন, কৃষি ও হালাল বাণিজ্য প্রকল্পসমূহের বিবরণ ও সাইট গ্যালারি
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openCreateProjectModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              নতুন প্রকল্প ও ছবি যুক্ত করুন
            </button>
            <button
              type="button"
              onClick={() => onNavigateModule('LOANS_INVESTMENTS')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              বিনিয়োগ লেজার দেখুন
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Project Summary Bar */}
        <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-950/50">
          <div>
            <p className="text-[11px] text-slate-500">মোট তালিকাভুক্ত প্রকল্প</p>
            <p className="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-white">
              {(projectsGallery || []).length}টি প্রকল্প
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">সম্মিলিত প্রাক্কলিত বাজেট</p>
            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-teal-700 dark:text-teal-400">
              {formatBDT(totalProjectBudget)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">মোট বিনিয়োগকৃত অর্থ</p>
            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatBDT(totalProjectInvested)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(projectsGallery || []).map((proj) => (
            <article
              key={proj.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 transition-all hover:border-teal-500/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div>
                {/* Project Visual Banner / Uploaded Photo */}
                <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950">
                  {proj.photoUrl ? (
                    <img
                      src={proj.photoUrl}
                      alt={proj.projectName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                      onClick={() =>
                        setLightboxItem({
                          title: proj.projectName,
                          subtitle: `${proj.projectCode} · ${proj.category} · ${proj.location}`,
                          description: proj.description,
                          photoUrl: proj.photoUrl,
                        })
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white">
                      <svg viewBox="0 0 120 70" className="h-20 w-32 opacity-85">
                        <rect x="10" y="30" width="30" height="32" rx="3" fill="#0d9488" />
                        <rect x="45" y="16" width="35" height="46" rx="3" fill="#10b981" />
                        <polygon points="45,16 62.5,4 80,16" fill="#34d399" />
                        <circle cx="98" cy="24" r="9" fill="#fbbf24" />
                        <path
                          d="M5 62 Q60 55 115 62"
                          stroke="#5eead4"
                          strokeWidth="3"
                          fill="none"
                        />
                      </svg>
                      <p className="mt-2 text-xs font-bold text-teal-200">{proj.category}</p>
                      <p className="mt-0.5 text-[11px] text-slate-300">
                        এই প্রকল্পের বাস্তব ছবি আপলোড করতে নিচের &quot;প্রকল্পের ছবি যুক্ত করুন&quot; বাটনে ক্লিক করুন
                      </p>
                    </div>
                  )}

                  {/* Top overlay status & code */}
                  <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2 pointer-events-none">
                    <span className="rounded-lg bg-slate-950/80 px-2.5 py-1 font-mono text-[11px] font-bold text-teal-300 backdrop-blur-xs">
                      {proj.projectCode}
                    </span>
                    <span className="rounded-lg bg-emerald-600/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                      {proj.status}
                    </span>
                  </div>

                  {/* Bottom overlay quick photo upload & fullscreen triggers */}
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickTargetProjectId(proj.id);
                        quickProjectPhotoInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-md backdrop-blur-xs hover:bg-teal-600"
                    >
                      <Camera className="h-3.5 w-3.5 text-teal-300" />
                      {proj.photoUrl ? 'ছবি পরিবর্তন করুন' : 'প্রকল্পের ছবি যুক্ত করুন'}
                    </button>
                    {proj.photoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxItem({
                            title: proj.projectName,
                            subtitle: `${proj.projectCode} · ${proj.category} · ${proj.location}`,
                            description: proj.description,
                            photoUrl: proj.photoUrl,
                          })
                        }
                        className="inline-flex items-center justify-center rounded-lg bg-slate-900/85 p-1.5 text-white hover:bg-teal-600"
                        title="বড় করে ছবি দেখুন"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Project Body Info */}
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-teal-700 dark:text-teal-400">
                    <span className="font-semibold">{proj.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3 w-3 text-teal-600" />
                      {proj.location}
                    </span>
                  </div>

                  <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
                    {proj.projectName}
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {proj.description}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <p className="text-[11px] text-slate-500">প্রকল্প বাজেট / বরাদ্দ</p>
                      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-teal-700 dark:text-teal-400">
                        {formatBDT(proj.budgetAmount || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">বিনিয়োগকৃত অর্থ</p>
                      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatBDT(proj.investedAmount || proj.budgetAmount || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 px-5 py-3 text-xs dark:border-slate-800">
                <span className="font-mono text-[11px] text-slate-500">
                  শুরুর তারিখ: {proj.startDate}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickTargetProjectId(proj.id);
                      quickProjectPhotoInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300"
                  >
                    <Upload className="h-3 w-3" />
                    ছবি আপলোড
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditProjectModal(proj)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Edit3 className="h-3 w-3" />
                    এডিট
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800/60 dark:bg-slate-800 dark:text-rose-400"
                      title="প্রকল্প মুছে ফেলুন"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* =====================================================================
       * SECTION 04: SOCIETY PROGRAMS & EVENTS PHOTO GALLERY
       * =================================================================== */}
      <section
        id="society-programs-gallery"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              ০৪ · প্রোগ্রাম ও ইভেন্ট আর্কাইভ
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              সমিতির প্রোগ্রাম, সাধারণ সভা ও ফটো গ্যালারি (Event Photo Gallery)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              সাধারণ সভা, ইফতার মাহফিল, প্রকল্প পরিদর্শন ও বার্ষিক মিলনমেলার স্মরণীয় মুহূর্তগুলোর অ্যালবাম
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateProgramModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 whitespace-nowrap shrink-0"
          >
            <Camera className="h-4 w-4" />
            নতুন প্রোগ্রামের ছবি আপলোড করুন
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {PROGRAM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setProgramFilter(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  programFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-emerald-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            মোট সংরক্ষিত অ্যালবাম: {(programsGallery || []).length}টি
          </span>
        </div>

        {/* Programs Photo Grid */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(programsGallery || [])
            .filter((p) => programFilter === 'সকল প্রোগ্রাম' || p.category === programFilter)
            .map((prog) => (
              <article
                key={prog.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 transition-all hover:border-emerald-500/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div>
                  {/* Program Photo Display */}
                  <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950">
                    {prog.photoUrl ? (
                      <img
                        src={prog.photoUrl}
                        alt={prog.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                        onClick={() =>
                          setLightboxItem({
                            title: prog.title,
                            subtitle: `${prog.category} · তারিখ: ${prog.programDate} · স্থান: ${prog.location}`,
                            description: prog.description,
                            photoUrl: prog.photoUrl,
                          })
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-5 text-center text-white">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/20 text-emerald-300">
                          <Camera className="h-6 w-6" />
                        </div>
                        <p className="mt-2.5 text-xs font-bold text-emerald-200">{prog.category}</p>
                        <p className="mt-1 text-[11px] text-slate-300">
                          মোবাইল বা কম্পিউটার থেকে এই প্রোগ্রামের ছবি আপলোড করুন
                        </p>
                      </div>
                    )}

                    {/* Category Badge */}
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <span className="rounded-lg bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-xs">
                        {prog.category}
                      </span>
                    </div>

                    {/* Quick Upload / Lightbox Triggers */}
                    <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTargetProgramId(prog.id);
                          quickProgramPhotoInputRef.current?.click();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-md backdrop-blur-xs hover:bg-emerald-600"
                      >
                        <Camera className="h-3 w-3 text-emerald-300" />
                        {prog.photoUrl ? 'ছবি পরিবর্তন' : 'ছবি যুক্ত করুন'}
                      </button>
                      {prog.photoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxItem({
                              title: prog.title,
                              subtitle: `${prog.category} · তারিখ: ${prog.programDate} · স্থান: ${prog.location}`,
                              description: prog.description,
                              photoUrl: prog.photoUrl,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-lg bg-slate-900/85 p-1.5 text-white hover:bg-emerald-600"
                          title="পূর্ণ পর্দায় ছবি দেখুন"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Program Caption & Meta */}
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-emerald-600" />
                        {prog.programDate}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-emerald-600" />
                        {prog.location}
                      </span>
                    </div>

                    <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                      {prog.title}
                    </h3>

                    {prog.description && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {prog.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-2.5 text-[11px] dark:border-slate-800">
                  <span className="truncate text-slate-500">আপলোড: {prog.uploadedBy}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickTargetProgramId(prog.id);
                        quickProgramPhotoInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
                    >
                      <Upload className="h-3 w-3" />
                      ছবি
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditProgramModal(prog)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      এডিট
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProgram(prog.id)}
                        className="rounded-md border border-rose-200 bg-white px-1.5 py-1 font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800/60 dark:bg-slate-800 dark:text-rose-400"
                        title="প্রোগ্রাম মুছে ফেলুন"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </div>
      </section>

      {/* =====================================================================
       * SECTION 05: COOPERATIVE PILLARS & HISTORICAL STRUCTURE (BENTO GRID)
       * =================================================================== */}
      <section
        id="section-pillars"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            ০৫ · মূলধন গঠন ও হিসাব কাঠামো
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
            সমিতির আর্থিক কাঠামো ও পরিচালন নীতিমালা (২০১৯ – ২০২৬)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            হিলফুল ফুজুল সমবায় সমিতির ৮ বছরের ধারাবাহিক মূলধন গঠন ও স্বচ্ছ হিসাব ব্যবস্থাপনার মূল ভিত্তি
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Card 01 (col-span-2): Monthly Installment Evolution 2019–2026 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              01. মাসিক শেয়ার আমানত ও প্রদেয় জমার ধারাবাহিক বিবরণী (২০১৯–২০২৬)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              প্রতিষ্ঠালগ্ন থেকে অদ্যবধি সদস্যদের মাসিক কিস্তির হার ও বার্ষিক সঞ্চয় কাঠামো
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                  অর্থবছর ২০১৯ (প্রথম বর্ষ)
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  ৳১,০২০ / মাস
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  শেয়ার আমানত: ৳১,০০০ · প্রদেয়: ৳২০ · বার্ষিক মোট: ৳১২,২৪০
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                  অর্থবছর ২০২০ (দ্বিতীয় বর্ষ)
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  ৳১,৫২০ / মাস
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  শেয়ার আমানত: ৳১,৫০০ · প্রদেয়: ৳২০ · বার্ষিক মোট: ৳১৮,২৪০
                </p>
              </div>

              <div className="rounded-xl border border-teal-500/40 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-950/30">
                <p className="font-mono text-xs font-bold text-teal-800 dark:text-teal-300">
                  অর্থবছর ২০২১ – ২০২৬ (চলমান)
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-teal-900 dark:text-white">
                  ৳২,০৫০ / মাস
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  শেয়ার আমানত: ৳২,০০০ · প্রদেয়: ৳৫০ · বার্ষিক মোট: ৳২৪,৬০০
                </p>
              </div>
            </div>
          </div>

          {/* Card 02 (col-span-1): Capital Down Payment Reserve */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              02. বিশেষ ডাউন পেমেন্ট তহবিল
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              সমিতির বৃহৎ বিনিয়োগ তহবিল গঠনের লক্ষ্যে গৃহীত ডাউন পেমেন্ট প্রকল্প
            </p>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">২০২২ বিশেষ ডাউন পেমেন্ট:</span>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  ৳৭০,০০০ / সদস্য
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">২০২৪ ডাউন পেমেন্ট কিস্তি:</span>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  ৳১২,০০০ / সদস্য
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-teal-700 dark:text-teal-400">
                  মোট সংগৃহীত ডাউন পেমেন্ট:
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-teal-700 dark:text-teal-400">
                  {formatBDT(kpis.totalDownPayments || 1026270)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 03 (col-span-1): Transparent Reconciled Arrears */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              03. স্বচ্ছ বকেয়া ও সমন্বয় হিসাব
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              ২০১৯ থেকে ২০২৪ সাল পর্যন্ত কেবল সদস্য #09 (৳২৩,৮১০) এবং সদস্য #14 (৳১,১৫০)-এর বকেয়া রয়েছে; অন্য ১০ জন সদস্যের ২০১৯–২০২৪ বকেয়া ৳০। প্রতিটি সদস্যের জমা ও বকেয়া স্বয়ংক্রিয়ভাবে রিকনসাইলকৃত।
            </p>
            <button
              type="button"
              onClick={() => onNavigateModule('DASHBOARD')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
            >
              সদস্যভিত্তিক বকেয়া চার্ট দেখুন
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Card 04 (col-span-2): Official Receipts & 17 Reports */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              04. স্বয়ংক্রিয় ডাবল-এন্ট্রি লেজার, মানি রশিদ ও ১৭টি আর্থিক প্রতিবেদন
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              প্রতিটি লেনদেনের সাথে সাথে ক্যাশ/ব্যাংক ডেবিট এবং শেয়ার/প্রদেয় ক্রেডিট হয়ে স্বয়ংক্রিয় জার্নাল ও অফিসিয়াল মানি রশিদ তৈরি হয়
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateModule('RECEIPTS')}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                অফিসিয়াল মানি রশিদ আর্কাইভ
              </button>
              <button
                type="button"
                onClick={() => onNavigateModule('ACCOUNTING_REPORTS')}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                ট্রায়াল ব্যালেন্স ও ১৭টি অডিট রিপোর্ট
              </button>
              <button
                type="button"
                onClick={() => onNavigateModule('LOANS_INVESTMENTS')}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                বিনিয়োগ ও ঋণ ব্যবস্থাপনা
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
       * SECTION 06: EXECUTIVE COMMITTEE & FOUNDING MEMBERS DIRECTORY (12 MEMBERS)
       * =================================================================== */}
      <section
        id="section-members"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              ০৬ · সম্মানিত সদস্য ডিরেক্টরি
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              কার্যনির্বাহী পরিষদ ও সম্মানিত সদস্যবৃন্দ (Founding & Active Members)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              হিলফুল ফুজুল সমবায় সমিতির ১২ জন সম্মানিত সদস্যের পদবী, নমিনি, মোট জমা ও বর্তমান বকেয়া বিবরণী (২০১৯–২০২৬)
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => openBrandingStudio('COMMITTEE')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <Edit3 className="h-3.5 w-3.5" />
              কমিটির পদবী সংশোধন করুন
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrichedMembers.map((m: any) => (
            <div
              key={m.memberId}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-teal-600/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div>
                {/* Top Identity Header: Member Photo + Designation & Name */}
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => onOpenMemberProfile?.(m, false)}
                    title="সদস্যের পূর্ণ প্রোফাইল ও ছবি দেখুন"
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-teal-500/40 bg-teal-50 shadow-xs transition-transform group-hover:scale-105 dark:bg-slate-800"
                  >
                    {m.photoUrl ? (
                      <img
                        src={m.photoUrl}
                        alt={m.nameBn || m.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                        <span>#{m.memberId}</span>
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400">
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 font-mono font-bold dark:bg-teal-950/80">
                        #{m.memberId}
                      </span>
                      <span className="truncate font-semibold">{m.committeeRole}</span>
                    </div>
                    <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                      {m.nameBn || m.name}
                    </h3>
                    <p className="truncate text-[11px] text-slate-500">
                      {m.name} · <span className="font-mono">{m.mobile}</span>
                    </p>
                  </div>
                </div>

                {/* Nominee Identity Mini-Card with Nominee Photo Avatar */}
                <div className="mt-3.5 flex items-center justify-between gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2.5 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenMemberProfile?.(m, false)}
                      title="নমিনির ছবি আপলোড বা প্রোফাইল দেখুন"
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-emerald-400/60 bg-white shadow-2xs dark:bg-slate-800"
                    >
                      {m.nomineePhotoUrl ? (
                        <img
                          src={m.nomineePhotoUrl}
                          alt={m.nomineeName || 'নমিনি'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span>নমিনি</span>
                        </div>
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400">
                        মনোনীত নমিনি ({m.nomineeSharePercent || 100}%)
                      </p>
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {m.nomineeName || 'নির্ধারিত নমিনি'}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        সম্পর্ক: {m.nomineeRelation || 'স্ত্রী / পরিবার'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenMemberProfile?.(m, canManage)}
                    className="shrink-0 rounded-lg border border-emerald-500/40 bg-white px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-slate-900 dark:text-emerald-300"
                    title={canManage ? 'নমিনির ছবি ও তথ্য আপডেট করুন' : 'নিজের ও নমিনির ছবি পোস্ট করুন'}
                  >
                    {canManage ? 'ছবি/এডিট' : 'ছবি পোস্ট'}
                  </button>
                </div>

                {/* Financial Summary */}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
                  <div>
                    <p className="text-[11px] text-slate-500">মোট জমা (২০১৯–২৬)</p>
                    <p className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatBDT(m.totalReceived2019To2026)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">
                      {role === 'MEMBER' ? 'আপনার মোট বকেয়া' : 'মোট বকেয়া (২০১৯–২৬)'}
                    </p>
                    <p className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatBDT(m.totalDue2019To2026)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onOpenMemberProfile?.(m, false)}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-700 whitespace-nowrap shadow-2xs"
                >
                  <User className="h-3 w-3" />
                  প্রোফাইল ও নমিনি সনদ
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMemberLedger(m.memberId)}
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-400 whitespace-nowrap"
                >
                  ব্যক্তিগত লেজার
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
       * SECTION 07: MEMBER COMMENTS & VOICES WALL (সদস্যদের মন্তব্য ও মতামত)
       * =================================================================== */}
      <section
        id="section-comments"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              ০৭ · সদস্যদের অনুভূতি ও পরামর্শ
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
              সম্মানিত সদস্যদের মন্তব্য ও মতামত (Member Voices & Feedback)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              হিলফুল ফুজুল সমবায় সমিতির সম্মানিত সদস্যদের প্রকাশিত মতামত, পরামর্শ ও ভবিষ্যৎ উন্নয়ন প্রস্তাবনা
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingCommentId(null);
              setNewCommentText('');
              setSelectedCommentMemberId(currentMemberId || '09');
              setShowCommentForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 whitespace-nowrap shrink-0"
          >
            <MessageSquarePlus className="h-4 w-4" />
            {showCommentForm ? 'ফর্ম বন্ধ করুন' : 'আপনার মন্তব্য প্রকাশ করুন'}
          </button>
        </div>

        {/* Interactive Publish / Edit Comment Form */}
        {showCommentForm && (
          <form
            onSubmit={handleSaveMemberComment}
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50/40 p-5 space-y-4 text-xs dark:border-teal-800/60 dark:bg-teal-950/25"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingCommentId
                  ? 'মন্তব্য সংশোধন করুন (Edit Member Comment)'
                  : 'সমিতির হোমপেজে নতুন মন্তব্য প্রকাশ করুন'}
              </h3>
              <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                সদস্য প্রোফাইলের সাথে স্বয়ংক্রিয়ভাবে যুক্ত হবে
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  সদস্য নির্বাচন করুন
                </label>
                <select
                  disabled={role === 'MEMBER'}
                  value={role === 'MEMBER' ? currentMemberId : selectedCommentMemberId}
                  onChange={(e) => setSelectedCommentMemberId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {enrichedMembers.map((m: any) => (
                    <option key={m.memberId} value={m.memberId}>
                      #{m.memberId} — {m.nameBn || m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  মন্তব্যের বিষয় / ধরন
                </label>
                <select
                  value={newCommentCategory}
                  onChange={(e) => setNewCommentCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="সদস্যের মতামত ও পরামর্শ">সদস্যের মতামত ও পরামর্শ</option>
                  <option value="বিনিয়োগ ও উন্নয়ন প্রস্তাবনা">বিনিয়োগ ও উন্নয়ন প্রস্তাবনা</option>
                  <option value="শুভেচ্ছা ও সন্তুষ্টি বার্তা">শুভেচ্ছা ও সন্তুষ্টি বার্তা</option>
                  <option value="সাধারণ সভা সংক্রান্ত প্রস্তাব">সাধারণ সভা সংক্রান্ত প্রস্তাব</option>
                  <option value="কার্যনির্বাহী কমিটির বার্তা">কার্যনির্বাহী কমিটির বার্তা</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingComment}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {savingComment
                    ? 'প্রকাশ হচ্ছে...'
                    : editingCommentId
                    ? 'মন্তব্য আপডেট করুন'
                    : 'হোমপেজে প্রকাশ করুন'}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                আপনার মন্তব্য বা পরামর্শ লিখুন *
              </label>
              <textarea
                rows={3}
                required
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="হিলফুল ফুজুল সমবায় সমিতির কার্যক্রম, ভবিষ্যৎ বিনিয়োগ পরিকল্পনা বা সেবা সম্পর্কে আপনার মতামত এখানে লিখুন..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </form>
        )}

        {/* Published Member Comments Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberComments.map((item) => {
            const canEditComment =
              role === 'SUPER_ADMIN' ||
              role === 'ADMIN' ||
              (role === 'MEMBER' && currentMemberId === item.memberId);
            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition-colors hover:border-teal-500/50 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-teal-500/40 bg-teal-50 dark:bg-slate-800">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.memberNameBn}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                            #{item.memberId}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                          <span className="font-mono font-bold">সদস্য #{item.memberId}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.committeeRole || 'সম্মানিত সদস্য'}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.memberNameBn}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="inline-block rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                      {item.category}
                    </span>
                    <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      “{item.comment}”
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
                  <span className="font-mono">তারিখ: {item.commentDate}</span>
                  {canEditComment && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(item.id);
                          setSelectedCommentMemberId(item.memberId);
                          setNewCommentCategory(item.category);
                          setNewCommentText(item.comment);
                          setShowCommentForm(true);
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        এডিট
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMemberComment(item.id)}
                        className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        ডিলিট
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
       * SECTION 08: INSTALLMENT CALCULATOR & SOCIETY CONSTITUTION / CONTACT
       * =================================================================== */}
      <section
        id="section-constitution"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        {/* Left 5 Cols: Interactive Monthly Share & Installment Calculator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            ০৮ · সঞ্চয় পরিকল্পনা টুল
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              মাসিক কিস্তি ও সঞ্চয় ক্যালকুলেটর (Installment Calculator)
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            বর্তমান হার (মাসিক শেয়ার ৳২,০০০ + প্রদেয় ৳৫০ = ৳২,০৫০) অনুযায়ী আপনার প্রদেয় হিসাব করুন
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                কত মাসের কিস্তি হিসাব করতে চান? ({calcMonths} মাস)
              </label>
              <input
                type="range"
                min={1}
                max={36}
                value={calcMonths}
                onChange={(e) => setCalcMonths(Number(e.target.value))}
                className="mt-2 w-full accent-teal-600"
              />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
                <span>১ মাস</span>
                <span>১২ মাস (১ বছর)</span>
                <span>২৪ মাস (২ বছর)</span>
                <span>৩৬ মাস</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                অতিরিক্ত ডাউন পেমেন্ট বা বকেয়া সমন্বয় (ঐচ্ছিক ৳)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={calcIncludeDown}
                onChange={(e) => setCalcIncludeDown(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs dark:border-slate-800 dark:bg-slate-950">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  মোট শেয়ার আমানত ({calcMonths} × ৳২,০০০):
                </span>
                <span className="font-mono font-bold tabular-nums">
                  {formatBDT(calcShare)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  মোট মাসিক প্রদেয় ({calcMonths} × ৳৫০):
                </span>
                <span className="font-mono font-bold tabular-nums">
                  {formatBDT(calcPayable)}
                </span>
              </div>
              {calcIncludeDown > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    ডাউন পেমেন্ট / বকেয়া সমন্বয়:
                  </span>
                  <span className="font-mono font-bold tabular-nums">
                    {formatBDT(calcIncludeDown)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-teal-700 dark:border-slate-800 dark:text-teal-400">
                <span>সর্বমোট প্রদেয় পরিমাণ:</span>
                <span className="font-mono tabular-nums">{formatBDT(calcTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Society Constitution / Rules & Contact Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                গঠনতন্ত্র ও নীতিমালা
              </p>
              <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                সমিতির সংবিধান, নিয়মাবলী ও কার্যালয় যোগাযোগ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                হিলফুল ফুজুল সমবায় সমিতির সদস্যদের জন্য প্রযোজ্য সাধারণ নিয়মাবলী
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => openBrandingStudio('RULES')}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
              >
                নিয়মাবলী ও ঠিকানা এডিট
              </button>
            )}
          </div>

          <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {(branding.rules || []).map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  0{idx + 1}.
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 text-xs sm:grid-cols-3 dark:border-slate-800">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">কার্যালয়ের ঠিকানা</p>
                <p className="text-slate-500 dark:text-slate-400">{branding.addressBn}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">যোগাযোগ নম্বর</p>
                <p className="font-mono text-slate-500 dark:text-slate-400">{branding.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">কিস্তি ও সভার সময়সূচি</p>
                <p className="text-slate-500 dark:text-slate-400">{branding.meetingScheduleBn}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
       * OFFICIAL COOPERATIVE SOCIETY WEBSITE FOOTER
       * =================================================================== */}
      <footer className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-slate-300 dark:border-slate-800 dark:bg-slate-950 no-print">
        <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 md:grid-cols-2 lg:grid-cols-12">
          {/* Col 1 (4 cols): Brand Identity */}
          <div className="space-y-3 lg:col-span-4">
            <div className="flex items-center gap-3">
              <SocietyLogoAvatar logoUrl={branding.logoUrl} size="md" />
              <div>
                <h3 className="text-base font-bold text-white">{branding.nameBn}</h3>
                <p className="text-xs font-medium text-teal-400">{branding.nameEn}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              “{branding.sloganBn}” — {branding.establishedYear}। পারস্পরিক আস্থা, স্বচ্ছ হিসাবরক্ষণ এবং হালাল ও কল্যাণমুখী বিনিয়োগে অঙ্গীকারবদ্ধ।
            </p>
            <div className="pt-1 text-[11px] text-slate-400">
              <span>{branding.registrationInfo}</span>
            </div>
          </div>

          {/* Col 2 (3 cols): Website Sections */}
          <div className="space-y-2.5 lg:col-span-3">
            <h4 className="text-xs font-bold tracking-wider text-white uppercase">
              ওয়েবসাইট সেকশনসমূহ
            </h4>
            <ul className="space-y-1.5 text-xs">
              {[
                { id: 'section-hero', label: 'সমিতি পরিচিতি ও কেন্দ্রীয় তহবিল' },
                { id: 'section-notices', label: 'অফিসিয়াল নোটিশ বোর্ড' },
                { id: 'society-projects-showcase', label: 'প্রকল্প ও বিনিয়োগ পোর্টফোলিও' },
                { id: 'society-programs-gallery', label: 'প্রোগ্রাম ও ফটো গ্যালারি' },
                { id: 'section-members', label: 'কার্যনির্বাহী ও সদস্য ডিরেক্টরি' },
                { id: 'section-constitution', label: 'কিস্তি ক্যালকুলেটর ও সংবিধান' },
              ].map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(link.id)}
                    className="text-slate-400 transition-colors hover:text-teal-300"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 (2 cols): Software Modules */}
          <div className="space-y-2.5 lg:col-span-2">
            <h4 className="text-xs font-bold tracking-wider text-white uppercase">
              আর্থিক সেবা পোর্টাল
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateModule('YEARLY_ACCOUNTING')}
                  className="text-slate-400 transition-colors hover:text-teal-300"
                >
                  বাৎসরিক ও মাসিক হিসাব
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateModule('DOWN_PAYMENTS')}
                  className="text-slate-400 transition-colors hover:text-teal-300"
                >
                  ডাউন পেমেন্ট তহবিল
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateModule('RECEIPTS')}
                  className="text-slate-400 transition-colors hover:text-teal-300"
                >
                  মানি রশিদ আর্কাইভ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateModule('ACCOUNTING_REPORTS')}
                  className="text-slate-400 transition-colors hover:text-teal-300"
                >
                  ১৭টি আর্থিক অডিট রিপোর্ট
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateModule('SMART_HUB')}
                  className="text-slate-400 transition-colors hover:text-teal-300"
                >
                  স্মার্ট ফিচার হাব
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4 (3 cols): Office Contact */}
          <div className="space-y-2.5 lg:col-span-3">
            <h4 className="text-xs font-bold tracking-wider text-white uppercase">
              কার্যালয় ও যোগাযোগ
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                <span>{branding.addressBn}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                <span className="font-mono">{branding.phone}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                <span className="font-mono">{branding.email}</span>
              </p>
              <p className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                <span>{branding.meetingScheduleBn}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/90 bg-slate-950/60 px-6 py-4 text-xs text-slate-400 sm:px-8">
          <span>
            © ২০১৯–২০২৬ {branding.nameBn} ({branding.nameEn}) · সর্বস্বত্ব সংরক্ষিত
          </span>
          <button
            type="button"
            onClick={() => scrollToSection('section-top')}
            className="font-semibold text-teal-400 hover:underline"
          >
            উপরে ফিরে যান ↑
          </button>
        </div>
      </footer>

      {/* =====================================================================
       * MODAL 1: CREATE / EDIT NOTICE MODAL
       * =================================================================== */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingNotice
                  ? 'নোটিশ সংশোধন করুন (Edit Notice)'
                  : 'নতুন নোটিশ প্রকাশ করুন (Publish Society Notice)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200">
                  নোটিশের শিরোনাম (Notice Title) *
                </label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="যেমন: ২০২৬ সালের মাসিক কিস্তি ও বকেয়া পরিশোধ সংক্রান্ত জরুরি বিজ্ঞপ্তি"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200">
                    নোটিশের ধরন (Category)
                  </label>
                  <select
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {NOTICE_CATEGORIES.filter((c) => c.id !== 'ALL').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.labelBn} ({c.labelEn})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200">
                    তারিখ (Notice Date)
                  </label>
                  <input
                    type="date"
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200">
                    স্মারক নং (Reference No)
                  </label>
                  <input
                    type="text"
                    value={noticeRefNo}
                    onChange={(e) => setNoticeRefNo(e.target.value)}
                    placeholder="HF-NOT-2026-05"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200">
                  বিস্তারিত নোটিশ বিবরণ (Notice Details) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  placeholder="নোটিশের বিস্তারিত বক্তব্য এখানে লিখুন..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200">
                    প্রচারকারী / স্বাক্ষরকারী (Published By)
                  </label>
                  <input
                    type="text"
                    value={noticeCreatedBy}
                    onChange={(e) => setNoticeCreatedBy(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={noticePinned}
                      onChange={(e) => setNoticePinned(e.target.checked)}
                      className="h-4 w-4 rounded accent-teal-600"
                    />
                    হোম পেজের শুরুতে জরুরি নোটিশ হিসেবে পিন করে রাখুন
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingNotice}
                  className="rounded-lg bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                >
                  {savingNotice
                    ? 'সংরক্ষণ হচ্ছে...'
                    : editingNotice
                    ? 'সংশোধন সংরক্ষণ করুন'
                    : 'নোটিশ প্রকাশ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 2: OFFICIAL PRINTABLE NOTICE VIEW MODAL
       * =================================================================== */}
      {viewingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print dark:border-slate-800">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                অফিসিয়াল নোটিশ প্যাড (Official Printable Notice)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                >
                  <Printer className="h-3.5 w-3.5" />
                  প্রিন্ট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setViewingNotice(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Formal Letterhead */}
            <div className="mt-5 space-y-6 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
              <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-4 dark:border-slate-700">
                <SocietyLogoAvatar logoUrl={branding.logoUrl} size="lg" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {branding.nameBn}
                  </h2>
                  <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {branding.nameEn}
                  </p>
                  <p className="text-xs text-slate-500">
                    {branding.establishedYear} · {branding.addressBn} · ফোন: {branding.phone}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                <span>স্মারক নং: {viewingNotice.refNo}</span>
                <span>তারিখ: {viewingNotice.noticeDate}</span>
              </div>

              <div className="text-center">
                <span className="inline-block border-b border-slate-400 pb-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                  {getCategoryLabel(viewingNotice.type)}
                </span>
                <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                  বিষয়: {viewingNotice.title}
                </h3>
              </div>

              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {viewingNotice.message}
              </p>

              <div className="mt-10 flex items-end justify-between pt-8 text-xs">
                <div className="text-slate-500">
                  সকল সম্মানিত সদস্যের অবগতি ও প্রয়োজনীয় কার্যার্থে বিতরণকৃত।
                </div>
                <div className="text-right">
                  <div className="inline-block border-t border-slate-400 pt-1.5 font-bold text-slate-900 dark:text-white">
                    {viewingNotice.createdBy}
                  </div>
                  <p className="text-[11px] text-slate-500">{branding.nameBn}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 3: SOCIETY LOGO & HOME PAGE BRANDING STUDIO MODAL
       * =================================================================== */}
      {showBrandingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  হিলফুল ফুজুল সমবায় সমিতি — লোগো ও হোম পেজ কাস্টমাইজেশন স্টুডিও
                </h3>
                <p className="text-xs text-slate-500">
                  সমিতির লোগো, নাম, স্লোগান, কমিটির পদবী ও নিয়মাবলী যেকোনো সময় পরিবর্তন করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBrandingModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Studio Tabs */}
            <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  { id: 'LOGO', label: '১. সমিতির লোগো (Logo System)' },
                  { id: 'INFO', label: '২. পরিচিতি ও ঠিকানা (Society Info)' },
                  { id: 'COMMITTEE', label: '৩. কমিটির পদবী (Committee Roles)' },
                  { id: 'RULES', label: '৪. নিয়মাবলী (Society Rules)' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBrandingTab(t.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    brandingTab === t.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-teal-600 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveBranding} className="mt-5 space-y-5 text-xs">
              {brandingTab === 'LOGO' && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row dark:border-slate-800 dark:bg-slate-950">
                    <SocietyLogoAvatar logoUrl={draftBranding.logoUrl} size="xl" />
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        বর্তমান নির্বাচিত লোগো প্রিভিউ
                      </p>
                      <p className="text-xs text-slate-500">
                        আপনি আপনার কম্পিউটার বা মোবাইল থেকে যেকোনো ছবির ফাইল (PNG, JPG, SVG, WebP) আপলোড করতে পারেন অথবা নিচের প্রস্তুতকৃত সমবায় প্রতীক থেকে যেকোনো একটি বেছে নিতে পারেন।
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          ডিভাইস থেকে লোগো ফাইল আপলোড করুন
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200">
                      অথবা সরাসরি লোগো ইমেজ লিংক (Image URL / Data URI) দিন:
                    </label>
                    <input
                      type="text"
                      value={draftBranding.logoUrl}
                      onChange={(e) =>
                        setDraftBranding({ ...draftBranding, logoUrl: e.target.value })
                      }
                      placeholder="https://example.com/logo.png অথবা preset:emerald-crest"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <p className="mb-2.5 font-semibold text-slate-700 dark:text-slate-200">
                      অথবা অফিসিয়াল সমবায় প্রতীক (Built-in Emblem Presets) নির্বাচন করুন:
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {LOGO_PRESETS.map((preset) => {
                        const selected = draftBranding.logoUrl === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              setDraftBranding({ ...draftBranding, logoUrl: preset.id })
                            }
                            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all ${
                              selected
                                ? 'border-teal-600 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/40'
                                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <SocietyLogoAvatar logoUrl={preset.id} size="md" />
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {preset.labelBn}
                              </p>
                              <p className="text-[10px] text-slate-500">{preset.labelEn}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {brandingTab === 'INFO' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        সমিতির নাম (বাংলা)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.nameBn}
                        onChange={(e) =>
                          setDraftBranding({ ...draftBranding, nameBn: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        Society Name (English)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.nameEn}
                        onChange={(e) =>
                          setDraftBranding({ ...draftBranding, nameEn: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        সমিতির মূল স্লোগান (বাংলা)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.sloganBn}
                        onChange={(e) =>
                          setDraftBranding({ ...draftBranding, sloganBn: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        প্রতিষ্ঠাকাল (Established)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.establishedYear}
                        onChange={(e) =>
                          setDraftBranding({
                            ...draftBranding,
                            establishedYear: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        ঠিকানা (Address)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.addressBn}
                        onChange={(e) =>
                          setDraftBranding({ ...draftBranding, addressBn: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        ফোন নম্বর (Phone)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.phone}
                        onChange={(e) =>
                          setDraftBranding({ ...draftBranding, phone: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">
                        ইমেইল (Email)
                      </label>
                      <input
                        type="text"
                        value={draftBranding.email}
                        onChange={(e) =>
                          setDraftBranding({ ...draftBranding, email: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200">
                      সমিতির সংক্ষিপ্ত পরিচিতি (About Society)
                    </label>
                    <textarea
                      rows={3}
                      value={draftBranding.aboutBn}
                      onChange={(e) =>
                        setDraftBranding({ ...draftBranding, aboutBn: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200">
                      ভিশন ও ডিজিটাল লক্ষ্যমাত্রা (Vision)
                    </label>
                    <textarea
                      rows={2}
                      value={draftBranding.visionBn}
                      onChange={(e) =>
                        setDraftBranding({ ...draftBranding, visionBn: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {brandingTab === 'COMMITTEE' && (
                <div className="space-y-3">
                  <p className="text-slate-500">
                    প্রতিটি সদস্যের পাশে তাদের কার্যনির্বাহী কমিটির পদবী (যেমন: সভাপতি, সাধারণ সম্পাদক, কোষাধ্যক্ষ, সম্মানিত সদস্য) নির্ধারণ করুন:
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {members.map((m: any) => (
                      <div
                        key={m.memberId}
                        className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                      >
                        <label className="block font-bold text-slate-900 dark:text-white">
                          #{m.memberId} — {m.nameBn || m.name}
                        </label>
                        <input
                          type="text"
                          value={draftBranding.committeeRoles?.[m.memberId] || ''}
                          onChange={(e) =>
                            setDraftBranding({
                              ...draftBranding,
                              committeeRoles: {
                                ...(draftBranding.committeeRoles || {}),
                                [m.memberId]: e.target.value,
                              },
                            })
                          }
                          placeholder="যেমন: সভাপতি (President)"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brandingTab === 'RULES' && (
                <div className="space-y-3">
                  <p className="text-slate-500">
                    হোম পেজে প্রদর্শিত সমিতির সংবিধান ও নিয়মাবলী সম্পাদনা করুন:
                  </p>
                  {(draftBranding.rules || []).map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono font-bold text-teal-600">0{i + 1}.</span>
                      <input
                        type="text"
                        value={r}
                        onChange={(e) => {
                          const next = [...(draftBranding.rules || [])];
                          next[i] = e.target.value;
                          setDraftBranding({ ...draftBranding, rules: next });
                        }}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (draftBranding.rules || []).filter(
                            (_, idx) => idx !== i
                          );
                          setDraftBranding({ ...draftBranding, rules: next });
                        }}
                        className="rounded-lg border border-rose-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDraftBranding({
                        ...draftBranding,
                        rules: [...(draftBranding.rules || []), 'নতুন নিয়ম এখানে লিখুন...'],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    নতুন নিয়ম যুক্ত করুন
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBrandingModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingBranding}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingBranding ? 'সংরক্ষণ হচ্ছে...' : 'লোগো ও তথ্য সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 2: SOCIETY PROGRAM PHOTO UPLOAD & EDIT MODAL
       * =================================================================== */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingProgram
                    ? 'সমিতির প্রোগ্রামের ছবি ও বিবরণ আপডেট করুন'
                    : 'সমিতির নতুন প্রোগ্রামের ছবি আপলোড করুন'}
                </h3>
                <p className="text-xs text-slate-500">
                  আপলোডকৃত প্রোগ্রামের ছবি ও তথ্য স্থায়ীভাবে ডাটাবেজে সংরক্ষিত থাকবে এবং সকল ডিভাইসে দেখা যাবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProgramModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4 p-6 text-xs">
              {/* Program Photo Upload Box */}
              <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:w-48 shrink-0 dark:border-slate-700 dark:bg-slate-800">
                    {programPhotoUrl ? (
                      <img
                        src={programPhotoUrl}
                        alt="Program preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                        <Camera className="h-8 w-8 text-amber-500" />
                        <span className="mt-1 text-[11px] font-semibold">প্রোগ্রামের ছবি প্রিভিউ</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      প্রোগ্রাম বা অনুষ্ঠানের ছবি নির্বাচন করুন (JPG, PNG, WEBP)
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      সাধারণ সভা, ইফতার মাহফিল, বনভোজন, চেক হস্তান্তর বা যেকোনো অনুষ্ঠানের ছবি সরাসরি আপনার মোবাইল বা কম্পিউটার থেকে আপলোড করুন।
                    </p>
                    <input
                      ref={programModalFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProgramModalFileSelect}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => programModalFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xs hover:bg-amber-400"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        ডিভাইস থেকে প্রোগ্রামের ছবি দিন
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রোগ্রাম / অনুষ্ঠানের শিরোনাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={programTitle}
                    onChange={(e) => setProgramTitle(e.target.value)}
                    placeholder="যেমন: বার্ষিক সাধারণ সভা ও লভ্যাংশ পর্যালোচনা অধিবেশন ২০২৫..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রোগ্রামের ক্যাটাগরি
                  </label>
                  <select
                    value={programCategory}
                    onChange={(e) => setProgramCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {PROGRAM_CATEGORIES.filter((c) => c !== 'সকল প্রোগ্রাম').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    অনুষ্ঠানের তারিখ
                  </label>
                  <input
                    type="date"
                    value={programDate}
                    onChange={(e) => setProgramDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    অনুষ্ঠানের স্থান (Location)
                  </label>
                  <input
                    type="text"
                    value={programLocation}
                    onChange={(e) => setProgramLocation(e.target.value)}
                    placeholder="যেমন: কমলাপুর, বিরুলিয়া, সাভার, ঢাকা"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রোগ্রামের সংক্ষিপ্ত বিবরণ
                  </label>
                  <textarea
                    rows={3}
                    value={programDescription}
                    onChange={(e) => setProgramDescription(e.target.value)}
                    placeholder="অনুষ্ঠানে উপস্থিত সদস্যবৃন্দ ও গৃহীত সিদ্ধান্তের সংক্ষিপ্ত বিবরণ লিখুন..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingProgram}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {savingProgram ? 'সংরক্ষণ হচ্ছে...' : 'প্রোগ্রামের ছবি সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 3: SOCIETY PROJECT & PHOTO UPLOAD / EDIT MODAL
       * =================================================================== */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingProject
                    ? 'প্রকল্পের ছবি ও তথ্য আপডেট করুন'
                    : 'সমিতির নতুন প্রকল্প ও ছবি যুক্ত করুন'}
                </h3>
                <p className="text-xs text-slate-500">
                  প্রকল্পের ছবি, বাজেট ও বিবরণ স্থায়ীভাবে ক্লাউড ডাটাবেজে সংরক্ষিত থাকবে এবং সকল ডিভাইসে দেখা যাবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 p-6 text-xs">
              {/* Project Photo Upload Box */}
              <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-4 dark:border-teal-800/60 dark:bg-teal-950/20">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:w-48 shrink-0 dark:border-slate-700 dark:bg-slate-800">
                    {projectPhotoUrl ? (
                      <img
                        src={projectPhotoUrl}
                        alt="Project preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                        <Briefcase className="h-8 w-8 text-teal-600" />
                        <span className="mt-1 text-[11px] font-semibold">প্রকল্পের ছবি প্রিভিউ</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      প্রকল্পের সাইট / জমির / বিনিয়োগের ছবি নির্বাচন করুন
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      সমিতির জমি ক্রয়, আবাসন, কৃষি বা হালাল বাণিজ্য প্রকল্পের বাস্তব ছবি আপনার মোবাইল বা কম্পিউটার থেকে যুক্ত করুন।
                    </p>
                    <input
                      ref={projectModalFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProjectModalFileSelect}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => projectModalFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-500"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        ডিভাইস থেকে প্রকল্পের ছবি দিন
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রকল্প কোড (Project Code)
                  </label>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="PRJ-2026-01"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রকল্পের ধরন (Category)
                  </label>
                  <select
                    value={projectCategory}
                    onChange={(e) => setProjectCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {PROJECT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রকল্পের নাম (Project Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="যেমন: বিরুলিয়া আবাসন ও ল্যান্ড ব্যাংকিং প্রকল্প (ফেজ-১)..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রাক্কলিত বাজেট / লক্ষ্যমাত্রা (৳)
                  </label>
                  <input
                    type="number"
                    value={projectBudget}
                    onChange={(e) => setProjectBudget(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    বিনিয়োগকৃত অর্থ (৳)
                  </label>
                  <input
                    type="number"
                    value={projectInvested}
                    onChange={(e) => setProjectInvested(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রকল্পের অবস্থান (Location)
                  </label>
                  <input
                    type="text"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    placeholder="যেমন: কমলাপুর, বিরুলিয়া, সাভার, ঢাকা"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    বর্তমান অবস্থা (Status)
                  </label>
                  <select
                    value={projectStatus}
                    onChange={(e) => setProjectStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="চলমান প্রকল্প">চলমান প্রকল্প</option>
                    <option value="বাস্তবায়িত প্রকল্প">বাস্তবায়িত প্রকল্প</option>
                    <option value="পরিকল্পনাধীন প্রকল্প">পরিকল্পনাধীন প্রকল্প</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    প্রকল্পের বিস্তারিত বিবরণ
                  </label>
                  <textarea
                    rows={3}
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="প্রকল্পের উদ্দেশ্য, সম্ভাব্য মুনাফা ও অগ্রগতির বিবরণ লিখুন..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {savingProject ? 'সংরক্ষণ হচ্ছে...' : 'প্রকল্প ও ছবি সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
       * MODAL 4: FULL-SCREEN PHOTO LIGHTBOX PREVIEW
       * =================================================================== */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 text-white">
              <div>
                <h4 className="text-sm font-bold">{lightboxItem.title}</h4>
                <p className="text-xs text-teal-300">{lightboxItem.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex max-h-[70vh] items-center justify-center bg-slate-950 p-3">
              <img
                src={lightboxItem.photoUrl}
                alt={lightboxItem.title}
                className="max-h-[66vh] w-auto rounded-lg object-contain"
              />
            </div>
            {lightboxItem.description && (
              <div className="border-t border-slate-800 px-5 py-3 text-xs leading-relaxed text-slate-300">
                {lightboxItem.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

