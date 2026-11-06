import React, { useState, useEffect } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { OFFICIAL_SOCIETY_LOGO_URL } from '../lib/officialLogo';

interface UniqueLoginScreenProps {
  onLoginSuccess: (userData: any, token: string) => void;
  onContinueAsGuest?: () => void;
}

interface QuickAccountItem {
  id: number;
  username: string;
  password: string;
  fullNameBn: string;
  role: string;
  memberId: string;
  phone?: string;
}

export const UniqueLoginScreen: React.FC<UniqueLoginScreenProps> = ({
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [quickAccounts, setQuickAccounts] = useState<QuickAccountItem[]>([
    {
      id: 1,
      username: 'superadmin',
      password: '7709',
      fullNameBn: 'মোঃ আব্দুল্লাহ আল মামুন',
      role: 'SUPER_ADMIN',
      memberId: '09',
    },
    {
      id: 2,
      username: 'admin',
      password: '2026',
      fullNameBn: 'মোঃ কামরুজ্জামান',
      role: 'ADMIN',
      memberId: '02',
    },
    {
      id: 3,
      username: 'member04',
      password: '1234',
      fullNameBn: 'মোঃ মিনার হোসেন',
      role: 'MEMBER',
      memberId: '04',
    },
    {
      id: 4,
      username: 'member05',
      password: '1234',
      fullNameBn: 'মোঃ আরিফুর রহমান',
      role: 'MEMBER',
      memberId: '05',
    },
  ]);

  // Fetch live synced quick accounts from the server so any password changed in Member Profile or Studio is reflected here
  useEffect(() => {
    const loadQuickAccounts = async () => {
      try {
        const res = await fetch('/api/auth/quick-accounts');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.accounts) && data.accounts.length > 0) {
            setQuickAccounts(data.accounts);
          }
        }
      } catch {
        // Fallback to initial accounts if offline
      }
    };
    loadQuickAccounts();
    window.addEventListener('hf_credentials_updated', loadQuickAccounts);
    return () => window.removeEventListener('hf_credentials_updated', loadQuickAccounts);
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('অনুগ্রহ করে ইউজার নেম এবং পাসওয়ার্ড উভয়ই লিখুন।');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'লগ ইন ব্যর্থ হয়েছে। সঠিক তথ্য প্রদান করুন।');
      }

      setSuccessMessage('সফলভাবে যাচাই সম্পন্ন হয়েছে! সফটওয়্যারে প্রবেশ করা হচ্ছে...');

      localStorage.setItem('hf_auth_user', JSON.stringify(data.user));
      if (data.role) {
        localStorage.setItem('hf_society_role', data.role);
      }
      if (data.memberId) {
        localStorage.setItem('hf_society_member_id', data.memberId);
      }

      setTimeout(() => {
        onLoginSuccess(data.user, data.sessionToken);
      }, 450);
    } catch (err: any) {
      setErrorMessage(err.message || 'নেটওয়ার্ক সমস্যা বা অকার্যকর ক্রেডেনশিয়াল');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string, autoSubmit = false) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
    if (autoSubmit) {
      setTimeout(() => {
        setIsLoading(true);
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              setSuccessMessage('স্বাগতম! সফটওয়্যারে প্রবেশ করা হচ্ছে...');
              localStorage.setItem('hf_auth_user', JSON.stringify(data.user));
              if (data.role) localStorage.setItem('hf_society_role', data.role);
              if (data.memberId) localStorage.setItem('hf_society_member_id', data.memberId);
              setTimeout(() => onLoginSuccess(data.user, data.sessionToken), 350);
            } else {
              setErrorMessage(data.error || 'লগ ইন ব্যর্থ হয়েছে');
            }
          })
          .catch((err) => setErrorMessage(err.message))
          .finally(() => setIsLoading(false));
      }, 50);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#041f1a] text-slate-100 overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* =====================================================================
       * LAYER 1: BESPOKE COOPERATIVE SOCIETY ARCHITECTURAL & HERITAGE BACKDROP
       * =================================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Rich Emerald, Royal Teal & Warm Gold Cooperative Gradient Mesh */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 18% 22%, rgba(16, 185, 129, 0.24) 0%, transparent 45%), radial-gradient(circle at 85% 18%, rgba(217, 119, 6, 0.18) 0%, transparent 40%), radial-gradient(circle at 50% 85%, rgba(13, 148, 136, 0.28) 0%, transparent 55%), linear-gradient(135deg, #031713 0%, #062c24 45%, #08382e 75%, #041b17 100%)',
          }}
        />

        {/* Intricate Islamic & Cooperative Geometric Lattice (Rub el Hizb / Unity Star) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.085]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="hilful-cooperative-pattern"
              x="0"
              y="0"
              width="120"
              height="120"
              patternUnits="userSpaceOnUse"
            >
              <polygon
                points="60,8 75,35 105,35 82,55 90,85 60,68 30,85 38,55 15,35 45,35"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1"
              />
              <rect
                x="32"
                y="32"
                width="56"
                height="56"
                fill="none"
                stroke="#34d399"
                strokeWidth="0.9"
              />
              <rect
                x="32"
                y="32"
                width="56"
                height="56"
                transform="rotate(45 60 60)"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="0.9"
              />
              <circle cx="60" cy="60" r="14" fill="none" stroke="#10b981" strokeWidth="1" />
              <circle cx="60" cy="60" r="4" fill="#fbbf24" opacity="0.6" />
              <path
                d="M0,60 L32,60 M88,60 L120,60 M60,0 L60,32 M60,88 L60,120"
                stroke="#34d399"
                strokeWidth="0.6"
                strokeDasharray="3,3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hilful-cooperative-pattern)" />
        </svg>

        {/* Bottom Cooperative Architectural & Prosperity Landscape Silhouette */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-56 sm:h-72 opacity-20"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="coop-arch-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#d97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <path
            fill="url(#coop-arch-grad)"
            d="M0,224L60,213.3C120,203,240,181,360,186.7C480,192,600,224,720,218.7C840,213,960,171,1080,165.3C1200,160,1320,192,1380,208L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
          <path
            fill="#022c22"
            opacity="0.7"
            d="M120,320 L120,210 L165,180 L210,210 L210,320 Z M230,320 L230,230 L290,230 L290,320 Z M1120,320 L1120,195 Q1165,145 1210,195 L1210,320 Z M1230,320 L1230,220 L1300,220 L1300,320 Z"
          />
        </svg>

        {/* Golden Rim Vignette Frame */}
        <div className="absolute inset-3 sm:inset-5 border border-amber-400/15 rounded-3xl pointer-events-none" />
      </div>

      {/* =====================================================================
       * LAYER 2: CENTERED USERNAME & PASSWORD LOGIN VAULT
       * =================================================================== */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="bg-[#05231d]/90 backdrop-blur-2xl border border-emerald-500/35 rounded-3xl shadow-2xl shadow-black/75 p-6 sm:p-8 relative overflow-hidden">
          {/* Top Gold & Emerald Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400" />

          {/* Society Official Emblem & Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-400/20 via-emerald-900/80 to-teal-950 p-2 shadow-xl border-2 border-amber-400/50 flex items-center justify-center backdrop-blur-md">
                <img
                  src={OFFICIAL_SOCIETY_LOGO_URL}
                  alt="হিলফুল ফুজুল বহুমুখী সমবায় সমিতি লোগো"
                  className="w-full h-full object-contain rounded-xl drop-shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('society-logo.jpg')) {
                      target.src = '/assets/society-logo.jpg';
                    }
                  }}
                />
              </div>
              <div
                className="absolute -bottom-1.5 -right-1.5 bg-amber-400 text-slate-950 p-1 rounded-lg shadow-lg border-2 border-[#041f1a]"
                title="সুরক্ষিত সমবায় পোর্টাল"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug">
              হিলফুল ফুজুল বহুমুখী সমবায় সমিতি লিঃ
            </h1>
            <p className="text-xs font-medium text-amber-300/90 mt-0.5">
              কমলাপুর, বিরুলিয়া, সাভার, ঢাকা - ১২১৬ · স্থাপিত: ২০১৯ ইং
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>মাল্টি-আইডেন্টিটি স্মার্ট লগইন</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                <RefreshCw className="w-3 h-3" />
                <span>প্রোফাইল অটো-সিঙ্কড</span>
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-400/50 text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-emerald-100 mb-1.5">
                ইউজার নেম / সদস্য আইডি / মোবাইল নম্বর
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/70 group-focus-within:text-amber-300 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="যেমন: superadmin, member04 বা 04 বা মোবাইল নম্বর"
                  autoComplete="username"
                  autoFocus
                  required
                  className="w-full pl-11 pr-4 py-3 bg-[#021410]/90 border border-emerald-700/70 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm transition-all"
                />
              </div>
              <p className="text-[11px] text-emerald-300/70 mt-1">
                ইউজার নেম (@member02), সদস্য আইডি (02–16) অথবা মোবাইল নম্বর দিয়ে লগইন করুন
              </p>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-emerald-100">
                  পাসওয়ার্ড / পিন (Password / PIN)
                </label>
                <span className="text-[11px] text-amber-300/90 font-medium">
                  প্রোফাইল ও স্টুডিও সিঙ্কড
                </span>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/70 group-focus-within:text-amber-300 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড বা পিন লিখুন..."
                  autoComplete="current-password"
                  required
                  className="w-full pl-11 pr-11 py-3 bg-[#021410]/90 border border-emerald-700/70 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-emerald-300/70 hover:text-amber-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-5 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-black/50 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>যাচাই করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>সফটওয়্যারে প্রবেশ করুন</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Quick Helper / Live Synced Credential Selector */}
          <div className="mt-5 pt-4 border-t border-emerald-800/60">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="text-xs text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {showDemoAccounts
                    ? 'একাউন্ট তালিকা লুকান'
                    : 'দ্রুত প্রবেশের লাইভ একাউন্ট তালিকা দেখুন'}
                </span>
              </button>
            </div>

            {showDemoAccounts && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#021410]/95 border border-emerald-800/80 text-xs space-y-2.5 max-h-60 overflow-y-auto">
                <div className="text-[11px] font-semibold text-amber-300/90">
                  লাইভ সিঙ্কড লগইন একাউন্টসমূহ (ক্লিক করলেই প্রবেশ করবে):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickAccounts.map((acc) => {
                    const isSuper = acc.role === 'SUPER_ADMIN';
                    const isAdmin = acc.role === 'ADMIN';
                    return (
                      <button
                        key={acc.id || acc.username}
                        type="button"
                        onClick={() => handleQuickFill(acc.username, acc.password, true)}
                        className={`p-2.5 rounded-lg text-left transition border ${
                          isSuper
                            ? 'bg-emerald-950/70 border-amber-400/40 hover:border-amber-300'
                            : isAdmin
                            ? 'bg-emerald-950/70 border-emerald-500/40 hover:border-emerald-300'
                            : 'bg-slate-900/90 border-emerald-800/70 hover:border-emerald-500'
                        }`}
                      >
                        <div
                          className={`font-bold text-[11px] truncate ${
                            isSuper
                              ? 'text-amber-300'
                              : isAdmin
                              ? 'text-emerald-300'
                              : 'text-white'
                          }`}
                        >
                          {acc.memberId ? `#${acc.memberId} ` : ''}
                          {acc.fullNameBn}
                        </div>
                        <div className="text-[10px] text-emerald-200/90 font-mono mt-0.5 truncate">
                          @{acc.username} | Pass: {acc.password}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
