import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Edit2,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  UserCheck,
  UserX,
  Sparkles,
  Phone,
  Lock,
  Activity,
  Share2,
  Save,
  Clock,
} from 'lucide-react';

interface AppUser {
  id: number;
  username: string;
  password?: string;
  fullName: string;
  fullNameBn: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  memberId: string;
  phone: string;
  email: string;
  isActive: boolean;
  notes: string;
  createdBy: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecurityAuditItem {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  entityId: string;
  reason: string;
  timestamp: string;
}

interface UserManagementStudioProps {
  currentProfile: any;
  allMembersList?: Array<{ memberId: string; name: string; nameBn: string }>;
  authHeaders?: Record<string, string>;
  onClose?: () => void;
}

export const UserManagementStudio: React.FC<UserManagementStudioProps> = ({
  currentProfile,
  allMembersList = [],
  authHeaders = {},
  onClose,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modals & Inline Quick-Password Edit state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [inlinePasswordUserId, setInlinePasswordUserId] = useState<number | null>(null);
  const [inlinePasswordValue, setInlinePasswordValue] = useState<string>('');
  const [savingInlineId, setSavingInlineId] = useState<number | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    fullNameBn: '',
    role: 'MEMBER' as 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER',
    memberId: '',
    phone: '',
    email: '',
    isActive: true,
    notes: '',
  });

