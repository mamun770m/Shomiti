import React, { useState, useRef } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  User,
  Users,
  Shield,
  ShieldCheck,
  Printer,
  Edit3,
  Camera,
  Upload,
  X,
  Save,
  Lock,
  MessageSquarePlus,
  Send,
  CheckCircle2,
  Award,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  HeartPulse,
  Briefcase,
  FileCheck2,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { formatBDT, compressImageFile } from '../lib/utils.ts';
import { SocietyLogoAvatar } from './SocietyHomePage.tsx';

export interface MemberData {
  id: number;
  memberId: string;
  username?: string;
  lastLoginAt?: string | null;
  name: string;
  nameBn: string;
  fatherName?: string;
  motherName?: string;
  mobile: string;
  email?: string;
  address?: string;
  nidNumber?: string;
  bloodGroup?: string;
  occupation?: string;
  joiningDate: string;
  status: string;
  monthlyShareDeposit?: number;
  monthlyPayableAmount?: number;
  monthlyFinePolicy?: number;
  downPaymentTarget?: number;
  photoUrl?: string;
  loginPin?: string;
  // Nominee fields
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeMobile?: string;
  nomineeNid?: string;
  nomineeSharePercent?: number;
  nomineePhotoUrl?: string;
  remarks?: string;
  committeeRole?: string;
  // Calculated financial figures
  lifetimeShareDeposit?: number;
  lifetimePayable?: number;
  lifetimeFine?: number;
  lifetimeOtherReceive?: number;
  lifetimeDownPayment?: number;
  lifetimeTotalReceived?: number;
  historicalDue2024?: number;
  currentOutstanding?: number;
}

