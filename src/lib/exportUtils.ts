import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatBDT, MONTHS_LIST } from './utils.ts';

/**
 * Exports any tabular report to PDF, Excel (.xlsx), or CSV
 */
export function exportReportData(params: {
  title: string;
  subtitle?: string;
  fileName: string;
  headers: string[];
  rows: (string | number)[][];
  format: 'PDF' | 'EXCEL' | 'CSV';
}) {
  const { title, subtitle, fileName, headers, rows, format } = params;

  if (format === 'EXCEL' || format === 'CSV') {
    const worksheetData = [
      ['Hilful Fuzul Cooperative Society (হিলফুল ফুজুল সমবায় সমিতি)'],
      [title],
      [subtitle || `Generated: ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })} (Asia/Dhaka)`],
      [],
      headers,
      ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    if (format === 'EXCEL') {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${fileName}.csv`, { bookType: 'csv' });
    }
    return;
  }

  // PDF Export
  const doc = new jsPDF({ orientation: headers.length > 7 ? 'landscape' : 'portrait' });
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('Hilful Fuzul Cooperative Society', 14, 16);
  doc.setFontSize(11);
  doc.setTextColor(13, 148, 136);
  doc.text(title, 14, 23);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    subtitle ||
      `Generated on ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })} | Currency: BDT (Tk)`,
    14,
    29
  );

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: rows.map((r) => r.map((cell) => String(cell))),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${fileName}.pdf`);
}

/**
 * Generates an official PDF Receipt for a Member Payment (A4 or Thermal 80mm format)
 */
