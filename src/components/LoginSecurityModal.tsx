import React, { useState, useEffect } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  Lock,
  KeyRound,
  LogIn,
  LogOut,
  X,
  AlertCircle,
  Award,
} from 'lucide-react';
import { SocietyLogoAvatar } from './SocietyHomePage.tsx';

interface LoginSecurityModalProps {
  isOpen: boolean;
  currentRole: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  currentMemberId: string;
  allMembers: Array<{
    memberId: string;
    name: string;
    nameBn?: string;
    photoUrl?: string;
    nomineeName?: string;
  }>;
  societyLogoUrl?: string;
  onClose: () => void;
  onLoginSuccess: (
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER',
    memberId?: string,
    sessionToken?: string
  ) => void;
  onSignOut: () => void;
}

export const LoginSecurityModal: React.FC<LoginSecurityModalProps> = ({
  isOpen,
  currentRole,
  currentMemberId,
  allMembers,
  societyLogoUrl = 'preset:emerald-crest',
  onClose,
  onLoginSuccess,
  onSignOut,
}) => {
  const [selectedTab, setSelectedTab] = useState<'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'>(
    currentRole === 'MEMBER' ? 'MEMBER' : currentRole === 'ADMIN' ? 'ADMIN' : 'SUPER_ADMIN'
  );
  // When logged in as a MEMBER, hide Super Admin & Admin tabs by default unless explicitly unlocked
  const [showAdminAccessTabs, setShowAdminAccessTabs] = useState<boolean>(
    currentRole !== 'MEMBER'
  );

  // Form states
  const [superAdminPin, setSuperAdminPin] = useState<string>('7709');
  const [adminPin, setAdminPin] = useState<string>('2026');
  const [memberSelectId, setMemberSelectId] = useState<string>(currentMemberId || '09');
  const [memberPin, setMemberPin] = useState<string>('1234');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (currentRole === 'MEMBER') {
        setSelectedTab('MEMBER');
        setShowAdminAccessTabs(false);
      } else {
        setSelectedTab(currentRole);
        setShowAdminAccessTabs(true);
      }
      setMemberSelectId(currentMemberId || '09');
      setErrorMessage('');
    }
  }, [isOpen, currentRole, currentMemberId]);

  if (!isOpen) return null;

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'SUPER_ADMIN',
          pin: superAdminPin || '7709',
          email: 'mamun770m@gmail.com',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess('SUPER_ADMIN', '09', data.sessionToken);
        onClose();
      } else {
        setErrorMessage(data.error || 'সুপার এডমিন পিন ভুল হয়েছে। ডিফল্ট: 7709');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'সার্ভার সংযোগে ত্রুটি।');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'ADMIN',
          pin: adminPin || '2026',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess('ADMIN', '02', data.sessionToken);
        onClose();
      } else {
        setErrorMessage(data.error || 'এডমিন পিন ভুল হয়েছে। ডিফল্ট: 2026');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'সার্ভার সংযোগে ত্রুটি।');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'MEMBER',
          memberId: memberSelectId,
          pin: memberPin || '1234',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess('MEMBER', memberSelectId, data.sessionToken);
        onClose();
      } else {
        setErrorMessage(data.error || 'সদস্য পিন নম্বর ভুল হয়েছে। ডিফল্ট: 1234');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'সার্ভার সংযোগে ত্রুটি।');
    } finally {
      setLoading(false);
    }
  };

  const selectedMemberObj = allMembers.find((m) => m.memberId === memberSelectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-teal-500/40 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Glow Effects */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

        {/* Modal Header */}
        <div className="relative border-b border-slate-800 bg-slate-950/90 px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <SocietyLogoAvatar logoUrl={societyLogoUrl} size="md" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white sm:text-xl">
                    হিলফুল ফুজুল সমবায় সমিতি
                  </h3>
                  <span className="rounded-full bg-teal-500/20 border border-teal-500/40 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                    নিরাপদ লগ ইন ও আরএলএস (RLS)
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {showAdminAccessTabs
                    ? 'সুপার এডমিন, এডমিন ও সম্মানিত সদস্যদের নিরাপদ অ্যাক্সেস কন্ট্রোল'
                    : 'সম্মানিত সদস্য পোর্টাল (Member Self-Service Portal — RLS Protected)'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Role Selection Tabs — Only show Super Admin & Admin tabs if showAdminAccessTabs is true */}
          {showAdminAccessTabs ? (
            <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-900/90 p-1.5 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedTab('SUPER_ADMIN');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  selectedTab === 'SUPER_ADMIN'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-900/40 border border-teal-400/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="truncate">সুপার এডমিন</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedTab('ADMIN');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  selectedTab === 'ADMIN'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/40 border border-amber-400/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="truncate">এডমিন (চাঁদা ও নোটিশ)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedTab('MEMBER');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  selectedTab === 'MEMBER'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-900/40 border border-cyan-400/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">সদস্য পোর্টাল (RLS)</span>
              </button>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <UserCheck className="h-4 w-4" />
                <span>সদস্য প্রোফাইল ও সেলফ-সার্ভিস পোর্টাল (Isolated Member Session)</span>
              </div>
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                RLS সক্রিয়
              </span>
            </div>
          )}
        </div>

        {/* Error message strip */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: SUPER ADMIN LOGIN (YOU) */}
        {selectedTab === 'SUPER_ADMIN' && showAdminAccessTabs && (
          <form onSubmit={handleSuperAdminLogin} className="p-6 sm:p-8 space-y-6 text-xs">
            <div className="rounded-2xl border border-teal-500/40 bg-gradient-to-br from-teal-950/60 to-slate-900 p-5 shadow-inner">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-teal-400 bg-teal-600/30 text-teal-300 shadow-md">
                  <Award className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      মোঃ মনির হোসেন মামুন (সুপার এডমিন)
                    </span>
                    <span className="rounded-md bg-teal-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-300 border border-teal-500/30">
                      সদস্য নং #০৯
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono">
                    মালিকানা ইমেইল: <span className="text-teal-300 font-bold">mamun770m@gmail.com</span>
                  </p>
                  <p className="text-[11px] text-teal-200/80 leading-relaxed">
                    * <strong>পূর্ণ নিয়ন্ত্রণ ক্ষমতা:</strong> আপনার অধীনে সফটওয়্যারের সকল তথ্য পরিবর্তন, সদস্য ম্যানেজমেন্ট, ডাবল-এন্ট্রি হিসাব ও সেটিংস সংশোধন উন্মুক্ত।
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  সুপার এডমিন মাস্টার পিন (Master Security PIN) *
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">কুইক পিন:</span>
                  <button
                    type="button"
                    onClick={() => setSuperAdminPin('7709')}
                    className="rounded-md border border-teal-500/40 bg-teal-950 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-300 hover:bg-teal-900"
                  >
                    7709
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuperAdminPin('1234')}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300 hover:bg-slate-700"
                  >
                    1234
                  </button>
                </div>
              </div>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-teal-400" />
                <input
                  type="password"
                  required
                  value={superAdminPin}
                  onChange={(e) => setSuperAdminPin(e.target.value)}
                  placeholder="পিন লিখুন (যেমন: 7709)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pr-4 pl-10 font-mono text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-teal-950/60 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 transition-all"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'যাচাই হচ্ছে...' : 'সুপার এডমিন হিসেবে প্রবেশ করুন'}
            </button>
          </form>
        )}

        {/* TAB 2: ADMIN LOGIN */}
        {selectedTab === 'ADMIN' && showAdminAccessTabs && (
          <form onSubmit={handleAdminLogin} className="p-6 sm:p-8 space-y-6 text-xs">
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/60 to-slate-900 p-5 shadow-inner">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400 bg-amber-600/30 text-amber-300 shadow-md">
                  <Shield className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      সহকারী এডমিন (চাঁদা ইনপুট ও নোটিশ প্রদানকারী)
                    </span>
                    <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 border border-amber-500/30">
                      এডমিন ভূমিকা
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    * <strong>অনুমোদিত সীমা:</strong> এডমিন শুধুমাত্র সমিতির <strong>চাঁদা ইনপুট দেওয়া</strong>, <strong>হিসাব এডিট করা</strong> এবং <strong>নোটিশ প্রকাশ</strong> করতে পারবে।
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  এডমিন পিন নম্বর (Admin Security PIN) *
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">কুইক পিন:</span>
                  <button
                    type="button"
                    onClick={() => setAdminPin('2026')}
                    className="rounded-md border border-amber-500/40 bg-amber-950 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 hover:bg-amber-900"
                  >
                    2026
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPin('1234')}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300 hover:bg-slate-700"
                  >
                    1234
                  </button>
                </div>
              </div>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-amber-400" />
                <input
                  type="password"
                  required
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="ডিফল্ট এডমিন পিন: 2026 বা 1234"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pr-4 pl-10 font-mono text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-white shadow-lg shadow-amber-950/60 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 transition-all"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'যাচাই হচ্ছে...' : 'এডমিন হিসেবে প্রবেশ করুন'}
            </button>
          </form>
        )}

        {/* TAB 3: MEMBER PORTAL LOGIN (WITH 12-MEMBER SELECTOR GRID) */}
        {selectedTab === 'MEMBER' && (
          <form onSubmit={handleMemberLogin} className="p-6 sm:p-8 space-y-5 text-xs">
            <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 to-slate-900 p-4 shadow-inner">
              <div className="flex items-start gap-3">
                <UserCheck className="mt-0.5 h-5 w-5 text-cyan-400 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-white">
                    সদস্য সেলফ-সার্ভিস পোর্টাল ও নিজস্ব তথ্য আপডেট (Member Portal — RLS)
                  </p>
                  <p className="text-[11px] text-cyan-200/90 leading-relaxed">
                    * <strong>সদস্যদের ক্ষমতা:</strong> প্রত্যেক সদস্য নিজের ছবি, নমিনির ছবি, ব্যক্তিগত পরিচিতি ও মন্তব্য আপডেট করতে পারবেন এবং শুধুমাত্র নিজের ব্যক্তিগত জমা-বকেয়া হিসাব ও মানি রশিদ দেখতে পারবেন। সদস্য পোর্টালে সুপার এডমিন বা এডমিন অপশন প্রদর্শিত হবে না।
                  </p>
                </div>
              </div>
            </div>

            {/* 12-Member Visual Grid Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                নিচের তালিকা থেকে আপনার নাম বা সদস্য আইডি নির্বাচন করুন:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1 border border-slate-800 rounded-xl bg-slate-950/60">
                {allMembers.map((m) => {
                  const isSelected = memberSelectId === m.memberId;
                  return (
                    <button
                      key={m.memberId}
                      type="button"
                      onClick={() => setMemberSelectId(m.memberId)}
                      className={`flex items-center gap-2.5 rounded-lg p-2 text-left transition-all ${
                        isSelected
                          ? 'border border-cyan-500 bg-cyan-950/60 text-white shadow-sm ring-1 ring-cyan-500'
                          : 'border border-slate-800/80 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-slate-800 font-mono text-xs font-bold text-cyan-300 overflow-hidden">
                        {m.photoUrl ? (
                          <img src={m.photoUrl} alt={m.nameBn} className="h-full w-full object-cover" />
                        ) : (
                          m.memberId
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-[11px] text-white">
                          {m.nameBn || m.name}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          নমিনি: {m.nomineeName || 'নির্ধারিত'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Member Confirmation Card */}
            {selectedMemberObj && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">নির্বাচিত সদস্য:</span>{' '}
                  <strong className="text-white">
                    {selectedMemberObj.nameBn || selectedMemberObj.name} (#{selectedMemberObj.memberId})
                  </strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">কুইক পিন:</span>
                  <button
                    type="button"
                    onClick={() => setMemberPin('1234')}
                    className="rounded-md border border-cyan-500/40 bg-cyan-950 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300 hover:bg-cyan-900"
                  >
                    1234
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                সদস্য পিন নম্বর (Member Access PIN) *
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-cyan-400" />
                <input
                  type="password"
                  required
                  value={memberPin}
                  onChange={(e) => setMemberPin(e.target.value)}
                  placeholder="ডিফল্ট পিন: 1234"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pr-4 pl-10 font-mono text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-950/60 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 transition-all"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'যাচাই হচ্ছে...' : `সদস্য #${memberSelectId} প্রোফাইলে প্রবেশ করুন`}
            </button>
          </form>
        )}

        {/* Modal Footer with Active Role status & Discreet Admin Unlock */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 px-6 py-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span>বর্তমান সেশন:</span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-bold text-teal-300">
              {currentRole === 'SUPER_ADMIN'
                ? 'সুপার এডমিন (মোঃ মনির হোসেন মামুন)'
                : currentRole === 'ADMIN'
                ? 'এডমিন (চাঁদা ও নোটিশ)'
                : `সদস্য প্রোফাইল #${currentMemberId} (RLS)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!showAdminAccessTabs && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminAccessTabs(true);
                  setSelectedTab('SUPER_ADMIN');
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:border-teal-500/40 hover:text-teal-300"
              >
                প্রশাসনিক পিন লগইন
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1 text-xs font-bold text-rose-400 hover:bg-rose-900/50"
            >
              <LogOut className="h-3.5 w-3.5" />
              লগআউট
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