interface MemberProfileModalProps {
  member: MemberData | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'MEMBER';
  currentMemberId?: string;
  societyLogoUrl?: string;
  committeeRoleLabel?: string;
  authHeaders: Record<string, string>;
  initialEditMode?: boolean;
  onClose: () => void;
  onMemberUpdated: (updatedMember?: any) => Promise<void>;
  onOpenLedger?: (memberId: string) => void;
  onSwitchActiveMember?: (memberId: string) => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  member,
  role,
  currentMemberId,
  societyLogoUrl = 'preset:emerald-crest',
  committeeRoleLabel,
  authHeaders,
  initialEditMode = false,
  onClose,
  onMemberUpdated,
  onOpenLedger,
  onSwitchActiveMember,
}) => {
  const isSelf = Boolean(member && currentMemberId && member.memberId === currentMemberId);
  const canEdit = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isMemberRole = role === 'MEMBER';

  const memberPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const nomineePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = useState<boolean>(Boolean(initialEditMode && canEdit));
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingMemberPhoto, setUploadingMemberPhoto] = useState<boolean>(false);
  const [uploadingNomineePhoto, setUploadingNomineePhoto] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Quick Security Vault states (Direct Username & Password Sync with User Management Studio)
  const [showVaultPassword, setShowVaultPassword] = useState<boolean>(false);
  const [isEditingVault, setIsEditingVault] = useState<boolean>(false);
  const [vaultUsername, setVaultUsername] = useState<string>('');
  const [vaultPassword, setVaultPassword] = useState<string>('');
  const [copiedVault, setCopiedVault] = useState<boolean>(false);

  // Member comment publishing state
  const [commentText, setCommentText] = useState<string>('');
  const [commentCategory, setCommentCategory] = useState<string>('সদস্যের মতামত ও পরামর্শ');
  const [publishingComment, setPublishingComment] = useState<boolean>(false);

  // Form states & sync guards
  const [formData, setFormData] = useState<Partial<MemberData>>({});
  const loadedMemberIdRef = useRef<string | null>(null);
  const isUploadingOrSavingRef = useRef<boolean>(false);

  React.useEffect(() => {
    if (!member) {
      loadedMemberIdRef.current = null;
      return;
    }
    const defaultUname =
      member.username ||
      (member.memberId === '09'
        ? 'superadmin'
        : member.memberId === '02'
        ? 'admin'
        : `member${member.memberId}`);
    const defaultPin =
      member.loginPin || (member.memberId === '09' ? '7709' : member.memberId === '02' ? '2026' : '1234');

    if (loadedMemberIdRef.current !== member.memberId) {
      loadedMemberIdRef.current = member.memberId;
      setIsEditing(Boolean(initialEditMode && canEdit));
      setFormData({ ...member, username: defaultUname, loginPin: defaultPin });
      setVaultUsername(defaultUname);
      setVaultPassword(defaultPin);
      setIsEditingVault(false);
      setCommentText(member.remarks || '');
    } else if (!isEditing && !isUploadingOrSavingRef.current) {
      // Same member refreshed in background: only update calculated/server fields without wiping user inputs
      setFormData((prev) => ({
        ...member,
        ...prev,
        username: member.username || prev.username || defaultUname,
        loginPin: member.loginPin || prev.loginPin || defaultPin,
        photoUrl: prev.photoUrl || member.photoUrl,
        nomineePhotoUrl: prev.nomineePhotoUrl || member.nomineePhotoUrl,
        lifetimeTotalReceived: member.lifetimeTotalReceived,
        currentOutstanding: member.currentOutstanding,
        lifetimeDownPayment: member.lifetimeDownPayment,
        lifetimeShareDeposit: member.lifetimeShareDeposit,
      }));
      if (!isEditingVault) {
        setVaultUsername(member.username || defaultUname);
        setVaultPassword(member.loginPin || defaultPin);
      }
    }
  }, [member, initialEditMode, canEdit, isEditing, isEditingVault]);

  if (!member) return null;

  const display = { ...member, ...formData };
  const resolvedUsername =
    display.username ||
    (member.memberId === '09'
      ? 'superadmin'
      : member.memberId === '02'
      ? 'admin'
      : `member${member.memberId}`);
  const resolvedPassword =
    display.loginPin ||
    (member.memberId === '09' ? '7709' : member.memberId === '02' ? '2026' : '1234');

  const resolvedRoleTitle =
    committeeRoleLabel ||
    display.committeeRole ||
    (member.memberId === '09'
      ? 'সুপার এডমিন ও প্রতিষ্ঠাতা সদস্য'
      : 'প্রতিষ্ঠাতা ও কার্যনির্বাহী সদস্য');

  const totalReceived = Number(display.lifetimeTotalReceived || 0);
  const currentDue = Number(display.currentOutstanding || 0);
  const totalExpected = totalReceived + currentDue;
  const paymentCompletionPercent =
    totalExpected > 0 ? Math.min(100, Math.round((totalReceived / totalExpected) * 100)) : 100;

  const notifyGlobalCredentialSync = () => {
    window.dispatchEvent(
      new CustomEvent('hf_credentials_updated', {
        detail: { memberId: member.memberId, timestamp: Date.now() },
      })
    );
    window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
  };

  const persistPartialMemberUpdate = async (
    patch: Partial<MemberData>,
    successNotice: string
  ) => {
    try {
      isUploadingOrSavingRef.current = true;
      setSaving(true);
      setErrorMessage('');
      // Optimistically apply patch while keeping every field in formData intact
      const mergedForm = { ...formData, ...patch };
      setFormData((prev) => ({ ...prev, ...patch }));

      // Ensure auth headers match the member if self-updating
      const effectiveHeaders: Record<string, string> = {
        ...authHeaders,
        'Content-Type': 'application/json',
      };
      if (role === 'MEMBER') {
        effectiveHeaders['x-society-member-id'] = member.memberId;
      }

      // If admin/super_admin is editing fields and uploads a photo, persist all typed form fields together with the photo!
      const payloadToSave = canEdit ? mergedForm : patch;

      const res = await fetch(`/api/members/${encodeURIComponent(member.memberId)}`, {
        method: 'PUT',
        headers: effectiveHeaders,
        body: JSON.stringify(payloadToSave),
      });
      const result = await res.json();
      if (res.ok && result.member) {
        const finalMerged = { ...result.member, ...mergedForm, ...patch };
        setFormData((prev) => ({ ...result.member, ...prev, ...patch }));
        if (result.member.username) setVaultUsername(result.member.username);
        if (result.member.loginPin) setVaultPassword(result.member.loginPin);
        await onMemberUpdated(finalMerged);
        notifyGlobalCredentialSync();
        setStatusMessage(successNotice);
        setTimeout(() => setStatusMessage(''), 5000);
      } else {
        setErrorMessage(result.error || 'তথ্য সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setSaving(false);
      setTimeout(() => {
        isUploadingOrSavingRef.current = false;
      }, 1500);
    }
  };

  const handleMemberPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // If in MEMBER role viewing another member, switch active member context first so self-update works seamlessly
    if (role === 'MEMBER' && !isSelf && onSwitchActiveMember) {
      onSwitchActiveMember(member.memberId);
    }

    try {
      isUploadingOrSavingRef.current = true;
      setUploadingMemberPhoto(true);
      setErrorMessage('');
      const compressedDataUrl = await compressImageFile(file, 600, 0.86);
      setFormData((prev) => ({ ...prev, photoUrl: compressedDataUrl }));
      await persistPartialMemberUpdate(
        { photoUrl: compressedDataUrl },
        'সদস্যের প্রোফাইল ছবি ও তথ্য সফলভাবে আপলোড ও ডাটাবেজে সংরক্ষিত হয়েছে!'
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'সদস্যের ছবি আপলোড করতে সমস্যা হয়েছে');
    } finally {
      setUploadingMemberPhoto(false);
    }
  };

  const handleNomineePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (role === 'MEMBER' && !isSelf && onSwitchActiveMember) {
      onSwitchActiveMember(member.memberId);
    }

    try {
      isUploadingOrSavingRef.current = true;
      setUploadingNomineePhoto(true);
      setErrorMessage('');
      const compressedDataUrl = await compressImageFile(file, 600, 0.86);
      setFormData((prev) => ({ ...prev, nomineePhotoUrl: compressedDataUrl }));
      await persistPartialMemberUpdate(
        { nomineePhotoUrl: compressedDataUrl },
        'মনোনীত নমিনির ছবি ও তথ্য সফলভাবে আপলোড ও ডাটাবেজে সংরক্ষিত হয়েছে!'
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'নমিনির ছবি আপলোড করতে সমস্যা হয়েছে');
    } finally {
      setUploadingNomineePhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      isUploadingOrSavingRef.current = true;
      setSaving(true);
      setErrorMessage('');
      const effectiveHeaders: Record<string, string> = {
        ...authHeaders,
        'Content-Type': 'application/json',
      };
      if (role === 'MEMBER') {
        effectiveHeaders['x-society-member-id'] = member.memberId;
      }

      const res = await fetch(`/api/members/${encodeURIComponent(member.memberId)}`, {
        method: 'PUT',
        headers: effectiveHeaders,
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (res.ok && result.member) {
        const finalMerged = { ...result.member, ...formData };
        setFormData(finalMerged);
        if (result.member.username) setVaultUsername(result.member.username);
        if (result.member.loginPin) setVaultPassword(result.member.loginPin);
        await onMemberUpdated(finalMerged);
        notifyGlobalCredentialSync();
        setIsEditing(false);
        setStatusMessage(
          'সদস্যের প্রোফাইল ও পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে এবং "ইউজার নেম ও পাসওয়ার্ড ব্যবস্থাপনা স্টুডিও"-তে স্বয়ংক্রিয়ভাবে আপডেট হয়েছে!'
        );
        setTimeout(() => setStatusMessage(''), 5500);
      } else {
        setErrorMessage(result.error || 'তথ্য সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setSaving(false);
      setTimeout(() => {
        isUploadingOrSavingRef.current = false;
      }, 1500);
    }
  };

  const handleSaveQuickVaultCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = String(vaultPassword || '').trim();
    const cleanUsername = String(vaultUsername || '').trim().toLowerCase();
    if (cleanPassword.length < 3) {
      setErrorMessage('পাসওয়ার্ড বা পিন কমপক্ষে ৩ অক্ষরের হতে হবে।');
      return;
    }
    await persistPartialMemberUpdate(
      {
        loginPin: cleanPassword,
        username: cleanUsername || resolvedUsername,
      },
      `পাসওয়ার্ড ও ইউজার নেম (@${cleanUsername || resolvedUsername}) প্রোফাইল এবং "ইউজার নেম ও পাসওয়ার্ড ব্যবস্থাপনা স্টুডিও"-তে সাথে সাথে আপডেট হয়েছে!`
    );
    setIsEditingVault(false);
  };

  const handleCopyVaultCredentials = () => {
    const text = `হিলফুল ফুজুল সমবায় সমিতি — লগইন ক্রেডেনশিয়াল:\nসদস্য: ${display.nameBn || display.name} (#${member.memberId})\nইউজার নেম: ${resolvedUsername}\nপাসওয়ার্ড / পিন: ${resolvedPassword}\nমোবাইল: ${display.mobile}`;
    navigator.clipboard.writeText(text);
    setCopiedVault(true);
    setTimeout(() => setCopiedVault(false), 2500);
  };

  const handlePublishMemberComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) {
      setErrorMessage('দয়া করে আপনার মন্তব্য বা মতামত লিখুন।');
      return;
    }
    try {
      setPublishingComment(true);
      setErrorMessage('');
      const effectiveHeaders: Record<string, string> = {
        ...authHeaders,
        'Content-Type': 'application/json',
      };
      if (role === 'MEMBER') {
        effectiveHeaders['x-society-member-id'] = member.memberId;
      }

      const res = await fetch('/api/member-comments', {
        method: 'POST',
        headers: effectiveHeaders,
        body: JSON.stringify({
          memberId: member.memberId,
          comment: trimmed,
          category: commentCategory,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setFormData((prev) => ({ ...prev, remarks: trimmed }));
        await onMemberUpdated();
        setStatusMessage(
          'আপনার মন্তব্য সফলভাবে প্রকাশিত হয়েছে এবং সমিতির হোমপেজে প্রদর্শিত হচ্ছে!'
        );
        setTimeout(() => setStatusMessage(''), 5000);
      } else {
        setErrorMessage(result.error || 'মন্তব্য প্রকাশ করতে সমস্যা হয়েছে');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'মন্তব্য প্রকাশ করতে সমস্যা হয়েছে');
    } finally {
      setPublishingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Hidden file inputs for direct Member & Nominee photo uploads */}
      <input
        ref={memberPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleMemberPhotoUpload}
        className="hidden"
      />
      <input
        ref={nomineePhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleNomineePhotoUpload}
        className="hidden"
      />

      <div className="relative my-4 max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        {/* ===================================================================
         * STICKY EXECUTIVE TOP BAR
         * ================================================================= */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 no-print">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-50 px-2.5 py-1 font-mono text-xs font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300">
              <Award className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              সদস্য ডিজিটাল পাসবই #{member.memberId}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              সনদ নং: HF-SH-2019-{member.memberId}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMemberRole && !isSelf && onSwitchActiveMember && (
              <button
                type="button"
                onClick={() => onSwitchActiveMember(member.memberId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                সদস্য #{member.memberId} হিসেবে এডিট সক্রিয় করুন
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              প্রোফাইল প্রিন্ট
            </button>

            {canEdit &&
              (!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap shrink-0 shadow-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  তথ্য ও নমিনি এডিট করুন
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  এডিট বাতিল
                </button>
              ))}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status & Error Notifications */}
        {statusMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-teal-400 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-900 dark:border-teal-700 dark:bg-teal-950/80 dark:text-teal-200 shadow-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            {errorMessage}
          </div>
        )}

        {/* ===================================================================
         * MAIN PROFILE VAULT CONTENT
         * ================================================================= */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* 1. ROYAL COOPERATIVE IDENTITY BANNER */}
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 p-6 text-white shadow-lg">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Member Primary Identity */}
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative shrink-0 flex flex-col items-center gap-2">
                  <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-2 border-teal-400 bg-slate-900 shadow-xl">
                    {display.photoUrl ? (
                      <img
                        src={display.photoUrl}
                        alt={display.nameBn}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-teal-950/80 text-teal-300 p-2 text-center">
                        <User className="h-10 w-10 opacity-75" />
                        <span className="mt-1 font-mono text-xs font-bold">#{member.memberId}</span>
                      </div>
                    )}
                    {uploadingMemberPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-[10px] font-bold text-teal-300">
                        আপলোড হচ্ছে...
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => memberPhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-400/50 bg-teal-500/20 px-2.5 py-1 text-[11px] font-bold text-teal-200 hover:bg-teal-500/40 transition-colors no-print"
                  >
                    <Camera className="h-3 w-3 text-teal-300" />
                    {display.photoUrl ? 'সদস্য ছবি পরিবর্তন' : 'সদস্য ছবি যুক্ত করুন'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-teal-400/40 bg-teal-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-300">
                      সদস্য আইডি: #{member.memberId}
                    </span>
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                      {resolvedRoleTitle}
                    </span>
                    <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-0.5 font-mono text-[11px] text-slate-200">
                      সদস্যকাল: ২০১৯ – ২০২৬
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {display.nameBn || member.nameBn}
                  </h2>
                  <p className="text-sm font-medium text-teal-200/90">
                    {display.name || member.name}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-teal-400" />
                      <span className="font-mono font-semibold">{display.mobile}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 text-teal-400" />
                      <span>পেশা: {display.occupation || 'ব্যবসায়ী'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
                      <span>রক্তের গ্রুপ: <strong className="text-rose-300">{display.bloodGroup || 'A+'}</strong></span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Official Seal & Financial Standing Badge */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between border-t border-white/10 pt-4 lg:border-t-0 lg:pt-0 shrink-0 gap-2">
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-teal-300">হিলফুল ফুজুল সমবায় সমিতি</p>
                    <p className="font-mono text-[10px] text-slate-400">স্থাপিত: ২০১৯ ইং · ঢাকা</p>
                  </div>
                  <SocietyLogoAvatar logoUrl={societyLogoUrl} size="md" />
                </div>

                <div className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-right">
                  <p className="text-[10px] text-slate-300">মোট পরিশোধিত তহবিল (২০১৯–২৬)</p>
                  <p className="font-mono text-base font-bold tabular-nums text-emerald-300">
                    {formatBDT(totalReceived)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. EDIT FORM OR EXECUTIVE DUAL IDENTITY VAULT */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
              {/* Section 1: Member Personal Info Edit */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5 mb-4 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      ১. সদস্যের ব্যক্তিগত পরিচিতি সংশোধন (Member Personal Information)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      এখানে পরিবর্তিত যেকোনো তথ্য সাথে সাথে PostgreSQL ডাটাবেজে স্থায়ীভাবে সংরক্ষিত হবে
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-teal-500/40 bg-slate-200 dark:bg-slate-800">
                      {formData.photoUrl ? (
                        <img
                          src={formData.photoUrl}
                          alt="Member preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                          #{member.memberId}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => memberPhotoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      সদস্যের ছবি আপলোড করুন
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      সদস্যের নাম (বাংলা) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nameBn || ''}
                      onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Member Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      মোবাইল নম্বর (Mobile Number) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      পিতার নাম (Father&apos;s Name)
                    </label>
                    <input
                      type="text"
                      value={formData.fatherName || ''}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      মাতার নাম (Mother&apos;s Name)
                    </label>
                    <input
                      type="text"
                      value={formData.motherName || ''}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      জাতীয় পরিচয়পত্র (NID / Smart Card)
                    </label>
                    <input
                      type="text"
                      value={formData.nidNumber || ''}
                      onChange={(e) => setFormData({ ...formData, nidNumber: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      রক্তের গ্রুপ (Blood Group)
                    </label>
                    <select
                      value={formData.bloodGroup || 'A+'}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      পেশা (Occupation)
                    </label>
                    <input
                      type="text"
                      value={formData.occupation || ''}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-3 rounded-xl border border-amber-400/50 bg-amber-50/50 p-3.5 dark:border-amber-700/60 dark:bg-amber-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          লগইন ইউজার নেম ও পাসওয়ার্ড / পিন (অটোমেটিক ইউজার ম্যানেজমেন্ট স্টুডিও সিঙ্ক)
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <RefreshCw className="h-3 w-3" />
                        ইউজার নেম ও পাসওয়ার্ড স্টুডিওতে সাথে সাথে আপডেট হবে
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300">
                          লগইন ইউজার নেম (Login Username) *
                        </label>
                        <input
                          type="text"
                          value={formData.username || resolvedUsername}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              username: e.target.value.toLowerCase().trim(),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-amber-400/60 bg-white px-3 py-2 font-mono font-bold text-slate-900 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-300"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block font-semibold text-slate-700 dark:text-slate-300">
                            সদস্য লগইন পাসওয়ার্ড / পিন (Password / PIN) *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const rand = Math.floor(1000 + Math.random() * 9000).toString();
                              setFormData({ ...formData, loginPin: rand });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:underline dark:text-teal-400"
                          >
                            <Sparkles className="h-3 w-3" />
                            নতুন র্যান্ডম পিন
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.loginPin || '1234'}
                          onChange={(e) => setFormData({ ...formData, loginPin: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-amber-400/60 bg-white px-3 py-2 font-mono font-bold text-slate-900 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      ইমেইল (Email Address)
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      স্থায়ী ও বর্তমান ঠিকানা (Address)
                    </label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Nominee Details & Direct Photo Studio */}
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/40 p-5 dark:border-emerald-800/70 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-200/80 pb-4 mb-4 dark:border-emerald-800/60">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ২. মনোনীত নমিনি ও নমিনির ছবি সংযোজন (Nominee Information & Photo Upload)
                    </h3>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400">
                      নমিনির ছবি আপলোড করলে তাৎক্ষণিকভাবে প্রিভিউ দেখাবে এবং ডাটাবেজে সংরক্ষিত হবে
                    </p>
                  </div>

                  {/* Visual Nominee Photo Preview + Upload Button inside Form */}
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-white p-2 dark:border-emerald-800 dark:bg-slate-900">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-emerald-400 bg-emerald-50 dark:bg-slate-800">
                      {formData.nomineePhotoUrl ? (
                        <img
                          src={formData.nomineePhotoUrl}
                          alt="Nominee preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <Users className="h-5 w-5" />
                          <span>নমিনি</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => nomineePhotoInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {uploadingNomineePhoto
                          ? 'আপলোড হচ্ছে...'
                          : formData.nomineePhotoUrl
                          ? 'নমিনির ছবি পরিবর্তন করুন'
                          : 'নমিনির ছবি আপলোড করুন'}
                      </button>
                      <p className="text-[10px] text-slate-500">
                        মোবাইল বা কম্পিউটার থেকে যেকোনো ছবি সিলেক্ট করুন
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">
                      নমিনির পূর্ণ নাম (Nominee Full Name)
                    </label>
                    <input
                      type="text"
                      value={formData.nomineeName || ''}
                      onChange={(e) => setFormData({ ...formData, nomineeName: e.target.value })}
                      placeholder="যেমন: মোসাঃ ফাতেমা আক্তার"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">
                      সদস্যের সাথে সম্পর্ক (Relation)
                    </label>
                    <input
                      type="text"
                      value={formData.nomineeRelation || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, nomineeRelation: e.target.value })
                      }
                      placeholder="যেমন: স্ত্রী / স্বামী / পুত্র / কন্যা / মাতা / পিতা"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">
                      নমিনির মোবাইল নম্বর (Nominee Mobile)
                    </label>
                    <input
                      type="text"
                      value={formData.nomineeMobile || ''}
                      onChange={(e) => setFormData({ ...formData, nomineeMobile: e.target.value })}
                      placeholder="017XX-XXXXXX"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">
                      নমিনির জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন নম্বর (Nominee NID)
                    </label>
                    <input
                      type="text"
                      value={formData.nomineeNid || ''}
                      onChange={(e) => setFormData({ ...formData, nomineeNid: e.target.value })}
                      placeholder="NID / Birth Registration No"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">
                      অংশীদারিত্বের হার (% Share)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.nomineeSharePercent ?? 100}
                      onChange={(e) =>
                        setFormData({ ...formData, nomineeSharePercent: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-6 py-2.5 font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'সংরক্ষণ হচ্ছে...' : 'সদস্য ও নমিনির তথ্য সেভ করুন'}
                </button>
              </div>
            </form>
          ) : (
            /* ===============================================================
             * READ-ONLY UNIQUE DUAL IDENTITY CARDS (MEMBER + NOMINEE)
             * ============================================================= */
            <div className="space-y-6">
              {/* 2A. UNIFIED LOGIN USERNAME & PASSWORD SECURITY VAULT (LIVE 2-WAY SYNC WITH STUDIO) */}
              {(canEdit || isSelf || isMemberRole) && (
                <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 p-4 sm:p-5 text-white shadow-lg no-print">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/15 text-amber-300">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-white">
                            স্মার্ট লগইন ইউজার নেম ও পাসওয়ার্ড সিকিউরিটি ভল্ট
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            <RefreshCw className="h-2.5 w-2.5" />
                            ইউজার ম্যানেজমেন্ট স্টুডিওর সাথে দ্বিমুখী অটো-সিঙ্ক সক্রিয়
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          এখানে পাসওয়ার্ড বা ইউজার নেম পরিবর্তন করলে সাথে সাথে (ইউজার নেম ও পাসওয়ার্ড ব্যবস্থাপনা স্টুডিও) এবং লগইন স্ক্রিনে অটোমেটিক আপডেট হবে
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyVaultCredentials}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/20 transition"
                      >
                        {copiedVault ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-amber-300" />
                        )}
                        {copiedVault ? 'কপি হয়েছে!' : 'ক্রেডেনশিয়াল কপি'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVaultUsername(resolvedUsername);
                          setVaultPassword(resolvedPassword);
                          setIsEditingVault(!isEditingVault);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 transition shadow-sm"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {isEditingVault ? 'পরিবর্তন বাতিল' : 'পাসওয়ার্ড পরিবর্তন করুন'}
                      </button>
                    </div>
                  </div>

                  {!isEditingVault ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                      <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">লগইন ইউজার নেম</span>
                          <span className="font-mono text-sm font-bold text-emerald-300">
                            @{resolvedUsername}
                          </span>
                        </div>
                        <span className="rounded bg-emerald-950 px-2 py-0.5 font-mono text-[10px] text-emerald-300 border border-emerald-500/30">
                          ID: #{member.memberId}
                        </span>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">বর্তমান পাসওয়ার্ড / পিন</span>
                          <span className="font-mono text-sm font-bold text-amber-300">
                            {showVaultPassword ? resolvedPassword : '••••••••'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowVaultPassword(!showVaultPassword)}
                          className="rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-white/20"
                          title={showVaultPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                        >
                          {showVaultPassword ? (
                            <EyeOff className="h-4 w-4 text-amber-300" />
                          ) : (
                            <Eye className="h-4 w-4 text-amber-300" />
                          )}
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">বিকল্প লগইন মাধ্যম</span>
                          <span className="font-mono text-xs font-semibold text-teal-200">
                            মোবাইল: {display.mobile}
                          </span>
                        </div>
                        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSaveQuickVaultCredentials}
                      className="mt-4 rounded-xl border border-amber-400/40 bg-slate-950/90 p-4 space-y-3 text-xs"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
                            লগইন ইউজার নেম (Username)
                          </label>
                          <input
                            type="text"
                            value={vaultUsername}
                            onChange={(e) => setVaultUsername(e.target.value.toLowerCase().trim())}
                            disabled={!canEdit}
                            className="w-full rounded-lg border border-emerald-500/40 bg-slate-900 px-3 py-2 font-mono font-bold text-white disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-amber-300">
                              নতুন পাসওয়ার্ড / পিন (New Password) *
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setVaultPassword(
                                  Math.floor(1000 + Math.random() * 9000).toString()
                                )
                              }
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:underline"
                            >
                              <Sparkles className="h-3 w-3" />
                              র্যান্ডম পিন
                            </button>
                          </div>
                          <input
                            type="text"
                            required
                            value={vaultPassword}
                            onChange={(e) => setVaultPassword(e.target.value)}
                            placeholder="নতুন পাসওয়ার্ড বা পিন লিখুন..."
                            className="w-full rounded-lg border border-amber-400/60 bg-slate-900 px-3 py-2 font-mono font-bold text-amber-300 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 font-extrabold text-slate-950 hover:bg-emerald-400 transition shadow-md disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? 'সিঙ্ক হচ্ছে...' : 'পাসওয়ার্ড আপডেট ও সিঙ্ক করুন'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* LEFT 6 COLS: MEMBER PERSONAL IDENTITY CARD */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-6 dark:border-slate-800 dark:bg-slate-950">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                          <FileCheck2 className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            সদস্যের ব্যক্তিগত পরিচয়পত্র
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Verified Cooperative Member Bio-Data
                          </p>
                        </div>
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-500/30 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 no-print"
                        >
                          <Edit3 className="h-3 w-3" />
                          সংশোধন
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3.5 text-xs">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">পিতার নাম (Father)</p>
                        <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                          {display.fatherName || 'সমিতি সদস্য'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">মাতার নাম (Mother)</p>
                        <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                          {display.motherName || 'সংরক্ষিত'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">মোবাইল নম্বর</p>
                        <p className="mt-0.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                          {display.mobile || '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">জাতীয় পরিচয়পত্র (NID)</p>
                        <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white">
                          {display.nidNumber || 'যাচাইকৃত সদস্য'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">রক্তের গ্রুপ ও পেশা</p>
                        <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {display.bloodGroup || 'A+'}
                          </span>{' '}
                          · {display.occupation || 'ব্যবসায়ী'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">যোগদানের তারিখ</p>
                        <p className="mt-0.5 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {display.joiningDate || '2019-01-01'}
                        </p>
                      </div>

                      <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-400">স্থায়ী ও বর্তমান ঠিকানা</p>
                        <p className="mt-0.5 font-medium text-slate-900 dark:text-white">
                          {display.address || 'হিলফুল ফুজুল সমবায় সমিতি, ঢাকা'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
                    <span>মাসিক শেয়ার হার: {formatBDT(display.monthlyShareDeposit || 2000)}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      স্ট্যাটাস: সক্রিয় সদস্য
                    </span>
                  </div>
                </div>

                {/* RIGHT 6 COLS: VERIFIED NOMINEE CERTIFICATE & PHOTO STUDIO CARD */}
                <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/50 to-white p-5 shadow-2xs lg:col-span-6 dark:border-emerald-800/60 dark:from-emerald-950/25 dark:to-slate-950">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-3.5 dark:border-emerald-800/60">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                            মনোনীত নমিনির পরিচয় ও ছবি
                          </h3>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            Official Registered Nominee & Beneficiary
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full border border-emerald-500/30 bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {display.nomineeSharePercent || 100}% উত্তরাধিকারী
                      </span>
                    </div>

                    {/* Prominent Nominee Portrait + One-Click Upload Studio */}
                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-emerald-200/80 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/60 bg-emerald-50 shadow-sm dark:bg-slate-800">
                        {display.nomineePhotoUrl ? (
                          <img
                            src={display.nomineePhotoUrl}
                            alt={display.nomineeName || 'নমিনি'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center text-emerald-700 dark:text-emerald-300 p-2 text-center">
                            <Users className="h-8 w-8 opacity-75" />
                            <span className="mt-1 text-[10px] font-bold leading-tight">
                              নমিনির ছবি নেই
                            </span>
                          </div>
                        )}
                        {uploadingNomineePhoto && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-[10px] font-bold text-white">
                            আপলোড...
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {display.nomineeName || 'নমিনির নাম যুক্ত করুন'}
                        </div>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          সদস্যের সাথে সম্পর্ক: {display.nomineeRelation || 'স্ত্রী / পরিবার'}
                        </p>

                        <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 no-print">
                          <button
                            type="button"
                            onClick={() => nomineePhotoInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            {display.nomineePhotoUrl
                              ? 'নমিনির ছবি পরিবর্তন করুন'
                              : 'নমিনির ছবি পোস্ট / আপলোড করুন'}
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <Edit3 className="h-3 w-3" />
                              নমিনির তথ্য এডিট
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nominee Attributes Grid */}
                    <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-emerald-100 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <p className="text-[10px] font-medium text-slate-400">নমিনির মোবাইল নম্বর</p>
                        <p className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                          {display.nomineeMobile || display.mobile || '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-100 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <p className="text-[10px] font-medium text-slate-400">
                          নমিনির এনআইডি / জন্ম নিবন্ধন
                        </p>
                        <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white">
                          {display.nomineeNid || 'যাচাইকৃত'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-emerald-200/60 pt-3 text-[11px] text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300">
                    <span>মনোনীত অংশীদারিত্ব: শতভাগ বৈধ</span>
                    <span className="font-mono font-bold">
                      Share: {display.nomineeSharePercent || 100}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. FINANCIAL PASSBOOK & EQUITY STANDING (2019–2026) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      আর্থিক পাসবই ও তহবিল স্থিতি (Financial Passbook Summary 2019–2026)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      ২০১৯ থেকে ২০২৬ পর্যন্ত ৮ বছরের সমন্বিত শেয়ার, ডাউন পেমেন্ট, মোট জমা ও বকেয়া হিসাব
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      পরিশোধের হার:
                    </span>
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {paymentCompletionPercent}% সম্পন্ন
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${paymentCompletionPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-500">আপনার মোট শেয়ার আমানত</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-teal-700 dark:text-teal-400">
                      {formatBDT(member.lifetimeShareDeposit || 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-500">মোট ডাউন পেমেন্ট</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatBDT(member.lifetimeDownPayment || 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      সর্বমোট জমা (২০১৯–২৬)
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatBDT(member.lifetimeTotalReceived || 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      আপনার মোট বকেয়া
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatBDT(member.currentOutstanding || 0)}
                    </p>
                  </div>
                </div>

                {member.historicalDue2024 !== undefined && (
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
                    <span>
                      * ২০১৯–২০২৪ পর্যন্ত ঐতিহাসিক বকেয়া:{' '}
                      <strong className="font-mono text-slate-800 dark:text-slate-200">
                        {formatBDT(member.historicalDue2024 || 0)}
                      </strong>
                    </span>
                    <span>
                      ২০২৫–২০২৬ চলমান বকেয়া:{' '}
                      <strong className="font-mono text-amber-700 dark:text-amber-400">
                        {formatBDT(
                          Math.max(
                            0,
                            (member.currentOutstanding || 0) - (member.historicalDue2024 || 0)
                          )
                        )}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* 4. SELF-SERVICE PHOTO NOTICE FOR MEMBERS OR COMMENT STUDIO FOR ADMINS */}
              {!canEdit ? (
                <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900/50 dark:bg-teal-950/20 no-print">
                  <div className="flex items-center gap-3">
                    <Camera className="h-5 w-5 text-teal-700 dark:text-teal-400 shrink-0" />
                    <div className="text-xs text-teal-900 dark:text-teal-200">
                      <span className="font-bold">সদস্য সেলফ-সার্ভিস পোর্টাল:</span> এখান থেকে সকল সদস্য শুধুমাত্র নিজ নিজ ছবি এবং নমিনির ছবি পোস্ট বা পরিবর্তন করতে পারবেন। অন্যান্য তথ্য পরিবর্তনের সুযোগ কেবল প্রশাসনিক প্যানেলে সংরক্ষিত।
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/20 no-print">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquarePlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                        প্রশাসনিক মন্তব্য ও মতামত প্রকাশ (Publish Comment on Society Homepage)
                      </h3>
                    </div>
                    <span className="rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      সমিতির হোমপেজে সরাসরি প্রদর্শিত হবে
                    </span>
                  </div>

                  {display.remarks && (
                    <div className="mb-3 rounded-xl border border-indigo-200/80 bg-white p-3 text-xs text-slate-700 dark:border-indigo-800/60 dark:bg-slate-900 dark:text-slate-300">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                        বর্তমানে প্রকাশিত মন্তব্য:
                      </p>
                      <p className="italic">“{display.remarks}”</p>
                    </div>
                  )}

                  <form onSubmit={handlePublishMemberComment} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          প্রশাসনিক মন্তব্য বা নোট লিখুন *
                        </label>
                        <textarea
                          rows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="হিলফুল ফুজুল সমবায় সমিতি সম্পর্কে মূল্যবান মন্তব্য বা নোট লিখুন..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="flex flex-col justify-between gap-2">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            মন্তব্যের ধরন (Category)
                          </label>
                          <select
                            value={commentCategory}
                            onChange={(e) => setCommentCategory(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          >
                            <option value="সদস্যের মতামত ও পরামর্শ">সদস্যের মতামত ও পরামর্শ</option>
                            <option value="বিনিয়োগ ও উন্নয়ন প্রস্তাবনা">বিনিয়োগ ও উন্নয়ন প্রস্তাবনা</option>
                            <option value="শুভেচ্ছা ও সন্তুষ্টি বার্তা">শুভেচ্ছা ও সন্তুষ্টি বার্তা</option>
                            <option value="সাধারণ সভা সংক্রান্ত প্রস্তাব">সাধারণ সভা সংক্রান্ত প্রস্তাব</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={publishingComment}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {publishingComment ? 'প্রকাশ হচ্ছে...' : 'হোমপেজে মন্তব্য প্রকাশ করুন'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 no-print">
                <div className="text-xs text-slate-500">
                  নিরাপত্তা সনদ: সদস্য ও নমিনির সকল ছবি এবং তথ্য PostgreSQL ডাটাবেজে সংরক্ষিত।
                </div>

                <div className="flex items-center gap-2">
                  {onOpenLedger && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLedger(member.memberId);
                      }}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                    >
                      সম্পূর্ণ লেজার ও স্টেটমেন্ট দেখুন
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
