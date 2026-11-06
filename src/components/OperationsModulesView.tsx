import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch as fetch } from '../lib/netlifyStaticEngine.ts';
import {
  UserPlus,
  Search,
  Edit3,
  Power,
  Download,
  PlusCircle,
  Printer,
  Shield,
  CheckCircle2,
  Landmark,
  Briefcase,
  Bell,
  Trash2,
  Lock,
  KeyRound,
  Save,
  X,
  Camera,
  User,
  Users,
} from 'lucide-react';
import { formatBDT, compressImageFile } from '../lib/utils.ts';
import { exportReportData } from '../lib/exportUtils.ts';

/* ============================================================================
 * 1. MEMBER MANAGEMENT MODULE
 * ========================================================================== */
export const MemberManagementSection: React.FC<{
  role: string;
  members: any[];
  authHeaders: Record<string, string>;
  onOpenMemberLedger: (memberId: string) => void;
  onDataMutated: () => void;
  onOpenMemberProfile?: (member: any) => void;
}> = ({ role, members, authHeaders, onOpenMemberLedger, onDataMutated, onOpenMemberProfile }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const memberPhotoRef = useRef<HTMLInputElement | null>(null);
  const nomineePhotoRef = useRef<HTMLInputElement | null>(null);

  // Form states
  const [formMemberId, setFormMemberId] = useState<string>('17');
  const [formName, setFormName] = useState<string>('');
  const [formNameBn, setFormNameBn] = useState<string>('');
  const [formFather, setFormFather] = useState<string>('');
  const [formMother, setFormMother] = useState<string>('');
  const [formNidNumber, setFormNidNumber] = useState<string>('');
  const [formBloodGroup, setFormBloodGroup] = useState<string>('');
  const [formOccupation, setFormOccupation] = useState<string>('');
  const [formLoginPin, setFormLoginPin] = useState<string>('1234');
  const [formMobile, setFormMobile] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formJoiningDate, setFormJoiningDate] = useState<string>('2026-01-01');
  const [formShareDeposit, setFormShareDeposit] = useState<number>(2000);
  const [formPayable, setFormPayable] = useState<number>(50);
  const [formFinePolicy, setFormFinePolicy] = useState<number>(50);
  const [formDownPaymentTarget, setFormDownPaymentTarget] = useState<number>(82000);
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [formNomineeName, setFormNomineeName] = useState<string>('');
  const [formNomineeRelation, setFormNomineeRelation] = useState<string>('');
  const [formNomineeMobile, setFormNomineeMobile] = useState<string>('');
  const [formNomineeNid, setFormNomineeNid] = useState<string>('');
  const [formNomineeSharePercent, setFormNomineeSharePercent] = useState<number>(100);
  const [formNomineePhotoUrl, setFormNomineePhotoUrl] = useState<string>('');

  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(role);

  const filteredMembers = members.filter((m) => {
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.memberId.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.nameBn && m.nameBn.toLowerCase().includes(q)) ||
      m.mobile.toLowerCase().includes(q)
    );
  });

  const openCreateModal = () => {
    const nextNum = members.length + 5;
    setFormMemberId(String(nextNum).padStart(2, '0'));
    setFormName('');
    setFormNameBn('');
    setFormFather('');
    setFormMother('');
    setFormNidNumber('');
    setFormBloodGroup('');
    setFormOccupation('');
    setFormLoginPin('1234');
    setFormMobile('');
    setFormEmail('');
    setFormAddress('');
    setFormJoiningDate(new Date().toISOString().slice(0, 10));
    setFormShareDeposit(2000);
    setFormPayable(50);
    setFormFinePolicy(50);
    setFormDownPaymentTarget(82000);
    setFormRemarks('');
    setFormPhotoUrl('');
    setFormNomineeName('');
    setFormNomineeRelation('');
    setFormNomineeMobile('');
    setFormNomineeNid('');
    setFormNomineeSharePercent(100);
    setFormNomineePhotoUrl('');
    setEditingMember(null);
    setErrorMsg('');
    setShowAddModal(true);
  };

  const openEditModal = (m: any) => {
    setEditingMember(m);
    setFormMemberId(m.memberId);
    setFormName(m.name);
    setFormNameBn(m.nameBn || '');
    setFormFather(m.fatherName || '');
    setFormMother(m.motherName || '');
    setFormNidNumber(m.nidNumber || '');
    setFormBloodGroup(m.bloodGroup || '');
    setFormOccupation(m.occupation || '');
    setFormLoginPin(m.loginPin || '1234');
    setFormMobile(m.mobile);
    setFormEmail(m.email || '');
    setFormAddress(m.address || '');
    setFormJoiningDate(m.joiningDate);
    setFormShareDeposit(m.monthlyShareDeposit);
    setFormPayable(m.monthlyPayableAmount);
    setFormFinePolicy(m.monthlyFinePolicy);
    setFormDownPaymentTarget(m.downPaymentTarget);
    setFormRemarks(m.remarks || '');
    setFormPhotoUrl(m.photoUrl || '');
    setFormNomineeName(m.nomineeName || '');
    setFormNomineeRelation(m.nomineeRelation || '');
    setFormNomineeMobile(m.nomineeMobile || '');
    setFormNomineeNid(m.nomineeNid || '');
    setFormNomineeSharePercent(m.nomineeSharePercent ?? 100);
    setFormNomineePhotoUrl(m.nomineePhotoUrl || '');
    setErrorMsg('');
    setShowAddModal(true);
  };

  const buildCurrentMemberPayload = (overrides: Record<string, any> = {}) => ({
    ...(editingMember || {}),
    memberId: formMemberId,
    name: formName,
    nameBn: formNameBn,
    fatherName: formFather,
    motherName: formMother,
    nidNumber: formNidNumber,
    bloodGroup: formBloodGroup,
    occupation: formOccupation,
    loginPin: formLoginPin,
    mobile: formMobile,
    email: formEmail,
    address: formAddress,
    joiningDate: formJoiningDate,
    monthlyShareDeposit: formShareDeposit,
    monthlyPayableAmount: formPayable,
    monthlyFinePolicy: formFinePolicy,
    downPaymentTarget: formDownPaymentTarget,
    remarks: formRemarks,
    photoUrl: formPhotoUrl,
    nomineeName: formNomineeName,
    nomineeRelation: formNomineeRelation,
    nomineeMobile: formNomineeMobile,
    nomineeNid: formNomineeNid,
    nomineeSharePercent: formNomineeSharePercent,
    nomineePhotoUrl: formNomineePhotoUrl,
    ...overrides,
  });

  const handleMemberPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 600, 0.86);
      setFormPhotoUrl(compressed);
      if (editingMember) {
        const payload = buildCurrentMemberPayload({ photoUrl: compressed });
        await fetch(`/api/members/${encodeURIComponent(editingMember.memberId)}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onDataMutated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'ছবি প্রসেস করতে সমস্যা হয়েছে');
    }
  };

  const handleNomineePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 600, 0.86);
      setFormNomineePhotoUrl(compressed);
      if (editingMember) {
        const payload = buildCurrentMemberPayload({ nomineePhotoUrl: compressed });
        await fetch(`/api/members/${encodeURIComponent(editingMember.memberId)}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onDataMutated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'নমিনির ছবি প্রসেস করতে সমস্যা হয়েছে');
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const url = editingMember
        ? `/api/members/${encodeURIComponent(editingMember.memberId)}`
        : '/api/members';
      const method = editingMember ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildCurrentMemberPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save member');
      setShowAddModal(false);
      window.dispatchEvent(new CustomEvent('hf_credentials_updated'));
      onDataMutated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (m: any) => {
    if (!canManage) return;
    const nextStatus = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await fetch(`/api/members/${encodeURIComponent(m.memberId)}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
          reason: `Status toggled to ${nextStatus}`,
        }),
      });
      onDataMutated();
    } catch (err) {
      console.error('Toggle member status error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            সদস্য ব্যবস্থাপনা, নমিনি ও লেজার ডিরেক্টরি (Member & Nominee Directory)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            প্রত্যেক সদস্যের ছবি, মনোনীত নমিনির ছবি ও বিস্তারিত প্রোফাইল ব্যবস্থাপনা
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID (02, 04..16), Name, Mobile..."
              className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              নতুন সদস্য নিবন্ধন (Add Member)
            </button>
          )}
        </div>
      </div>

      {/* Members Directory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Member ID</th>
                <th className="px-3 py-3">সদস্যের ছবি ও নাম (Member)</th>
                <th className="px-3 py-3">মনোনীত নমিনি ও ছবি (Nominee)</th>
                <th className="px-3 py-3">Mobile & Joining</th>
                <th className="px-3 py-3 text-right">Total Share Deposit</th>
                <th className="px-3 py-3 text-right">Total Received</th>
                <th className="px-3 py-3 text-right">Current Due</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                    #{m.memberId}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-teal-500/30 bg-teal-50 dark:bg-slate-800">
                        {m.photoUrl ? (
                          <img
                            src={m.photoUrl}
                            alt={m.nameBn || m.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                            {m.memberId}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {m.nameBn || m.name}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {m.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-slate-800">
                        {m.nomineePhotoUrl ? (
                          <img
                            src={m.nomineePhotoUrl}
                            alt={m.nomineeName || 'Nominee'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            নমিনি
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {m.nomineeName || 'নমিনি সংযুক্ত করুন'}
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {m.nomineeRelation || 'স্ত্রী / পরিবার'} · {m.nomineeSharePercent || 100}%
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    <div>{m.mobile}</div>
                    <div className="text-slate-400">Joined: {m.joiningDate}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatBDT(m.lifetimeShareDeposit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatBDT(m.lifetimeTotalReceived)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatBDT(m.currentOutstanding)}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {onOpenMemberProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenMemberProfile(m)}
                        className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                        title="View & Edit Full Member Profile & Nominee Photo"
                      >
                        <Camera className="h-3 w-3" />
                        প্রোফাইল ও নমিনি ছবি
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenMemberLedger(m.memberId)}
                      className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
                    >
                      লেজার
                    </button>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(m)}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400"
                          title="Activate / Deactivate Member"
                        >
                          <Power className="h-3 w-3" />
                          {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <input
            ref={memberPhotoRef}
            type="file"
            accept="image/*"
            onChange={handleMemberPhotoSelect}
            className="hidden"
          />
          <input
            ref={nomineePhotoRef}
            type="file"
            accept="image/*"
            onChange={handleNomineePhotoSelect}
            className="hidden"
          />

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingMember
                  ? `সদস্য ও নমিনি তথ্য সম্পাদনা (#${editingMember.memberId})`
                  : 'নতুন সদস্য নিবন্ধন ফরম (Member Registration)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveMember} className="mt-4 space-y-4 text-xs">
              {/* Dual Photo Upload Strip (Member + Nominee) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900/50 dark:bg-teal-950/20">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-teal-400 bg-white dark:bg-slate-800">
                    {formPhotoUrl ? (
                      <img src={formPhotoUrl} alt="Member" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-teal-600">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">সদস্যের ছবি</p>
                    <button
                      type="button"
                      onClick={() => memberPhotoRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-700"
                    >
                      <Camera className="h-3 w-3" />
                      সদস্যের ছবি আপলোড
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-400 bg-white dark:bg-slate-800">
                    {formNomineePhotoUrl ? (
                      <img
                        src={formNomineePhotoUrl}
                        alt="Nominee"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-emerald-600">
                        <Users className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">নমিনির ছবি</p>
                    <button
                      type="button"
                      onClick={() => nomineePhotoRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                    >
                      <Camera className="h-3 w-3" />
                      নমিনির ছবি আপলোড
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Member ID (সদস্য আইডি)
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingMember}
                    value={formMemberId}
                    onChange={(e) => setFormMemberId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Joining Date (যোগদানের তারিখ)
                  </label>
                  <input
                    type="date"
                    required
                    value={formJoiningDate}
                    onChange={(e) => setFormJoiningDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Member Name (English)
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Md. Abdullah Al Mamun"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    সদস্যের নাম (বাংলায়)
                  </label>
                  <input
                    type="text"
                    value={formNameBn}
                    onChange={(e) => setFormNameBn(e.target.value)}
                    placeholder="মোঃ আব্দুল্লাহ আল মামুন"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Father&apos;s Name (পিতার নাম)
                  </label>
                  <input
                    type="text"
                    value={formFather}
                    onChange={(e) => setFormFather(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Mobile Number (মোবাইল নম্বর)
                  </label>
                  <input
                    type="text"
                    required
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-teal-700 dark:text-teal-300">
                    লগইন পাসওয়ার্ড / পিন ( স্টুডিও অটো-সিঙ্ক )
                  </label>
                  <input
                    type="text"
                    required
                    value={formLoginPin}
                    onChange={(e) => setFormLoginPin(e.target.value)}
                    placeholder="যেমন: 1234"
                    className="mt-1 w-full rounded-lg border border-teal-500/50 bg-teal-50/40 px-3 py-2 font-mono font-bold text-slate-900 dark:border-teal-700 dark:bg-slate-800 dark:text-amber-300"
                  />
                </div>
              </div>

              {/* Nominee Details Fields */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="font-bold text-emerald-900 dark:text-emerald-300">
                  মনোনীত নমিনির তথ্য (Nominee Information)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      নমিনির নাম (Nominee Name)
                    </label>
                    <input
                      type="text"
                      value={formNomineeName}
                      onChange={(e) => setFormNomineeName(e.target.value)}
                      placeholder="নমিনির নাম লিখুন"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      সম্পর্ক (Relation)
                    </label>
                    <input
                      type="text"
                      value={formNomineeRelation}
                      onChange={(e) => setFormNomineeRelation(e.target.value)}
                      placeholder="স্ত্রী / পিতা / মাতা / সন্তান"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      নমিনির মোবাইল (Nominee Mobile)
                    </label>
                    <input
                      type="text"
                      value={formNomineeMobile}
                      onChange={(e) => setFormNomineeMobile(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      নমিনির এনআইডি (Nominee NID)
                    </label>
                    <input
                      type="text"
                      value={formNomineeNid}
                      onChange={(e) => setFormNomineeNid(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Address (ঠিকানা)
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Share Deposit (৳)
                  </label>
                  <input
                    type="number"
                    value={formShareDeposit}
                    onChange={(e) => setFormShareDeposit(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Payable (৳)
                  </label>
                  <input
                    type="number"
                    value={formPayable}
                    onChange={(e) => setFormPayable(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Fine Policy (৳)
                  </label>
                  <input
                    type="number"
                    value={formFinePolicy}
                    onChange={(e) => setFormFinePolicy(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Down Target (৳)
                  </label>
                  <input
                    type="number"
                    value={formDownPaymentTarget}
                    onChange={(e) => setFormDownPaymentTarget(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Remarks / Member Opinion
                </label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
                >
                  {saving ? 'Saving...' : editingMember ? 'Update Member & Nominee' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. DOWN PAYMENT MANAGEMENT MODULE
 * ========================================================================== */
export const DownPaymentSection: React.FC<{
  data: any;
  role?: string;
  authHeaders?: Record<string, string>;
  onDataMutated?: () => void;
  onSelectReceipt: (receipt: any) => void;
}> = ({ data, role = 'MEMBER', authHeaders = {}, onDataMutated, onSelectReceipt }) => {
  const agreements = data?.agreements || [];
  const history = data?.history || [];
  const totals = data?.totals || { totalAgreed: 0, totalPaid: 0, totalRemaining: 0 };

  const canEdit = ['SUPER_ADMIN', 'ADMIN'].includes(role);
  const [editingAgreement, setEditingAgreement] = useState<any | null>(null);
  const [editAgreedAmount, setEditAgreedAmount] = useState<number>(82000);
  const [editPaidOverride, setEditPaidOverride] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('IN_PROGRESS');
  const [savingDp, setSavingDp] = useState<boolean>(false);

  const openEditAgreement = (a: any) => {
    setEditingAgreement(a);
    setEditAgreedAmount(a.agreedAmount || 82000);
    setEditPaidOverride(String(a.totalPaid ?? 0));
    setEditStatus(a.status || 'IN_PROGRESS');
  };

  const handleSaveAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgreement) return;
    setSavingDp(true);
    try {
      const res = await fetch(`/api/down-payments/${encodeURIComponent(editingAgreement.memberId)}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agreedAmount: editAgreedAmount,
          totalPaid: editPaidOverride !== '' ? Number(editPaidOverride) : undefined,
          status: editStatus,
        }),
      });
      if (res.ok) {
        setEditingAgreement(null);
        if (onDataMutated) onDataMutated();
      }
    } finally {
      setSavingDp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            ডাউন পেমেন্ট ব্যবস্থাপনা ও অগ্রগতি (Down Payment Management)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Formula: Remaining Down Payment = Agreed Down Payment − Approved Down Payment Payments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportReportData({
                title: 'Society-Wide Down Payment Agreement & Balance Report',
                fileName: 'Hilful_Fuzul_Down_Payment_Report',
                headers: ['Member ID', 'Member Name', 'Agreed Target', 'Total Paid', 'Remaining Down Payment', 'Last Payment Date', 'Receipt No', 'Status'],
                rows: agreements.map((a: any) => [
                  a.memberId,
                  a.memberName,
                  a.agreedAmount,
                  a.totalPaid,
                  a.remainingAmount,
                  a.lastPaymentDate || '-',
                  a.lastReceiptNo || '-',
                  a.status,
                ]),
                format: 'PDF',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export Down Payment Report (PDF)
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            নির্ধারিত মোট ডাউন পেমেন্ট (Total Agreed Target)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {formatBDT(totals.totalAgreed)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            অনুমোদিত আদায়কৃত ডাউন পেমেন্ট (Total Approved Paid)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatBDT(totals.totalPaid)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            অবশিষ্ট প্রাপ্য ডাউন পেমেন্ট (Remaining Down Payment)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {formatBDT(totals.totalRemaining)}
          </p>
        </div>
      </div>

      {/* Member-wise Down Payment Agreements Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            সদস্যভিত্তিক ডাউন পেমেন্ট হিসাব (Member-wise Down Payment Ledger)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Member ID</th>
                <th className="px-4 py-3">Member Name</th>
                <th className="px-4 py-3 text-right">Agreed Down Payment</th>
                <th className="px-4 py-3 text-right">Total Paid</th>
                <th className="px-4 py-3 text-right">Remaining Down Payment</th>
                <th className="px-4 py-3">Last Payment Date</th>
                <th className="px-4 py-3">Receipt No</th>
                <th className="px-4 py-3">Status</th>
                {canEdit && <th className="px-4 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {agreements.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                    {a.memberId}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                    {a.memberName}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatBDT(a.agreedAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatBDT(a.totalPaid)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatBDT(a.remainingAmount)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                    {a.lastPaymentDate || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {a.lastReceiptNo || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300">
                    {a.status}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openEditAgreement(a)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3 w-3" />
                        এডিট
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit Down Payment Agreement */}
      {editingAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ডাউন পেমেন্ট লক্ষ্যমাত্রা সংশোধন (#{editingAgreement.memberId})
              </h3>
              <button
                type="button"
                onClick={() => setEditingAgreement(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAgreement} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  নির্ধারিত ডাউন পেমেন্ট লক্ষ্যমাত্রা (Agreed Amount ৳)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editAgreedAmount}
                  onChange={(e) => setEditAgreedAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  মোট আদায়কৃত ডাউন পেমেন্ট (Total Paid ৳)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editPaidOverride}
                  onChange={(e) => setEditPaidOverride(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  স্ট্যাটাস (Status)
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAgreement(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingDp}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
                >
                  <Save className="h-4 w-4" />
                  {savingDp ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Down Payment Installment History */}
      {history.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              ডাউন পেমেন্ট কিস্তি ও রশিদ ইতিহাস (Down Payment Payment History)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Receipt Number</th>
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Payment Date</th>
                  <th className="px-4 py-2.5 text-right">Down Payment Amount</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map((h: any) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5 font-mono font-semibold">{h.receiptNo}</td>
                    <td className="px-4 py-2.5">
                      {h.memberId} · {h.memberName}
                    </td>
                    <td className="px-4 py-2.5 font-mono">{h.paymentDate}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600">
                      {formatBDT(h.downPayment)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectReceipt(h)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline"
                      >
                        <Printer className="h-3 w-3" />
                        Print Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. INCOME & EXPENSE MANAGEMENT MODULE (With Official 2019–2026 খরচের হিসাব)
 * ========================================================================== */
export const IncomeExpenseSection: React.FC<{
  role: string;
  data: any;
  authHeaders: Record<string, string>;
  onDataMutated: () => void;
}> = ({ role, data, authHeaders, onDataMutated }) => {
  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [category, setCategory] = useState<string>('Administrative Costs');
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<number>(5000);
  const [voucherYear, setVoucherYear] = useState<number>(2026);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>('CASH');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [filterYear, setFilterYear] = useState<number>(0); // 0 = All years
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Edit Single Voucher Modal State
  const [editingVoucher, setEditingVoucher] = useState<{
    type: 'income' | 'expense';
    voucher: any;
  } | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editYear, setEditYear] = useState<number>(2026);
  const [editDate, setEditDate] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('CASH');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // 1-Click Yearly Expense Total Editor Modal State
  const [editingYearExpense, setEditingYearExpense] = useState<{
    year: number;
    currentExpense: number;
  } | null>(null);
  const [yearTargetExpense, setYearTargetExpense] = useState<number>(0);
  const [yearExpenseTitle, setYearExpenseTitle] = useState<string>('');
  const [savingYearExpense, setSavingYearExpense] = useState<boolean>(false);

  const incomeCategories = [
    'Membership Fees',
    'Admission Fees',
    'Loan Interest',
    'Investment Profit',
    'Other Income',
  ];
  const expenseCategories = [
    'Administrative Costs',
    'Office Rent',
    'Salary',
    'Electricity',
    'Transportation',
    'Maintenance',
    'Other Expenses',
  ];

  const canRecord = ['SUPER_ADMIN', 'ACCOUNTANT', 'ADMIN'].includes(role);
  const yearsList = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

  const expensesList: any[] = data?.expenses || [];
  const incomesList: any[] = data?.incomes || [];

  // Build Yearly Expense Matrix (2019–2026)
  const yearlyMatrix = yearsList.map((yr) => {
    const fromServer = (data?.yearlyExpenseSummary || []).find((s: any) => s.year === yr);
    if (fromServer) return fromServer;
    const yrExps = expensesList.filter((e) => Number(e.year) === yr);
    const expSum = yrExps.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    return {
      year: yr,
      expense: expSum,
      collection: 0,
      netBalance: -expSum,
      voucherCount: yrExps.length,
    };
  });

  const grandTotalExpense = expensesList.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const grandTotalIncome = incomesList.reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const totalSocietyCollection =
    data?.totalCollection ||
    yearlyMatrix.reduce((acc, y) => acc + Number(y.collection || 0), 0);
  const netCashAfterExpenses = totalSocietyCollection - grandTotalExpense;

  const filteredExpenses = expensesList.filter(
    (e) => filterYear === 0 || Number(e.year) === filterYear
  );
  const filteredIncomes = incomesList.filter(
    (i) => filterYear === 0 || Number(i.year) === filterYear
  );

  const handleRecordVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) return;
    setSubmitting(true);
    try {
      const endpoint = entryType === 'INCOME' ? '/api/income' : '/api/expense';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          title: title.trim(),
          amount,
          year: voucherYear,
          transactionDate: txDate,
          paymentMethod: method,
        }),
      });
      if (res.ok) {
        setTitle('');
        onDataMutated();
        window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
        setStatusMsg(
          entryType === 'EXPENSE'
            ? `নতুন ব্যয় ভাউচার (৳${amount.toLocaleString()}) সফলভাবে সংরক্ষিত হয়েছে!`
            : `নতুন আয় ভাউচার (৳${amount.toLocaleString()}) সফলভাবে সংরক্ষিত হয়েছে!`
        );
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditVoucherModal = (type: 'income' | 'expense', v: any) => {
    setEditingVoucher({ type, voucher: v });
    setEditCategory(v.category || 'Administrative Costs');
    setEditTitle(v.title || '');
    setEditAmount(Number(v.amount || 0));
    setEditYear(Number(v.year || 2026));
    setEditDate(v.transactionDate || `${v.year || 2026}-12-31`);
    setEditMethod(v.paymentMethod || 'CASH');
  };

  const handleSaveEditVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucher) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/${editingVoucher.type}/${editingVoucher.voucher.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: editCategory,
          title: editTitle,
          amount: editAmount,
          year: editYear,
          transactionDate: editDate,
          paymentMethod: editMethod,
        }),
      });
      if (res.ok) {
        setEditingVoucher(null);
        onDataMutated();
        window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
        setStatusMsg('ভাউচারটি সফলভাবে সংশোধন ও ডাটাবেজে সংরক্ষিত হয়েছে!');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const openYearExpenseModal = (yr: number, currentExp: number) => {
    if (!canRecord) return;
    setEditingYearExpense({ year: yr, currentExpense: currentExp });
    setYearTargetExpense(currentExp);
    setYearExpenseTitle(`${yr} সালের মোট খরচ (সমিতির বাৎসরিক ও প্রকল্প ব্যয় হিসাব)`);
  };

  const handleSaveYearExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYearExpense) return;
    setSavingYearExpense(true);
    try {
      const res = await fetch('/api/expense/set-year-total', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: editingYearExpense.year,
          totalAmount: yearTargetExpense,
          title: yearExpenseTitle,
          category: 'Administrative Costs',
        }),
      });
      if (res.ok) {
        setEditingYearExpense(null);
        onDataMutated();
        window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
        setStatusMsg(
          `${editingYearExpense.year} সালের মোট খরচ (৳${yearTargetExpense.toLocaleString()}) সফলভাবে সংরক্ষিত হয়েছে!`
        );
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } finally {
      setSavingYearExpense(false);
    }
  };

  const handleDeleteVoucher = async (type: 'income' | 'expense', id: number) => {
    try {
      const res = await fetch(`/api/${type}/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        onDataMutated();
        window.dispatchEvent(new CustomEvent('hf_financial_sync_trigger'));
        setStatusMsg('ভাউচারটি সফলভাবে ডাটাবেজ থেকে মুছে ফেলা ও সমন্বয় করা হয়েছে!');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } catch {
      setStatusMsg('ভাউচার মুছে ফেলতে সমস্যা হয়েছে।');
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            খরচের হিসাব ও আয়-ব্যয় ভাউচার ব্যবস্থাপনা (2019–2026 Expense & Income Ledger)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ২০১৯ থেকে ২০২৬ পর্যন্ত বাৎসরিক খরচের হিসাব, নতুন ভাউচার এন্ট্রি, সংশোধন এবং স্বয়ংক্রিয় ডাবল-এন্ট্রি লেজার সমন্বয়
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportReportData({
                title: 'হিলফুল ফুজুল সমবায় সমিতি — বাৎসরিক খরচের হিসাব (২০১৯–২০২৬)',
                fileName: 'Hilful_Fuzul_Expense_Report_2019_2026',
                headers: ['Voucher No', 'Year', 'Date', 'Category', 'Title / Particulars', 'Method', 'Amount (BDT)'],
                rows: [
                  ...expensesList.map((e: any) => [
                    e.voucherNo,
                    e.year,
                    e.transactionDate,
                    e.category,
                    e.title,
                    e.paymentMethod,
                    e.amount,
                  ]),
                  ['TOTAL', '2019-2026', '-', 'All Categories', 'সর্বমোট খরচ (Grand Total Expenses)', '-', grandTotalExpense],
                ],
                format: 'PDF',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
          >
            <Download className="h-3.5 w-3.5" />
            খরচের হিসাব ডাউনলোড (PDF)
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top 3 Financial Summary Cards (Total Collection vs Total Expense vs Net Available Cash) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            সর্বমোট সদস্য জমা ও আদায় (২০১৯–২০২৬)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {formatBDT(totalSocietyCollection)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            শেয়ার আমানত + ডাউন পেমেন্ট + প্রদেয় ও অন্যান্য প্রাপ্তি
          </p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
            সর্বমোট খরচ (২০১৯–২০২৬ মোট ব্যয় হিসাব)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {formatBDT(grandTotalExpense)}
          </p>
          <p className="mt-0.5 text-[11px] text-rose-700/80 dark:text-rose-300/80">
            ২০১৯ থেকে ২০২৪ পর্যন্ত অনুমোদিত বাৎসরিক ও প্রকল্প ব্যয় ({expensesList.length}টি ভাউচার)
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            খরচ বাদে অবশিষ্ট নিট তহবিল (Available Net Balance)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatBDT(netCashAfterExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
            সূত্র: মোট আদায় ({formatBDT(totalSocietyCollection)}) − মোট খরচ ({formatBDT(grandTotalExpense)})
          </p>
        </div>
      </div>

      {/* =====================================================================
       * OFFICIAL HORIZONTAL EXPENSE LEDGER MATRIX: খরচের হিসাব (2019–2026)
       * Matches the exact layout of the user's attached sheet + 1-click edit!
       * =================================================================== */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-300 bg-slate-200/80 px-5 py-3.5 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              খরচের হিসাব (2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              সালভিত্তিক মোট খরচের অফিসিয়াল বিবরণী — যেকোনো সালের ঘরে ক্লিক করে সরাসরি খরচ এন্ট্রি বা সংশোধন করতে পারবেন
            </p>
          </div>
          {canRecord && (
            <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
              সালের সংখ্যার উপর ক্লিক করে সরাসরি এডিট করুন
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <th className="border-r border-slate-300 px-4 py-3 text-left dark:border-slate-700">
                  মোট খরচঃ
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০১৯ (2019)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২০ (2020)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২১ (2021)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২২ (2022)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২৩ (2023)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২৪ (2024)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২৫ (2025)
                </th>
                <th className="border-r border-slate-300 px-3 py-3 dark:border-slate-700">
                  ২০২৬ (2026)
                </th>
                <th className="bg-amber-50/80 px-4 py-3 font-extrabold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  মোট (Total)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: মোট খরচ (Exact Expense Row) */}
              <tr className="border-b border-slate-300 bg-white font-mono text-sm font-bold dark:border-slate-700 dark:bg-slate-900">
                <td className="border-r border-slate-300 px-4 py-3.5 text-left font-sans text-xs font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                  মোট খরচ (Expense)
                </td>
                {yearlyMatrix.map((ym) => (
                  <td
                    key={ym.year}
                    onClick={() => openYearExpenseModal(ym.year, ym.expense)}
                    className={`border-r border-slate-300 px-3 py-3.5 tabular-nums transition-colors dark:border-slate-700 ${
                      canRecord
                        ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        : ''
                    } ${
                      ym.expense > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                    title={canRecord ? `${ym.year} সালের মোট খরচ পরিবর্তন করতে ক্লিক করুন` : ''}
                  >
                    <div>{formatBDT(ym.expense)}</div>
                    {canRecord && (
                      <span className="mt-1 inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Edit3 className="h-2.5 w-2.5" />
                        এডিট
                      </span>
                    )}
                  </td>
                ))}
                <td className="bg-rose-50/80 px-4 py-3.5 text-base font-extrabold tabular-nums text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  {formatBDT(grandTotalExpense)}
                </td>
              </tr>

              {/* Row 2: বাৎসরিক মোট আদায় (Collection Comparison Row) */}
              <tr className="bg-slate-50/70 font-mono text-xs text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
                <td className="border-r border-slate-300 px-4 py-2.5 text-left font-sans font-semibold dark:border-slate-700">
                  বাৎসরিক মোট আদায়
                </td>
                {yearlyMatrix.map((ym) => (
                  <td
                    key={ym.year}
                    className="border-r border-slate-300 px-3 py-2.5 tabular-nums text-teal-700 dark:border-slate-700 dark:text-teal-400"
                  >
                    {formatBDT(ym.collection)}
                  </td>
                ))}
                <td className="px-4 py-2.5 font-bold tabular-nums text-teal-700 dark:text-teal-400">
                  {formatBDT(totalSocietyCollection)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Income / Expense Form */}
      {canRecord && (
        <form
          onSubmit={handleRecordVoucher}
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                নতুন খরচ বা আয় ভাউচার এন্ট্রি (Record New Expense or Income Voucher)
              </h3>
              <p className="text-[11px] text-slate-500">
                যেকোনো বছর (২০১৯–২০২৬) নির্বাচন করে নতুন খরচ বা আয় ভাউচার যোগ করুন
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEntryType('EXPENSE');
                  setCategory(expenseCategories[0]);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  entryType === 'EXPENSE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Expense Voucher (নতুন খরচ এন্ট্রি)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryType('INCOME');
                  setCategory(incomeCategories[0]);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  entryType === 'INCOME'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Income Voucher (নতুন আয় এন্ট্রি)
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                হিসাব বছর (Year)
              </label>
              <select
                value={voucherYear}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  setVoucherYear(yr);
                  setTxDate(`${yr}-${txDate.slice(5, 10) || '12-31'}`);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {yearsList.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} সাল
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Category (খাত)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {(entryType === 'INCOME' ? incomeCategories : expenseCategories).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Voucher Description (খরচ বা আয়ের বিবরণ)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  entryType === 'EXPENSE'
                    ? 'যেমন: অফিস খরচ / প্রকল্প ব্যয় / স্টেশনারি...'
                    : 'যেমন: ভর্তি ফি / প্রকল্প মুনাফা...'
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Amount (পরিমাণ ৳)
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className={`w-full rounded-lg px-4 py-2 font-bold text-white shadow-xs transition-colors ${
                  entryType === 'EXPENSE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting
                  ? 'সংরক্ষণ হচ্ছে...'
                  : entryType === 'EXPENSE'
                  ? 'খরচ এন্ট্রি করুন'
                  : 'আয় এন্ট্রি করুন'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Bar for Vouchers */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          সাল অনুযায়ী ভাউচার ফিল্টার করুন:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterYear(0)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
              filterYear === 0
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            সকল বছর (২০১৯–২০২৬)
          </button>
          {yearsList.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setFilterYear(yr)}
              className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold ${
                filterYear === yr
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Expense & Income Vouchers Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Expense Vouchers Table (Left / Primary) */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">
              সমিতির ব্যয় ভাউচার তালিকা (Approved Expense Vouchers)
            </h3>
            <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
              মোট: {formatBDT(filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Voucher & Year</th>
                  <th className="px-3 py-2.5">Category & Title</th>
                  <th className="px-4 py-2.5 text-right">Amount (৳)</th>
                  {canRecord && <th className="px-3 py-2.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredExpenses.map((exp: any) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">{exp.voucherNo}</div>
                      <div className="text-[11px] text-slate-500">
                        সাল: {exp.year} · {exp.transactionDate}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {exp.category}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">{exp.title}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatBDT(exp.amount)}
                    </td>
                    {canRecord && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            স্থায়ী (Fixed)
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditVoucherModal('expense', exp)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="ভাউচার এডিট করুন"
                          >
                            <Edit3 className="h-3 w-3" />
                            এডিট
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVoucher('expense', exp.id)}
                            className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/50"
                            title="ভাউচার মুছে ফেলুন"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-rose-50/50 font-mono text-xs font-bold dark:border-slate-800 dark:bg-rose-950/30">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-slate-900 dark:text-white">
                    সর্বমোট খরচ (Total Approved Expenses)
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">
                    {formatBDT(filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}
                  </td>
                  {canRecord && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Income Vouchers Table (Right) */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              সমিতির আয় ভাউচার তালিকা (Approved Income Vouchers)
            </h3>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              মোট: {formatBDT(filteredIncomes.reduce((s, i) => s + Number(i.amount || 0), 0))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Voucher & Year</th>
                  <th className="px-3 py-2.5">Category & Title</th>
                  <th className="px-4 py-2.5 text-right">Amount (৳)</th>
                  {canRecord && <th className="px-3 py-2.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredIncomes.map((inc: any) => (
                  <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">{inc.voucherNo}</div>
                      <div className="text-[11px] text-slate-500">
                        সাল: {inc.year} · {inc.transactionDate}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {inc.category}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">{inc.title}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatBDT(inc.amount)}
                    </td>
                    {canRecord && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            স্থায়ী (Fixed)
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditVoucherModal('income', inc)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="ভাউচার এডিট করুন"
                          >
                            <Edit3 className="h-3 w-3" />
                            এডিট
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVoucher('income', inc.id)}
                            className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/50"
                            title="ভাউচার মুছে ফেলুন"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-emerald-50/50 font-mono text-xs font-bold dark:border-slate-800 dark:bg-emerald-950/30">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-slate-900 dark:text-white">
                    সর্বমোট অন্যান্য আয় ভাউচার (Total Income Vouchers)
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                    {formatBDT(filteredIncomes.reduce((s, i) => s + Number(i.amount || 0), 0))}
                  </td>
                  {canRecord && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Modal 1: 1-Click Yearly Expense Total Editor */}
      {editingYearExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingYearExpense.year} সালের মোট খরচ নির্ধারণ / সংশোধন
              </h3>
              <button
                type="button"
                onClick={() => setEditingYearExpense(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveYearExpense} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  {editingYearExpense.year} সালের সর্বমোট খরচ (Total Expense ৳)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={yearTargetExpense}
                  onChange={(e) => setYearTargetExpense(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base font-bold text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  বিবরণ (Particulars)
                </label>
                <input
                  type="text"
                  value={yearExpenseTitle}
                  onChange={(e) => setYearExpenseTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingYearExpense(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingYearExpense}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700"
                >
                  <Save className="h-4 w-4" />
                  {savingYearExpense ? 'সংরক্ষণ হচ্ছে...' : 'খরচ সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Single Income/Expense Voucher */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ভাউচার সংশোধন ({editingVoucher.voucher.voucherNo})
              </h3>
              <button
                type="button"
                onClick={() => setEditingVoucher(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditVoucher} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    হিসাব বছর (Year)
                  </label>
                  <select
                    value={editYear}
                    onChange={(e) => {
                      const yr = Number(e.target.value);
                      setEditYear(yr);
                      setEditDate(`${yr}-${editDate.slice(5, 10) || '12-31'}`);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {yearsList.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    তারিখ (Date)
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  খাত (Category)
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  {(editingVoucher.type === 'income' ? incomeCategories : expenseCategories).map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  ভাউচার বিবরণ (Title / Description)
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  পরিমাণ (Amount ৳)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVoucher(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700"
                >
                  <Save className="h-4 w-4" />
                  {savingEdit ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 4. LOAN & INVESTMENT MANAGEMENT MODULE
 * ========================================================================== */
export const LoanInvestmentSection: React.FC<{
  role: string;
  data: any;
  membersList: any[];
  authHeaders: Record<string, string>;
  onDataMutated: () => void;
}> = ({ role, data, membersList, authHeaders, onDataMutated }) => {
  const [loanMemberId, setLoanMemberId] = useState<string>('02');
  const [principalAmount, setPrincipalAmount] = useState<number>(50000);
  const [interestRate, setInterestRate] = useState<number>(8);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [purpose, setPurpose] = useState<string>('SME Halal Trade Financing');

  const [invName, setInvName] = useState<string>('');
  const [invPrincipal, setInvPrincipal] = useState<number>(300000);
  const [invExpectedReturn, setInvExpectedReturn] = useState<number>(45000);
  const [invPhotoUrl, setInvPhotoUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [quickTargetInvId, setQuickTargetInvId] = useState<number | null>(null);
  const [invStatusMsg, setInvStatusMsg] = useState<string>('');

  const newInvPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const quickInvPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(role);

  const handleNewInvPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 960, 0.85);
      if (dataUrl) setInvPhotoUrl(dataUrl);
    } catch (err: any) {
      setInvStatusMsg(err.message || 'ছবি প্রসেস করতে সমস্যা হয়েছে।');
    }
  };

  const handleQuickInvRowPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !quickTargetInvId) return;
    try {
      setSubmitting(true);
      const dataUrl = await compressImageFile(file, 960, 0.85);
      if (!dataUrl) return;
      const res = await fetch(`/api/investments/${quickTargetInvId}/photo`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: dataUrl }),
      });
      if (res.ok) {
        setInvStatusMsg('বিনিয়োগ প্রকল্পের ছবি সফলভাবে সংরক্ষণ করা হয়েছে!');
        setTimeout(() => setInvStatusMsg(''), 4000);
        onDataMutated();
      }
    } finally {
      setSubmitting(false);
      setQuickTargetInvId(null);
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: loanMemberId,
          principalAmount,
          interestRate,
          tenureMonths,
          purpose,
        }),
      });
      if (res.ok) onDataMutated();
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRepay = async (loan: any) => {
    const monthlyPrincipal = Math.round(loan.principalAmount / loan.tenureMonths);
    const monthlyProfit = Math.round(loan.totalInterestAmount / loan.tenureMonths);
    await fetch(`/api/loans/${loan.id}/repay`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principalComponent: monthlyPrincipal,
        interestComponent: monthlyProfit,
        fineComponent: 0,
      }),
    });
    onDataMutated();
  };

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/investments', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investmentName: invName,
          principalAmount: invPrincipal,
          expectedReturn: invExpectedReturn,
          actualReturn: 0,
          photoUrl: invPhotoUrl,
        }),
      });
      if (res.ok) {
        setInvName('');
        setInvPhotoUrl('');
        setInvStatusMsg('নতুন বিনিয়োগ প্রকল্প ও ছবি সফলভাবে নিবন্ধিত হয়েছে!');
        setTimeout(() => setInvStatusMsg(''), 4000);
        onDataMutated();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={quickInvPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickInvRowPhotoUpload}
        className="hidden"
      />
      {invStatusMsg && (
        <div className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
          {invStatusMsg}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          ঋণ ও বিনিয়োগ ব্যবস্থাপনা (Loan & Investment Portfolio)
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Loan Principal Receivable (Asset 1030), Service Profit (Income 4050), and Investment Principal (Asset 1040) are strictly segregated
        </p>
      </div>

      {/* Active Member Loans Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              সদস্য ঋণ হিসাব ও কিস্তি আদায় (Member Loans — Principal vs Service Profit Separated)
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Loan Code</th>
                <th className="px-3 py-3">Member</th>
                <th className="px-3 py-3 text-right">Principal Disbursed</th>
                <th className="px-3 py-3 text-right">Service Profit</th>
                <th className="px-3 py-3 text-right">Principal Repaid</th>
                <th className="px-3 py-3 text-right">Profit Repaid</th>
                <th className="px-3 py-3 text-right">Outstanding Principal</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Repayment Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(data?.loans || []).map((ln: any) => (
                <tr key={ln.id}>
                  <td className="px-4 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                    {ln.loanCode}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                    {ln.memberId} · {ln.memberName}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatBDT(ln.principalAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatBDT(ln.totalInterestAmount)} ({ln.interestRate}%)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-600">
                    {formatBDT(ln.principalRepaid)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-teal-600">
                    {formatBDT(ln.interestRepaid)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-amber-600">
                    {formatBDT(ln.outstandingPrincipal)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{ln.status}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canManage && ln.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => handleQuickRepay(ln)}
                        className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
                      >
                        Post Installment ({formatBDT(ln.monthlyInstallment)})
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Society Investments Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <Briefcase className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            সমিতির বিনিয়োগ প্রকল্পসমূহ ও ছবি (Cooperative Investments & Project Photos)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">প্রকল্পের ছবি</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Investment Project Name</th>
                <th className="px-4 py-3 text-right">Principal Amount</th>
                <th className="px-4 py-3">Date & Maturity</th>
                <th className="px-4 py-3 text-right">Expected Return</th>
                <th className="px-4 py-3 text-right">Actual Realized Profit</th>
                <th className="px-4 py-3">Status</th>
                {['SUPER_ADMIN', 'ADMIN'].includes(role) && (
                  <th className="px-4 py-3 text-right">ছবি সংযুক্ত করুন</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(data?.investments || []).map((inv: any) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2.5">
                    {inv.photoUrl ? (
                      <img
                        src={inv.photoUrl}
                        alt={inv.investmentName}
                        className="h-12 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                      />
                    ) : (
                      <div className="flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                        ছবি নেই
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                    {inv.investmentCode}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                    {inv.investmentName}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {formatBDT(inv.principalAmount)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">
                    {inv.investmentDate} → {inv.maturityDate}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatBDT(inv.expectedReturn)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600">
                    {formatBDT(inv.actualReturn)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{inv.status}</td>
                  {['SUPER_ADMIN', 'ADMIN'].includes(role) && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTargetInvId(inv.id);
                          setTimeout(() => quickInvPhotoInputRef.current?.click(), 40);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {inv.photoUrl ? 'ছবি পরিবর্তন' : 'ছবি যুক্ত করুন'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forms to Disbuse New Loan or Add Investment */}
      {['SUPER_ADMIN', 'ADMIN'].includes(role) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleCreateLoan}
            className="rounded-xl border border-slate-200 bg-white p-5 text-xs space-y-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              নতুন সদস্য ঋণ অনুমোদন ও বিতরণ (Approve & Disburse Member Loan)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium">Select Member</label>
                <select
                  value={loanMemberId}
                  onChange={(e) => setLoanMemberId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  {membersList.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.memberId} — {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium">Principal Amount (৳)</label>
                <input
                  type="number"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium">Service Rate (%)</label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium">Tenure (Months)</label>
                <input
                  type="number"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
            >
              Approve & Disburse Loan
            </button>
          </form>

          <form
            onSubmit={handleCreateInvestment}
            className="rounded-xl border border-slate-200 bg-white p-5 text-xs space-y-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              নতুন বিনিয়োগ প্রকল্প নিবন্ধন ও ছবি যুক্তকরণ (Register Society Investment with Photo)
            </h3>
            <div>
              <label className="block font-medium">Investment Project Title</label>
              <input
                type="text"
                required
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder="e.g. Mudaraba Term Deposit / Land Share..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium">Principal Amount (৳)</label>
                <input
                  type="number"
                  value={invPrincipal}
                  onChange={(e) => setInvPrincipal(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium">Expected Return (৳)</label>
                <input
                  type="number"
                  value={invExpectedReturn}
                  onChange={(e) => setInvExpectedReturn(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            {/* Project Photo Upload Field */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-teal-300 bg-teal-50/40 p-2.5 dark:border-teal-800 dark:bg-teal-950/30">
              <div className="flex items-center gap-2.5">
                {invPhotoUrl ? (
                  <img
                    src={invPhotoUrl}
                    alt="Preview"
                    className="h-10 w-16 rounded-md object-cover border border-teal-300"
                  />
                ) : (
                  <div className="flex h-10 w-16 items-center justify-center rounded-md bg-white text-[10px] text-slate-400 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    ছবি প্রিভিউ
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    প্রকল্পের ছবি যুক্ত করুন (ঐচ্ছিক)
                  </p>
                  <p className="text-[10px] text-slate-500">
                    সকল ডিভাইসে স্থায়ীভাবে প্রদর্শিত হবে
                  </p>
                </div>
              </div>
              <input
                ref={newInvPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleNewInvPhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => newInvPhotoInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Camera className="h-3.5 w-3.5" />
                ছবি নির্বাচন
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
            >
              Record Investment Allocation
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. AUDIT LOGS, 4-ROLE RLS MATRIX & SYSTEM SETTINGS MODULE
 * ========================================================================== */
export const AuditSecuritySection: React.FC<{
  authHeaders: Record<string, string>;
}> = ({ authHeaders }) => {
  const [securityData, setSecurityData] = useState<any>(null);
  const [superAdminPin, setSuperAdminPin] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>('');
  const [defaultMemberPin, setDefaultMemberPin] = useState<string>('');
  const [savingPins, setSavingPins] = useState<boolean>(false);
  const [pinSavedMsg, setPinSavedMsg] = useState<string>('');

  const fetchSecurity = useCallback(async () => {
    const res = await fetch('/api/audit-security', { headers: authHeaders });
    if (res.ok) {
      setSecurityData(await res.json());
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchSecurity();
  }, [fetchSecurity]);

  const handleUpdatePins = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPins(true);
    setPinSavedMsg('');
    try {
      const res = await fetch('/api/security/update-pins', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          superAdminPin: superAdminPin.trim() || undefined,
          adminPin: adminPin.trim() || undefined,
          defaultMemberPin: defaultMemberPin.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPinSavedMsg('নিরাপত্তা পিনসমূহ সফলভাবে এনক্রিপ্টেড ডাটাবেজে সংরক্ষিত হয়েছে!');
        setSuperAdminPin('');
        setAdminPin('');
        setDefaultMemberPin('');
        fetchSecurity();
      } else {
        setPinSavedMsg(data.error || 'পিন পরিবর্তনে ত্রুটি হয়েছে।');
      }
    } finally {
      setSavingPins(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                অডিট লগ, ৪-স্তরের রোল পারমিশন ও অ্যান্টি-হ্যাক সাইবার নিরাপত্তা (Audit Trail & Anti-Hack Vault)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              HMAC-SHA256 Session Signing · Brute-Force Lockout · XSS/SQLi Sanitization · SHA-256 Ledger Integrity Hash
            </p>
          </div>
          {securityData?.ledgerIntegrityHash && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/80 px-3.5 py-2 dark:bg-emerald-950/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                SHA-256 Ledger Integrity Signature
              </p>
              <p className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-200">
                {String(securityData.ledgerIntegrityHash).slice(0, 28)}...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Super Admin Anti-Hack Security PIN & Access Control Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 p-5 text-white shadow-md">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-teal-400" />
            <h3 className="text-sm font-bold">
              অ্যান্টি-হ্যাক সিকিউরিটি শিল্ড স্ট্যাটাস (Active Anti-Hack Defense Layers)
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-slate-400">Session Protection</p>
              <p className="mt-1 font-mono font-bold text-emerald-400">
                {securityData?.securityMetrics?.hmacSessionSigning || 'HMAC-SHA256 Active'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-slate-400">Brute-Force Firewall</p>
              <p className="mt-1 font-mono font-bold text-emerald-400">
                {securityData?.securityMetrics?.bruteForceProtection || '5 Attempts Lockout'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-slate-400">Payload Sanitizer</p>
              <p className="mt-1 font-mono font-bold text-teal-300">
                {securityData?.securityMetrics?.xssPayloadSanitizer || 'Recursive Anti-XSS'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-slate-400">Database ORM</p>
              <p className="mt-1 font-mono font-bold text-teal-300">
                Parameterized SQL Shield
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleUpdatePins}
          className="rounded-xl border border-slate-200 bg-white p-5 text-xs space-y-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              মাস্টার সিকিউরিটি পিন পরিবর্তন (Super Admin Security PIN Control)
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            সুপার এডমিন এখান থেকে সুপার এডমিন পিন, এডমিন পিন এবং ডিফল্ট সদস্য পিন পরিবর্তন করতে পারবেন।
          </p>

          {pinSavedMsg && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              {pinSavedMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                নতুন সুপার এডমিন পিন
              </label>
              <input
                type="password"
                value={superAdminPin}
                onChange={(e) => setSuperAdminPin(e.target.value)}
                placeholder="Default: 7709"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                নতুন এডমিন পিন
              </label>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Default: 2026"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                ডিফল্ট সদস্য পিন
              </label>
              <input
                type="password"
                value={defaultMemberPin}
                onChange={(e) => setDefaultMemberPin(e.target.value)}
                placeholder="Default: 1234"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingPins}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {savingPins ? 'সংরক্ষণ হচ্ছে...' : 'নিরাপত্তা পিন আপডেট করুন'}
            </button>
          </div>
        </form>
      </div>

      {/* 4 User Roles Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {(securityData?.roles || []).map((r: any) => (
          <div
            key={r.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">{r.name}</p>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{r.description}</p>
          </div>
        ))}
      </div>

      {/* Immutable Audit Trail Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            অপরিবর্তনীয় অডিট লগ (Immutable Financial Audit Logs)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-3 py-3">Actor & Role</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Entity Ref</th>
                <th className="px-3 py-3">Previous Value</th>
                <th className="px-3 py-3">Updated Value</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(securityData?.auditLogs || []).map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString('en-BD') : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                    {log.actorName} ({log.actorRole})
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-teal-700 dark:text-teal-400">
                    {log.action}
                  </td>
                  <td className="px-3 py-2.5 font-mono">{log.entityId}</td>
                  <td className="max-w-xs truncate px-3 py-2.5 font-mono text-slate-500">
                    {log.previousValue || '—'}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {log.updatedValue}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
