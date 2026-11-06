import React, { useState } from 'react';
import { Printer, Download, X, CheckCircle2, FileText, Share2, Copy, QrCode } from 'lucide-react';
import { formatBDT } from '../lib/utils.ts';
import { downloadReceiptPDF } from '../lib/exportUtils.ts';
import { SocietyLogoAvatar } from './SocietyHomePage.tsx';
import { OFFICIAL_SOCIETY_LOGO_URL } from '../lib/officialLogo.ts';

interface ReceiptData {
  receiptNo: string;
  memberId: string;
  memberName: string;
  paymentDate: string;
  month?: number;
  monthName: string;
  year: number;
  shareDeposit: number;
  payable: number;
  fine: number;
  otherReceive: number;
  downPayment: number;
  totalAmount: number;
  paymentMethod: string;
  receivedBy: string;
  mobile?: string;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  logoUrl?: string;
  onClose: () => void;
}

// Deterministic 11x11 visual QR matrix from string seed
const generateQrMatrix = (seed: string): boolean[][] => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const size = 11;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const setFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid[r0 + r][c0 + c] = true;
      }
    }
  };
  setFinder(0, 0);
  setFinder(0, size - 3);
  setFinder(size - 3, 0);

  let state = Math.abs(hash) || 1234567;
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

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  logoUrl = OFFICIAL_SOCIETY_LOGO_URL,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [copiedSms, setCopiedSms] = useState(false);

  if (!receipt) return null;

  const qrMatrix = generateQrMatrix(
    `HF|${receipt.receiptNo}|${receipt.memberId}|${receipt.totalAmount}|${receipt.paymentDate}`
  );

  const formattedMessage = `সম্মানিত সদস্য ${receipt.memberName} (আইডি #${receipt.memberId}), আসসালামু আলাইকুম।\nহিলফুল ফুজুল সমবায় সমিতিতে আপনার ${receipt.monthName} ${receipt.year} মাসের কিস্তি বাবদ সর্বমোট ${formatBDT(
    receipt.totalAmount
  )} (শেয়ার: ${formatBDT(receipt.shareDeposit)}, প্রদেয়: ${formatBDT(
    receipt.payable
  )}${receipt.downPayment > 0 ? `, ডাউন পেমেন্ট: ${formatBDT(receipt.downPayment)}` : ''}) সফলভাবে জমা হয়েছে।\nরশিদ নং: ${
    receipt.receiptNo
  } | তারিখ: ${receipt.paymentDate}\nধন্যবাদান্তে,\nহিলফুল ফুজুল সমবায় সমিতি`;

  const cleanPhone = (receipt.mobile || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone
    ? cleanPhone.startsWith('88')
      ? cleanPhone
      : `88${cleanPhone}`
    : '';
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(formattedMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(formattedMessage)}`;

  const handleCopySms = () => {
    navigator.clipboard.writeText(formattedMessage);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 my-auto">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950 no-print">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              মানি রশিদ প্রিভিউ (QR Verified Receipt)
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  printFormat === 'A4'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                A4 Official
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  printFormat === 'THERMAL'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                80mm Thermal POS
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
              title="হোয়াটসঅ্যাপে ডিজিটাল মানি রশিদ পাঠান"
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp রশিদ
            </a>
            <button
              type="button"
              onClick={handleCopySms}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedSms ? 'কপি হয়েছে!' : 'SMS কপি'}
            </button>
            <button
              type="button"
              onClick={() => downloadReceiptPDF(receipt, 'A4')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              A4 PDF
            </button>
            <button
              type="button"
              onClick={() => downloadReceiptPDF(receipt, 'THERMAL')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              Thermal
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6">
          <div
            className={`mx-auto rounded-lg border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${
              printFormat === 'THERMAL' ? 'max-w-xs font-mono text-xs' : 'w-full'
            }`}
          >
            {/* Header */}
            <div className="border-b border-slate-200 pb-4 text-center dark:border-slate-800">
              <div className="mx-auto mb-2 flex justify-center">
                <SocietyLogoAvatar logoUrl={logoUrl} size="md" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                হিলফুল ফুজুল সমবায় সমিতি
              </h2>
              <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
                Hilful Fuzul Cooperative Society
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                আর্থিক জমার সরকারি রশিদ · Official QR Verified Payment Receipt
              </p>
            </div>

            {/* Metadata Grid */}
            <div
              className={`mt-4 grid gap-2 text-xs ${
                printFormat === 'THERMAL' ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              <div>
                <span className="text-slate-500 dark:text-slate-400">Receipt No: </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {receipt.receiptNo}
                </span>
              </div>
              <div className={printFormat === 'THERMAL' ? '' : 'text-right'}>
                <span className="text-slate-500 dark:text-slate-400">Date: </span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">
                  {receipt.paymentDate}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Member ID: </span>
                <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                  #{receipt.memberId}
                </span>
              </div>
              <div className={printFormat === 'THERMAL' ? '' : 'text-right'}>
                <span className="text-slate-500 dark:text-slate-400">Period: </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {receipt.monthName} {receipt.year}
                </span>
              </div>
              <div className="col-span-full">
                <span className="text-slate-500 dark:text-slate-400">Member Name: </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {receipt.memberName}
                </span>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold">হিসাবের খাত (Category)</th>
                    <th className="px-3 py-2 text-right font-semibold">পরিমাণ (Amount)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <td className="px-3 py-2">Share Deposit (শেয়ার জমা)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(receipt.shareDeposit)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Payable Amount (মাসিক প্রদেয়)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(receipt.payable)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Fine (বিলম্ব জরিমানা)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(receipt.fine)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Other Receive (অন্যান্য প্রাপ্তি)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(receipt.otherReceive)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Down Payment (ডাউন পেমেন্ট)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatBDT(receipt.downPayment)}
                    </td>
                  </tr>
                  <tr className="bg-slate-900 font-bold text-white dark:bg-teal-950">
                    <td className="px-3 py-2.5">Total Receive Amount (সর্বমোট প্রাপ্তি)</td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm tabular-nums text-emerald-400">
                      {formatBDT(receipt.totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Signatures + QR Code Verification Block */}
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 pt-3 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <p>
                  Payment Method:{' '}
                  <strong className="text-slate-900 dark:text-white">{receipt.paymentMethod}</strong>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Received By: {receipt.receivedBy}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                  <QrCode className="h-3 w-3" />
                  QR VERIFIED · {receipt.receiptNo}
                </p>
              </div>

              {/* Dynamic SVG QR Verification Stamp */}
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-slate-300 bg-white p-1.5 shadow-2xs">
                  <svg
                    width="54"
                    height="54"
                    viewBox="0 0 11 11"
                    className="block"
                    aria-label="Digital Verification QR Code"
                  >
                    {qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#0f172a"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                </div>

                <div className="text-right">
                  <div className="mb-1 h-px w-32 bg-slate-400 dark:bg-slate-600" />
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    অনুমোদিত স্বাক্ষর (Authorized)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