export function downloadReceiptPDF(receipt: {
  receiptNo: string;
  memberId: string;
  memberName: string;
  paymentDate: string;
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
}, mode: 'A4' | 'THERMAL' = 'A4') {
  if (mode === 'THERMAL') {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 165],
    });
    doc.setFontSize(10);
    doc.text('HILFUL FUZUL SOCIETY', 40, 10, { align: 'center' });
    doc.setFontSize(7.5);
    doc.text('Official Payment Receipt', 40, 15, { align: 'center' });
    doc.line(5, 18, 75, 18);

    doc.text(`Receipt No: ${receipt.receiptNo}`, 6, 24);
    doc.text(`Date: ${receipt.paymentDate}`, 6, 29);
    doc.text(`Member ID: ${receipt.memberId}`, 6, 34);
    doc.text(`Name: ${receipt.memberName}`, 6, 39);
    doc.text(`Period: ${receipt.monthName} ${receipt.year}`, 6, 44);
    doc.line(5, 47, 75, 47);

    let y = 53;
    const items = [
      ['Share Deposit', receipt.shareDeposit],
      ['Monthly Payable', receipt.payable],
      ['Late Fine', receipt.fine],
      ['Other Receive', receipt.otherReceive],
      ['Down Payment', receipt.downPayment],
    ];
    for (const [label, amt] of items) {
      doc.text(String(label), 6, y);
      doc.text(`Tk ${Number(amt).toLocaleString()}`, 74, y, { align: 'right' });
      y += 6;
    }
    doc.line(5, y, 75, y);
    y += 6;
    doc.setFontSize(9);
    doc.text('TOTAL RECEIVED:', 6, y);
    doc.text(`Tk ${receipt.totalAmount.toLocaleString()}`, 74, y, { align: 'right' });
    y += 8;
    doc.setFontSize(7.5);
    doc.text(`Method: ${receipt.paymentMethod}`, 6, y);
    y += 5;
    doc.text(`Received By: ${receipt.receivedBy}`, 6, y);
    y += 14;
    doc.text('Authorized Signature', 40, y, { align: 'center' });
    doc.save(`${receipt.receiptNo}_Thermal.pdf`);
    return;
  }

  // Standard A4 Official Receipt
  const doc = new jsPDF();
  doc.setFillColor(15, 23, 42);
  doc.rect(14, 14, 182, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('HILFUL FUZUL COOPERATIVE SOCIETY', 20, 25);
  doc.setFontSize(9.5);
  doc.text('Official Financial Money Receipt | Reg: Dhaka-Coop-2019', 20, 32);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Receipt Number: ${receipt.receiptNo}`, 14, 48);
  doc.text(`Payment Date: ${receipt.paymentDate}`, 140, 48);
  doc.text(`Member ID: ${receipt.memberId}`, 14, 55);
  doc.text(`Billing Period: ${receipt.monthName} ${receipt.year}`, 140, 55);
  doc.text(`Member Name: ${receipt.memberName}`, 14, 62);
  doc.text(`Payment Method: ${receipt.paymentMethod}`, 140, 62);

  autoTable(doc, {
    startY: 68,
    head: [['SL', 'Accounting Category', 'Description', 'Amount (BDT)']],
    body: [
      ['01', 'Share Deposit', `Monthly share capital deposit (${receipt.monthName} ${receipt.year})`, `Tk ${receipt.shareDeposit.toLocaleString()}`],
      ['02', 'Payable Amount', `Monthly society payable contribution`, `Tk ${receipt.payable.toLocaleString()}`],
      ['03', 'Fine', `Late payment fine adjustment`, `Tk ${receipt.fine.toLocaleString()}`],
      ['04', 'Other Receive', `Miscellaneous / passbook / renewal receipt`, `Tk ${receipt.otherReceive.toLocaleString()}`],
      ['05', 'Down Payment', `Project down payment installment`, `Tk ${receipt.downPayment.toLocaleString()}`],
      ['', 'TOTAL RECEIVED AMOUNT', 'Verified & Posted to Double-Entry Ledger', `Tk ${receipt.totalAmount.toLocaleString()}`],
    ],
    headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255] },
    styles: { fontSize: 9.5, cellPadding: 3.5 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 22;
  doc.setFontSize(9.5);
  doc.text(`Received By: ${receipt.receivedBy}`, 14, finalY);
  doc.text('___________________________', 140, finalY);
  doc.text('Authorized Cashier / Secretary', 140, finalY + 6);

  doc.save(`${receipt.receiptNo}.pdf`);
}

/**
 * Generates or parses a multi-sheet Excel file structured like "Shomiti Hishab English (1).xlsx"
 */
export function downloadReferenceExcelWorkbook(membersList: Array<{ memberId: string; name: string }>) {
  const wb = XLSX.utils.book_new();
  const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

  for (const yr of years) {
    const sheetRows: (string | number)[][] = [
      [`Hilful Fuzul Cooperative Society - Annual Member Accounting (${yr})`],
      ['Member ID', 'Member Name', 'Month', 'Date', 'Share Deposit', 'Payable', 'Fine', 'Other Receive', 'Down Payment', 'Total Receive Amount', 'Due'],
    ];

    const yrNum = Number(yr);
    const shareRate = yrNum === 2019 ? 1000 : yrNum === 2020 ? 1500 : 2000;
    const otherRate = yrNum <= 2020 ? 20 : 50;
    const expectedRate = shareRate + otherRate;

    for (const m of membersList) {
      for (const mo of MONTHS_LIST) {
        const isPaid = !(yr === '2026' && mo.num > 1);
        const share = isPaid ? shareRate : 0;
        const payable = 0;
        const fine = 0;
        const other = isPaid ? otherRate : 0;
        const down =
          isPaid && mo.num === 1 && yrNum === 2022
            ? 70000
            : isPaid && mo.num === 1 && yrNum === 2024
            ? 12000
            : 0;
        const total = share + payable + fine + other + down;
        const due = isPaid ? 0 : expectedRate;
        const dateStr = isPaid ? `${yr}-${String(mo.num).padStart(2, '0')}-05` : '';

        sheetRows.push([
          m.memberId,
          m.name,
          mo.en,
          dateStr,
          share,
          payable,
          fine,
          other,
          down,
          total,
          due,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, yr);
  }

  XLSX.writeFile(wb, 'Shomiti Hishab English (1).xlsx');
}

/**
 * Parses an uploaded Excel (.xlsx) workbook with annual sheets (2019..2026) and extracts
 * member blocks and monthly financial rows for Step 1–10 validation.
 */
export async function parseSocietyExcelFile(file: File): Promise<{
  fileName: string;
  totalWorksheets: number;
  parsedRows: Array<{
    worksheetName: string;
    rowNumber: number;
    year: number;
    memberId: string;
    memberName: string;
    month: number;
    monthName: string;
    rawDate: string;
    shareDeposit: number;
    payable: number;
    fine: number;
    otherReceive: number;
    downPayment: number;
    totalReceiveAmount: number;
    due: number;
  }>;
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const parsedRows: Array<any> = [];

  const monthMap = new Map<string, number>();
  MONTHS_LIST.forEach((m) => {
    monthMap.set(m.en.toLowerCase(), m.num);
    monthMap.set(m.en.slice(0, 3).toLowerCase(), m.num);
  });

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const yearMatch = sheetName.match(/20\d{2}/);
    const sheetYear = yearMatch ? Number(yearMatch[0]) : 2026;

    let currentMemberId = 'HF-001';
    let currentMemberName = 'Md. Abdullah Al Mamun';

    for (let rIdx = 0; rIdx < aoa.length; rIdx++) {
      const row = aoa[rIdx];
      if (!row || row.length === 0) continue;

      const joinedText = row.map((c) => String(c).trim()).join(' ');
      // Detect Member header blocks if arranged vertically in Excel
      const memberIdMatch = joinedText.match(/(HF-\d{3}|M-\d{2,4}|ID\s*[:=-]?\s*\d+)/i);
      if (memberIdMatch && !monthMap.has(String(row[0]).toLowerCase().trim())) {
        currentMemberId = memberIdMatch[1].toUpperCase().replace(/\s+/g, '');
      }

      // Check if row is a tabular row starting with Member ID or Month name
      const col0 = String(row[0] || '').trim();
      const col2 = String(row[2] || '').trim();

      if (monthMap.has(col2.toLowerCase())) {
        // Format: [Member ID, Member Name, Month, Date, Share Deposit, Payable, Fine, Other Receive, Down Payment, Total, Due]
        const mNum = monthMap.get(col2.toLowerCase())!;
        parsedRows.push({
          worksheetName: sheetName,
          rowNumber: rIdx + 1,
          year: sheetYear,
          memberId: col0 || currentMemberId,
          memberName: String(row[1] || currentMemberName).trim(),
          month: mNum,
          monthName: MONTHS_LIST[mNum - 1].en,
          rawDate: row[3] instanceof Date ? row[3].toISOString().slice(0, 10) : String(row[3] || '').trim(),
          shareDeposit: Number(row[4]) || 0,
          payable: Number(row[5]) || 0,
          fine: Number(row[6]) || 0,
          otherReceive: Number(row[7]) || 0,
          downPayment: Number(row[8]) || 0,
          totalReceiveAmount: Number(row[9]) || 0,
          due: Number(row[10]) || 0,
        });
      } else if (monthMap.has(col0.toLowerCase())) {
        // Format: [Month, Date, Share Deposit, Payable, Fine, Other Receive, Down Payment, Total Receive Amount, Due]
        const mNum = monthMap.get(col0.toLowerCase())!;
        parsedRows.push({
          worksheetName: sheetName,
          rowNumber: rIdx + 1,
          year: sheetYear,
          memberId: currentMemberId,
          memberName: currentMemberName,
          month: mNum,
          monthName: MONTHS_LIST[mNum - 1].en,
          rawDate: row[1] instanceof Date ? row[1].toISOString().slice(0, 10) : String(row[1] || '').trim(),
          shareDeposit: Number(row[2]) || 0,
          payable: Number(row[3]) || 0,
          fine: Number(row[4]) || 0,
          otherReceive: Number(row[5]) || 0,
          downPayment: Number(row[6]) || 0,
          totalReceiveAmount: Number(row[7]) || 0,
          due: Number(row[8]) || 0,
        });
      }
    }
  }

  return {
    fileName: file.name,
    totalWorksheets: wb.SheetNames.length,
    parsedRows,
  };
}