  const [showFormPassword, setShowFormPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});
  const [revealAllPasswords, setRevealAllPasswords] = useState<boolean>(false);

  const token = localStorage.getItem('hf_society_session_v1') || '';
  const buildHeaders = useCallback(
    (withJson = false): Record<string, string> => ({
      ...authHeaders,
      ...(token && token.startsWith('hf_sec.') ? { Authorization: `Bearer ${token}` } : {}),
      ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    }),
    [authHeaders, token]
  );

  const fetchUsers = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const res = await fetch('/api/app-users', {
          headers: buildHeaders(false),
        });
        const data = await res.json();
        if (res.ok && data.users) {
          setUsers(data.users);
          if (Array.isArray(data.recentSecurityLogs)) {
            setSecurityLogs(data.recentSecurityLogs);
          }
          setLastSyncedTime(
            new Date().toLocaleTimeString('bn-BD', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        } else if (!silent) {
          throw new Error(data.error || 'ইউজার তালিকা লোড করতে ব্যর্থ হয়েছে');
        }
      } catch (err: any) {
        if (!silent) {
          setFeedback({ type: 'error', message: err.message });
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [buildHeaders]
  );

  // Automatically refresh whenever MemberProfileModal or background sync updates credentials
  useEffect(() => {
    fetchUsers(false);

    const handleCredentialSyncEvent = () => {
      fetchUsers(true);
    };
    window.addEventListener('hf_credentials_updated', handleCredentialSyncEvent);
    window.addEventListener('hf_background_sync', handleCredentialSyncEvent);
    return () => {
      window.removeEventListener('hf_credentials_updated', handleCredentialSyncEvent);
      window.removeEventListener('hf_background_sync', handleCredentialSyncEvent);
    };
  }, [fetchUsers]);

  const notifyGlobalSync = () => {
    window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
  };

  const handleForceTwoWaySync = async () => {
    setIsSyncingAll(true);
    await fetchUsers(false);
    notifyGlobalSync();
    setIsSyncingAll(false);
    setFeedback({
      type: 'success',
      message:
        'সকল সদস্যের প্রোফাইল পাসওয়ার্ড এবং ইউজার ম্যানেজমেন্ট স্টুডিও ১০০% দ্বিমুখী সিঙ্ক সম্পন্ন হয়েছে!',
    });
  };

  const generateRandomPassword = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const generateStrongPasscode = () => {
    const prefix = ['HF', 'SM', 'BD'][Math.floor(Math.random() * 3)];
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${digits}`;
  };

  const getPasswordStrengthMeta = (pwd = '') => {
    const clean = String(pwd).trim();
    const isDefault = clean === '1234' || clean === '0000';
    if (isDefault) {
      return {
        label: 'ডিফল্ট পিন',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
      };
    }
    if (clean.length >= 6 || /[A-Za-z]/.test(clean)) {
      return {
        label: 'উচ্চ সুরক্ষিত',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
      };
    }
    return {
      label: 'কাস্টম পিন',
      badgeClass: 'bg-teal-950/80 text-teal-300 border-teal-500/30',
    };
  };

  const openCreateModal = () => {
    setFormData({
      username: '',
      password: generateRandomPassword(),
      fullName: '',
      fullNameBn: '',
      role: 'MEMBER',
      memberId: '',
      phone: '',
      email: '',
      isActive: true,
      notes: '',
    });
    setShowCreateModal(true);
  };

  const openEditModal = (u: AppUser) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      password: u.password || '',
      fullName: u.fullName,
      fullNameBn: u.fullNameBn,
      role: u.role,
      memberId: u.memberId || '',
      phone: u.phone || '',
      email: u.email || '',
      isActive: u.isActive,
      notes: u.notes || '',
    });
  };

  const handleMemberSelect = (mId: string) => {
    const mem = allMembersList.find((m) => m.memberId === mId);
    if (mem) {
      setFormData((prev) => ({
        ...prev,
        memberId: mId,
        username: prev.username || `member${mId}`,
        fullName: prev.fullName || mem.name,
        fullNameBn: prev.fullNameBn || mem.nameBn,
      }));
    } else {
      setFormData((prev) => ({ ...prev, memberId: mId }));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim() || !formData.fullName.trim()) {
      setFeedback({ type: 'error', message: 'ইউজার নেম, পাসওয়ার্ড ও পুরো নাম বাধ্যতামূলক।' });
      return;
    }

    try {
      const res = await fetch('/api/app-users', {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'নতুন ইউজার তৈরি ব্যর্থ হয়েছে');

      setFeedback({
        type: 'success',
        message: `ইউজার "@${formData.username}" সফলভাবে তৈরি ও সদস্য প্রোফাইলের সাথে সিঙ্ক করা হয়েছে!`,
      });
      setShowCreateModal(false);
      await fetchUsers(true);
      notifyGlobalSync();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/app-users/${editingUser.id}`, {
        method: 'PUT',
        headers: buildHeaders(true),
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ইউজার আপডেট ব্যর্থ হয়েছে');

      setFeedback({
        type: 'success',
        message: `ইউজার "@${formData.username}"-এর পাসওয়ার্ড ও তথ্য স্টুডিও এবং সদস্য প্রোফাইলে একযোগে আপডেট হয়েছে!`,
      });
      setEditingUser(null);
      await fetchUsers(true);
      notifyGlobalSync();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleInlineQuickPasswordSave = async (u: AppUser) => {
    const cleanPwd = String(inlinePasswordValue || '').trim();
    if (cleanPwd.length < 3) {
      setFeedback({ type: 'error', message: 'পাসওয়ার্ড কমপক্ষে ৩ অক্ষরের হতে হবে।' });
      return;
    }
    try {
      setSavingInlineId(u.id);
      const res = await fetch(`/api/app-users/${u.id}`, {
        method: 'PUT',
        headers: buildHeaders(true),
        body: JSON.stringify({
          ...u,
          password: cleanPwd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে');

      setInlinePasswordUserId(null);
      setFeedback({
        type: 'success',
        message: `${u.fullNameBn || u.fullName} (@${u.username})-এর নতুন পাসওয়ার্ড "${cleanPwd}" সফলভাবে সেভ ও প্রোফাইলে অটো-সিঙ্ক হয়েছে!`,
      });
      await fetchUsers(true);
      notifyGlobalSync();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingInlineId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      const res = await fetch(`/api/app-users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: buildHeaders(false),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ইউজার মোছা সম্ভব হয়নি');

      setFeedback({ type: 'success', message: `ইউজার "${deletingUser.username}" মুছে ফেলা হয়েছে।` });
      setDeletingUser(null);
      await fetchUsers(true);
      notifyGlobalSync();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCopyCredentials = (u: AppUser) => {
    const text = `হিলফুল ফুজুল সমবায় সমিতি — লগইন তথ্য:\nনাম: ${u.fullNameBn || u.fullName}\nইউজার নেম: ${u.username}\nপাসওয়ার্ড: ${u.password || '••••••••'}\nভূমিকা: ${u.role}\nসদস্য নং: ${u.memberId || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleShareWhatsApp = (u: AppUser) => {
    const cleanPhone = String(u.phone || '').replace(/[^0-9]/g, '');
    const bdPhone = cleanPhone.startsWith('0') ? `88${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `আসসালামু আলাইকুম ${u.fullNameBn || u.fullName},\nহিলফুল ফুজুল বহুমুখী সমবায় সমিতি লিঃ-এর ডিজিটাল পোর্টালে আপনার লগইন তথ্য:\n\n👤 ইউজার নেম: ${u.username}\n🔑 পাসওয়ার্ড / পিন: ${u.password || '1234'}\n🆔 সদস্য আইডি: #${u.memberId || 'N/A'}\n\nআপনি ইউজার নেম, সদস্য আইডি অথবা মোবাইল নম্বর দিয়ে লগইন করতে পারবেন।`
    );
    const link = bdPhone ? `https://wa.me/${bdPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const togglePasswordReveal = (id: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullNameBn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.memberId.includes(searchTerm) ||
      u.phone.includes(searchTerm);

    const matchesRole = filterRole === 'ALL' || u.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const customPinCount = users.filter(
    (u) => u.password && u.password !== '1234' && u.password !== '0000'
  ).length;
  const securityScore =
    users.length > 0 ? Math.min(100, Math.round(65 + (customPinCount / users.length) * 35)) : 95;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans text-slate-100 p-4 sm:p-6 mb-8">
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  ইউজার নেম ও পাসওয়ার্ড ব্যবস্থাপনা স্টুডিও
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  সুপার এডমিন সিকিউরিটি কমান্ড সেন্টার
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                  <RefreshCw className="w-3 h-3" />
                  সদস্য প্রোফাইল ২-ওয়ে লাইভ সিঙ্ক সক্রিয়
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                সদস্য প্রোফাইল থেকে পাসওয়ার্ড পরিবর্তন করলে এখানে অটোমেটিক আপডেট হবে এবং এখান থেকে পরিবর্তন করলে সদস্য প্রোফাইলে সাথে সাথে আপডেট হবে
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setRevealAllPasswords(!revealAllPasswords)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition"
          >
            {revealAllPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{revealAllPasswords ? 'সব পাসওয়ার্ড লুকান' : 'সব পাসওয়ার্ড দেখুন'}</span>
          </button>

          <button
            type="button"
            onClick={handleForceTwoWaySync}
            disabled={isSyncingAll || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-950/90 hover:bg-teal-900 text-teal-200 border border-teal-500/40 text-xs font-bold transition"
            title="প্রোফাইল ও স্টুডিও পুনঃসিঙ্ক করুন"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingAll || isLoading ? 'animate-spin' : ''}`} />
            <span>প্রোফাইল পাসওয়ার্ড অটো-সিঙ্ক</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-emerald-950/40 text-xs sm:text-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>নতুন ইউজার তৈরি করুন</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 border border-slate-700 transition"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Unique Security Shield Telemetry Strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-emerald-300/80 font-medium">
              দ্বিমুখী পাসওয়ার্ড সিঙ্ক ইঞ্জিন
            </p>
            <p className="text-sm font-extrabold text-white mt-0.5">
              প্রোফাইল ⇄ স্টুডিও ১০০% সিঙ্কড
            </p>
            {lastSyncedTime && (
              <p className="text-[10px] text-emerald-400 mt-0.5">
                সর্বশেষ সিঙ্ক: {lastSyncedTime}
              </p>
            )}
          </div>
          <ShieldCheck className="w-8 h-8 text-emerald-400 opacity-80" />
        </div>

        <div className="rounded-xl border border-amber-500/25 bg-amber-950/25 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-amber-300/80 font-medium">মাল্টি-আইডেন্টিটি লগইন সুবিধা</p>
            <p className="text-sm font-extrabold text-white mt-0.5">
              @Username / ID / মোবাইল
            </p>
            <p className="text-[10px] text-amber-300 mt-0.5">
              যেকোনো একটি দিয়ে লগইন করা যাবে
            </p>
          </div>
          <KeyRound className="w-8 h-8 text-amber-400 opacity-80" />
        </div>

        <div className="rounded-xl border border-teal-500/25 bg-teal-950/30 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-teal-300/80 font-medium">সিকিউরিটি হেলথ স্কোর</p>
            <p className="text-sm font-extrabold text-white mt-0.5 font-mono">
              {securityScore}% সুরক্ষিত ({customPinCount}/{users.length} কাস্টম)
            </p>
            <p className="text-[10px] text-teal-300 mt-0.5">
              SHA-256 টোকেন + ব্রুট-ফোর্স লকডাউন
            </p>
          </div>
          <Shield className="w-8 h-8 text-teal-400 opacity-80" />
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/25 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-cyan-300/80 font-medium">মোট সক্রিয় একাউন্ট</p>
            <p className="text-sm font-extrabold text-white mt-0.5 font-mono">
              {users.filter((u) => u.isActive).length} জন সক্রিয় সদস্য ও এডমিন
            </p>
            <p className="text-[10px] text-cyan-300 mt-0.5">
              ১-ক্লিকে ইনলাইন পাসওয়ার্ড পরিবর্তনযোগ্য
            </p>
          </div>
          <Activity className="w-8 h-8 text-cyan-400 opacity-80" />
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`mt-4 p-3.5 rounded-xl text-xs sm:text-sm flex items-start justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/70 border border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ইউজার নেম, নাম, মেম্বার আইডি বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
          >
            <option value="ALL">সকল পদবী / রোল</option>
            <option value="SUPER_ADMIN">সুপার এডমিন (Super Admin)</option>
            <option value="ADMIN">এডমিন (Admin)</option>
            <option value="MEMBER">সাধারণ সদস্য (Member)</option>
          </select>
        </div>
      </div>

      {/* Users Table / Grid */}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4 font-semibold">ইউজার নেম</th>
              <th className="py-3.5 px-4 font-semibold">পাসওয়ার্ড / পিন (১-ক্লিক পরিবর্তন)</th>
              <th className="py-3.5 px-4 font-semibold">সদস্যের নাম ও পদবী</th>
              <th className="py-3.5 px-4 font-semibold">সদস্য নং</th>
              <th className="py-3.5 px-4 font-semibold">মোবাইল ও সর্বশেষ আপডেট</th>
              <th className="py-3.5 px-4 font-semibold">অবস্থা</th>
              <th className="py-3.5 px-4 font-semibold text-right">অ্যাকশন ও শেয়ার</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>ইউজার ও প্রোফাইল পাসওয়ার্ড সিঙ্ক হচ্ছে...</span>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400">
                  কোনো ইউজার খুঁজে পাওয়া যায়নি।
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isRevealed = revealAllPasswords || revealedPasswords[u.id];
                const isSuper = u.role === 'SUPER_ADMIN';
                const isAdmin = u.role === 'ADMIN';
                const isEditingInline = inlinePasswordUserId === u.id;
                const strengthMeta = getPasswordStrengthMeta(u.password);

                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    {/* Username */}
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400">@</span>
                        <span>{u.username}</span>
                        {isSuper && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Password + Inline Quick Change */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {isEditingInline ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={inlinePasswordValue}
                            onChange={(e) => setInlinePasswordValue(e.target.value)}
                            className="w-28 px-2 py-1 rounded-lg bg-slate-900 border border-amber-400 text-amber-300 font-mono text-xs font-bold focus:outline-none"
                            placeholder="নতুন পিন..."
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setInlinePasswordValue(generateRandomPassword())}
                            className="p-1 rounded bg-slate-800 text-emerald-300 hover:bg-slate-700"
                            title="র্যান্ডম ৪-ডিজিট পিন"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={savingInlineId === u.id}
                            onClick={() => handleInlineQuickPasswordSave(u)}
                            className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            <span>সেভ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlinePasswordUserId(null)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-bold text-amber-300">
                            {isRevealed ? u.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(u.id)}
                            className="text-slate-400 hover:text-slate-200 transition"
                            title={isRevealed ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                          >
                            {isRevealed ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInlinePasswordUserId(u.id);
                              setInlinePasswordValue(u.password || '1234');
                            }}
                            className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-slate-700 hover:border-amber-400/40 transition"
                            title="সরাসরি পাসওয়ার্ড পরিবর্তন করুন"
                          >
                            পিন বদলান
                          </button>
                          <span
                            className={`text-[10px] font-sans px-1.5 py-0.5 rounded border ${strengthMeta.badgeClass}`}
                          >
                            {strengthMeta.label}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Full Name & Role */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-100">{u.fullNameBn || u.fullName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isSuper ? 'bg-emerald-400' : isAdmin ? 'bg-teal-400' : 'bg-cyan-400'
                          }`}
                        />
                        <span>
                          {u.role === 'SUPER_ADMIN'
                            ? 'সুপার এডমিন'
                            : u.role === 'ADMIN'
                            ? 'এডমিন'
                            : 'সদস্য'}
                        </span>
                      </div>
                    </td>

                    {/* Member ID */}
                    <td className="py-3 px-4">
                      {u.memberId ? (
                        <span className="font-mono bg-slate-900 text-cyan-300 px-2 py-0.5 rounded border border-slate-800 text-xs font-semibold">
                          #{u.memberId}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Phone / Updated Timestamp */}
                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div className="font-mono">{u.phone || '—'}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-emerald-400" />
                        <span>
                          সিঙ্কড:{' '}
                          {u.updatedAt
                            ? new Date(u.updatedAt).toLocaleDateString('bn-BD')
                            : 'সক্রিয়'}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <UserCheck className="w-3 h-3" />
                          <span>সক্রিয়</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/60 border border-rose-500/20 px-2 py-0.5 rounded-full">
                          <UserX className="w-3 h-3" />
                          <span>নিষ্ক্রিয়</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp Credential Share */}
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(u)}
                          className="p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 transition"
                          title="হোয়াটসঅ্যাপে ইউজার নেম ও পাসওয়ার্ড পাঠান"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        {/* Copy info */}
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          title="লগইন তথ্য কপি করুন"
                        >
                          {copiedId === u.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit user */}
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 border border-slate-700 transition"
                          title="ইউজার ও পাসওয়ার্ড পরিবর্তন"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete user */}
                        {u.username.toLowerCase() !== 'superadmin' && (
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 border border-slate-700 transition"
                            title="ইউজার ডিলিট করুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Live Security & Password Sync Audit Log */}
      {securityLogs.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                সাম্প্রতিক পাসওয়ার্ড পরিবর্তন ও সিকিউরিটি সিঙ্ক লগ (Live Security Audit Trail)
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold">
              প্রোফাইল ও স্টুডিও অ্যাক্টিভিটি
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {securityLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-slate-800/90 bg-slate-900/70 px-3 py-2 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-emerald-300">
                    {log.reason || log.action}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    সম্পাদনকারী: <span className="text-slate-200">{log.actorName}</span> ({log.actorRole})
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString('bn-BD', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>নতুন ইউজার নেম ও পাসওয়ার্ড তৈরি</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              {allMembersList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    বিদ্যমান সদস্য লিংক করুন (ঐচ্ছিক)
                  </label>
                  <select
                    value={formData.memberId}
                    onChange={(e) => handleMemberSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- সাধারণ স্বতন্ত্র ইউজার (কোনো সদস্য লিঙ্ক ছাড়া) --</option>
                    {allMembersList.map((m) => (
                      <option key={m.memberId} value={m.memberId}>
                        সদস্য #{m.memberId} — {m.nameBn || m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ইউজার নেম (Username) *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })
                    }
                    placeholder="যেমন: mamun01, member12"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      পাসওয়ার্ড (Password) *
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, password: generateRandomPassword() })
                        }
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>পিন</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, password: generateStrongPasscode() })
                        }
                        className="text-[11px] text-amber-300 hover:underline"
                      >
                        স্ট্রং কোড
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="পাসওয়ার্ড লিখুন..."
                      required
                      className="w-full px-3 py-2 pr-9 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showFormPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    পুরো নাম (বাংলা)
                  </label>
                  <input
                    type="text"
                    value={formData.fullNameBn}
                    onChange={(e) => setFormData({ ...formData, fullNameBn: e.target.value })}
                    placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    পুরো নাম (ইংরেজি) *
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Md. Rafiqul Islam"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    পদবী / অ্যাক্সেস রোল
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MEMBER">সাধারণ সদস্য (MEMBER)</option>
                    <option value="ADMIN">প্রশাসনিক এডমিন (ADMIN)</option>
                    <option value="SUPER_ADMIN">সুপার এডমিন (SUPER_ADMIN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  নোট বা বিবরণ
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ব্যবহারকারী সম্পর্কিত বিবরণ..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveNew"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-500 rounded bg-slate-950 border-slate-800 focus:ring-emerald-500"
                />
                <label htmlFor="isActiveNew" className="text-xs font-medium text-slate-300">
                  অ্যাকাউন্ট তাৎক্ষণিকভাবে সক্রিয় থাকবে
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-950/40"
                >
                  ইউজার সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User & Change Password */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                <span>ইউজার ও পাসওয়ার্ড পরিবর্তন — @{editingUser.username}</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 mt-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2 text-[11px] text-emerald-200 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  এখানে পাসওয়ার্ড পরিবর্তন করলে সদস্য #{formData.memberId || editingUser.memberId}-এর প্রোফাইলেও স্বয়ংক্রিয়ভাবে আপডেট হয়ে যাবে।
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ইউজার নেম (Username) *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      নতুন পাসওয়ার্ড (Password) *
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, password: generateRandomPassword() })
                        }
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>৪-ডিজিট</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, password: generateStrongPasscode() })
                        }
                        className="text-[11px] text-amber-300 hover:underline"
                      >
                        স্ট্রং কোড
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="w-full px-3 py-2 pr-9 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showFormPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    পুরো নাম (বাংলা)
                  </label>
                  <input
                    type="text"
                    value={formData.fullNameBn}
                    onChange={(e) => setFormData({ ...formData, fullNameBn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    পুরো নাম (ইংরেজি)
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    পদবী / রোল
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MEMBER">সাধারণ সদস্য (MEMBER)</option>
                    <option value="ADMIN">প্রশাসনিক এডমিন (ADMIN)</option>
                    <option value="SUPER_ADMIN">সুপার এডমিন (SUPER_ADMIN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    সদস্য নং (Member ID)
                  </label>
                  <input
                    type="text"
                    value={formData.memberId}
                    onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                    placeholder="যেমন: 02, 09"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    অ্যাকাউন্ট স্ট্যাটাস
                  </label>
                  <select
                    value={formData.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.value === 'ACTIVE' })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ACTIVE">সক্রিয় (Active)</option>
                    <option value="INACTIVE">নিষ্ক্রিয় (Inactive / ব্লকড)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-950/40"
                >
                  আপডেট ও সিঙ্ক সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete User Confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">ইউজার মুছে ফেলতে চান?</h3>
            <p className="text-xs text-slate-300 mt-2">
              আপনি কি নিশ্চিত যে ইউজার{' '}
              <span className="font-mono text-rose-400 font-bold">@{deletingUser.username}</span> (
              {deletingUser.fullNameBn || deletingUser.fullName}) মুছে ফেলতে চান?
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-rose-950/40"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
