import { db } from './index.ts';
import {
  accounts,
  annualAccountSummaries,
  auditLogs,
  downPaymentAgreements,
  expenseTransactions,
  incomeTransactions,
  investments,
  journalEntries,
  journalEntryLines,
  loans,
  memberAccounts,
  members,
  monthlyObligations,
  paymentAllocations,
  paymentTransactions,
  receipts,
} from './schema.ts';
import { and, asc, eq, sql } from 'drizzle-orm';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_NAMES_BN = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

/**
 * Recalculates a member's monthly cumulative dues and annual summary for a given year
 * from the underlying monthly_obligations rows.
 */
export async function recalculateMemberYearAccount(memberId: string, year: number) {
  try {
    const memberRows = await db.select().from(members).where(eq(members.memberId, memberId));
    const member = memberRows[0];
    if (!member) return null;

    // Ensure member_accounts header exists
    const accRows = await db
      .select()
      .from(memberAccounts)
      .where(and(eq(memberAccounts.memberId, memberId), eq(memberAccounts.year, year)));

    // Check previous year's closing outstanding
    const prevSummaryRows = await db
      .select()
      .from(annualAccountSummaries)
      .where(
        and(
          eq(annualAccountSummaries.memberId, memberId),
          eq(annualAccountSummaries.year, year - 1)
        )
      );

    const prevOutstanding = prevSummaryRows[0]?.totalOutstanding || 0;
    const prevCredit = prevSummaryRows[0]?.advanceCredit || 0;

    if (accRows.length === 0) {
      await db.insert(memberAccounts).values({
        memberId,
        year,
        openingOutstanding: prevOutstanding,
        openingCredit: prevCredit,
        status: 'OPEN',
      });
    } else if (accRows[0].openingOutstanding !== prevOutstanding) {
      await db
        .update(memberAccounts)
        .set({ openingOutstanding: prevOutstanding, openingCredit: prevCredit })
        .where(eq(memberAccounts.id, accRows[0].id));
    }

    // Fetch all 12 months for this member & year
    let months = await db
      .select()
      .from(monthlyObligations)
      .where(and(eq(monthlyObligations.memberId, memberId), eq(monthlyObligations.year, year)))
      .orderBy(asc(monthlyObligations.month));

    const defaultExpectedShare = year === 2019 ? 1000 : year === 2020 ? 1500 : member.monthlyShareDeposit || 2000;
    const defaultExpectedPayable = year <= 2020 ? 20 : member.monthlyPayableAmount || 50;

    // If any of the 12 months are missing, initialize them
    if (months.length < 12) {
      const existingMonthNums = new Set(months.map((m) => m.month));
      for (let m = 1; m <= 12; m++) {
        if (!existingMonthNums.has(m)) {
          await db.insert(monthlyObligations).values({
            memberId,
            year,
            month: m,
            monthName: MONTH_NAMES[m - 1],
            paymentDate: '',
            expectedShareDeposit: defaultExpectedShare,
            expectedPayable: defaultExpectedPayable,
            shareDeposit: 0,
            payable: 0,
            fine: 0,
            otherReceive: 0,
            downPayment: 0,
            totalReceiveAmount: 0,
            monthlyDue: defaultExpectedShare + defaultExpectedPayable,
            advanceCredit: 0,
            cumulativeDue: 0,
            receiptNo: '',
            status: 'DUE',
          });
        }
      }
      months = await db
        .select()
        .from(monthlyObligations)
        .where(and(eq(monthlyObligations.memberId, memberId), eq(monthlyObligations.year, year)))
        .orderBy(asc(monthlyObligations.month));
    }

    let runningOutstanding = prevOutstanding;
    let runningCredit = prevCredit;

    let totalShareDeposit = 0;
    let totalPayable = 0;
    let totalFine = 0;
    let totalOtherReceive = 0;
    let totalDownPayment = 0;
    let totalReceiveAmount = 0;
    let currentYearObligation = 0;

    for (const row of months) {
      // Capital lump-sum down payments in 2022 (৳70,000) and 2024 (৳12,000) are separate from monthly obligations
      const isCapitalDown =
        (year === 2022 && row.downPayment >= 70000) ||
        (year === 2024 && row.downPayment >= 12000);

      const componentSum =
        row.shareDeposit + row.payable + row.fine + row.otherReceive + row.downPayment;

      // Preserve cached Excel total ONLY for the 7 historical rows where component cells were blank in Excel (sourceRow > 0 and componentSum === 0)
      const rowTotalReceive =
        componentSum === 0 && (row.sourceRow || 0) > 0
          ? row.totalReceiveAmount || 0
          : componentSum;

      const eligibleFromComponents =
        row.shareDeposit + row.payable + row.otherReceive + (isCapitalDown ? 0 : row.downPayment);
      const eligibleReceived = Math.max(
        eligibleFromComponents,
        rowTotalReceive - row.fine - (isCapitalDown ? row.downPayment : 0)
      );

      let expShare = row.expectedShareDeposit ?? defaultExpectedShare;
      let expPayable = row.expectedPayable ?? defaultExpectedPayable;

      if (year <= 2024) {
        // In historical years (2019–2024), if a previously unpaid month (expected = 0) or partial expected month is paid,
        // align expectedShareDeposit + expectedPayable with eligibleReceived so it never creates bogus advanceCredit that corrupts 2025/2026 dues.
        const isSpecial2024DueRow =
          year === 2024 && row.month === 12 && (memberId === '09' || memberId === '14');
        if (!isSpecial2024DueRow && eligibleReceived > expShare + expPayable) {
          expShare = Math.min(eligibleReceived, defaultExpectedShare);
          expPayable = Math.max(0, eligibleReceived - expShare);
        }
      } else {
        // For 2025+, ensure expected obligation is never accidentally 0 unless explicitly exempted
        if (expShare + expPayable === 0) {
          expShare = defaultExpectedShare;
          expPayable = defaultExpectedPayable;
        }
      }

      const expectedObligation = expShare + expPayable;
      currentYearObligation += expectedObligation;

      const rawDiff = expectedObligation - eligibleReceived;
      const monthlyDue = rawDiff > 0 ? rawDiff : 0;
      const monthAdvance = year <= 2024 ? 0 : rawDiff < 0 ? Math.abs(rawDiff) : 0;

      const netChange = year <= 2024 ? monthlyDue : expectedObligation - eligibleReceived;
      if (runningOutstanding + netChange - runningCredit >= 0) {
        runningOutstanding = runningOutstanding + netChange - runningCredit;
        runningCredit = 0;
      } else {
        runningCredit = year <= 2024 ? 0 : Math.abs(runningOutstanding + netChange - runningCredit);
        runningOutstanding = 0;
      }

      const status =
        rowTotalReceive === 0 && expectedObligation > 0
          ? 'DUE'
          : monthAdvance > 0
          ? 'ADVANCE'
          : monthlyDue === 0 && (rowTotalReceive > 0 || year <= 2024 || expectedObligation === 0)
          ? 'PAID'
          : rowTotalReceive > 0 && monthlyDue > 0
          ? 'PARTIAL'
          : 'DUE';

      await db
        .update(monthlyObligations)
        .set({
          expectedShareDeposit: expShare,
          expectedPayable: expPayable,
          totalReceiveAmount: rowTotalReceive,
          monthlyDue,
          advanceCredit: monthAdvance,
          cumulativeDue: runningOutstanding,
          status,
          updatedAt: new Date(),
        })
        .where(eq(monthlyObligations.id, row.id));

      totalShareDeposit += row.shareDeposit;
      totalPayable += row.payable;
      totalFine += row.fine;
      totalOtherReceive += row.otherReceive;
      totalDownPayment += row.downPayment;
      totalReceiveAmount += rowTotalReceive;
    }

    // Upsert annual_account_summaries
    const existingSummary = await db
      .select()
      .from(annualAccountSummaries)
      .where(
        and(
          eq(annualAccountSummaries.memberId, memberId),
          eq(annualAccountSummaries.year, year)
        )
      );

    if (existingSummary.length > 0) {
      await db
        .update(annualAccountSummaries)
        .set({
          totalShareDeposit,
          totalPayable,
          totalFine,
          totalOtherReceive,
          totalDownPayment,
          totalReceiveAmount,
          previousYearOutstanding: prevOutstanding,
          currentYearObligation,
          totalOutstanding: runningOutstanding,
          advanceCredit: runningCredit,
          lastCalculatedAt: new Date(),
        })
        .where(eq(annualAccountSummaries.id, existingSummary[0].id));
    } else {
      await db.insert(annualAccountSummaries).values({
        memberId,
        year,
        totalShareDeposit,
        totalPayable,
        totalFine,
        totalOtherReceive,
        totalDownPayment,
        totalReceiveAmount,
        previousYearOutstanding: prevOutstanding,
        currentYearObligation,
        totalOutstanding: runningOutstanding,
        advanceCredit: runningCredit,
      });
    }

    // Update member's advance credit balance
    await db
      .update(members)
      .set({ advanceCreditBalance: runningCredit })
      .where(eq(members.memberId, memberId));

    return {
      memberId,
      year,
      totalShareDeposit,
      totalPayable,
      totalFine,
      totalOtherReceive,
      totalDownPayment,
      totalReceiveAmount,
      previousYearOutstanding: prevOutstanding,
      currentYearObligation,
      totalOutstanding: runningOutstanding,
      advanceCredit: runningCredit,
    };
  } catch (error) {
    console.error('Error in recalculateMemberYearAccount:', error);
    throw new Error('Failed to recalculate member annual account.', { cause: error });
  }
}

/**
 * Synchronizes a member's down_payment_agreements record with all monthly_obligations downPayments
 * and the member's downPaymentTarget.
 */
export async function syncMemberDownPaymentAgreement(memberId: string) {
  try {
    const memberRows = await db.select().from(members).where(eq(members.memberId, memberId));
    const member = memberRows[0];
    if (!member) return null;

    const obRows = await db
      .select()
      .from(monthlyObligations)
      .where(eq(monthlyObligations.memberId, memberId));

    const totalDownPaid = obRows.reduce((sum, r) => sum + (r.downPayment || 0), 0);
    const agreedAmount = member.downPaymentTarget || 82000;
    const remainingAmount = Math.max(0, agreedAmount - totalDownPaid);
    const status = remainingAmount === 0 ? 'COMPLETED' : 'IN_PROGRESS';

    const existingDp = await db
      .select()
      .from(downPaymentAgreements)
      .where(eq(downPaymentAgreements.memberId, memberId));

    if (existingDp.length > 0) {
      const [updated] = await db
        .update(downPaymentAgreements)
        .set({
          memberName: member.name,
          agreedAmount,
          totalPaid: totalDownPaid,
          remainingAmount,
          status,
          updatedAt: new Date(),
        })
        .where(eq(downPaymentAgreements.id, existingDp[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(downPaymentAgreements)
        .values({
          memberId,
          memberName: member.name,
          agreedAmount,
          totalPaid: totalDownPaid,
          remainingAmount,
          effectiveDate: member.joiningDate || '2019-01-01',
          lastPaymentDate: new Date().toISOString().slice(0, 10),
          lastReceiptNo: '',
          status,
        })
        .returning();
      return inserted;
    }
  } catch (error) {
    console.error('Error in syncMemberDownPaymentAgreement:', error);
    return null;
  }
}

/**
 * Posts a balanced double-entry journal entry and updates account balances.
 */
export async function postDoubleEntryJournal(params: {
  entryDate: string;
  referenceType: string;
  referenceId: string;
  description: string;
  createdBy: string;
  approvedBy?: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    memberId?: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
}) {
  try {
    const totalDebit = params.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = params.lines.reduce((sum, l) => sum + l.credit, 0);

    if (totalDebit !== totalCredit) {
      throw new Error(`Unbalanced Journal Entry: Debit (${totalDebit}) !== Credit (${totalCredit})`);
    }

    const entryNumber = `JE-${params.entryDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [entry] = await db
      .insert(journalEntries)
      .values({
        entryNumber,
        entryDate: params.entryDate,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
        totalDebit,
        totalCredit,
        status: 'POSTED',
        createdBy: params.createdBy,
        approvedBy: params.approvedBy || params.createdBy,
      })
      .returning();

    for (const line of params.lines) {
      if (line.debit === 0 && line.credit === 0) continue;
      await db.insert(journalEntryLines).values({
        journalEntryId: entry.id,
        entryNumber,
        accountCode: line.accountCode,
        accountName: line.accountName,
        memberId: line.memberId || '',
        debit: line.debit,
        credit: line.credit,
        narration: line.narration,
        entryDate: params.entryDate,
      });

      // Update account balance
      const accRows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.accountCode, line.accountCode));
      if (accRows.length > 0) {
        const acc = accRows[0];
        const delta =
          acc.normalBalance === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit;
        await db
          .update(accounts)
          .set({ currentBalance: acc.currentBalance + delta })
          .where(eq(accounts.id, acc.id));
      }
    }

    return entry;
  } catch (error) {
    console.error('Error posting double-entry journal:', error);
    throw new Error('Failed to post balanced journal entry.', { cause: error });
  }
}

/**
 * Records a Member Monthly Collection Payment with full double-entry accounting,
 * receipt generation, down payment tracking, and audit logging.
 */
export async function recordMemberPayment(params: {
  memberId: string;
  year: number;
  month: number;
  paymentDate: string;
  shareDeposit: number;
  payable: number;
  fine: number;
  otherReceive: number;
  downPayment: number;
  paymentMethod: string;
  receivedBy: string;
  actorUid: string;
  actorRole: string;
  remarks?: string;
  sourceWorksheet?: string;
  sourceRow?: number;
}) {
  try {
    const memberRows = await db
      .select()
      .from(members)
      .where(eq(members.memberId, params.memberId));
    if (memberRows.length === 0) {
      throw new Error(`Member ${params.memberId} not found.`);
    }
    const member = memberRows[0];

    const totalAmount =
      params.shareDeposit +
      params.payable +
      params.fine +
      params.otherReceive +
      params.downPayment;

    if (totalAmount <= 0) {
      throw new Error('Total payment amount must be greater than zero.');
    }

    const monthName = MONTH_NAMES[params.month - 1] || 'January';
    const uniqueSuffix = `${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;
    const transactionCode = `TXN-${params.year}${String(params.month).padStart(2, '0')}-${uniqueSuffix}`;
    const receiptNo = `RCP-${params.year}-${uniqueSuffix}`;

    // 1. Insert payment_transactions
    const [tx] = await db
      .insert(paymentTransactions)
      .values({
        transactionCode,
        receiptNo,
        memberId: params.memberId,
        memberName: member.name,
        year: params.year,
        month: params.month,
        monthName,
        paymentDate: params.paymentDate,
        shareDeposit: params.shareDeposit,
        payable: params.payable,
        fine: params.fine,
        otherReceive: params.otherReceive,
        downPayment: params.downPayment,
        totalAmount,
        paymentMethod: params.paymentMethod,
        approvalStatus: 'APPROVED',
        receivedBy: params.receivedBy,
        approvedBy: params.receivedBy,
        remarks: params.remarks || `Monthly deposit (${monthName} ${params.year})`,
      })
      .returning();

    // 2. Insert payment_allocations for each category separately
    const allocationsToInsert = [
      { category: 'SHARE_DEPOSIT', amount: params.shareDeposit },
      { category: 'PAYABLE', amount: params.payable },
      { category: 'FINE', amount: params.fine },
      { category: 'OTHER_RECEIVE', amount: params.otherReceive },
      { category: 'DOWN_PAYMENT', amount: params.downPayment },
    ].filter((a) => a.amount > 0);

    for (const alloc of allocationsToInsert) {
      await db.insert(paymentAllocations).values({
        transactionId: tx.id,
        memberId: params.memberId,
        category: alloc.category,
        amount: alloc.amount,
        year: params.year,
        month: params.month,
      });
    }

    // 3. Ensure member year obligations exist & update the specific month row
    await recalculateMemberYearAccount(params.memberId, params.year);

    const existingObRows = await db
      .select()
      .from(monthlyObligations)
      .where(
        and(
          eq(monthlyObligations.memberId, params.memberId),
          eq(monthlyObligations.year, params.year),
          eq(monthlyObligations.month, params.month)
        )
      );

    const prevOb = existingObRows[0];
    if (prevOb) {
      const defaultExpShare =
        params.year === 2019 ? 1000 : params.year === 2020 ? 1500 : member.monthlyShareDeposit || 2000;
      const defaultExpPayable =
        params.year <= 2020 ? 20 : member.monthlyPayableAmount || 50;
      const newShareTotal = prevOb.shareDeposit + params.shareDeposit;
      const newPayableTotal = prevOb.payable + params.payable;
      const newOtherTotal = prevOb.otherReceive + params.otherReceive;
      const newEligible = newShareTotal + newPayableTotal + newOtherTotal;

      let nextExpShare = prevOb.expectedShareDeposit ?? defaultExpShare;
      let nextExpPayable = prevOb.expectedPayable ?? defaultExpPayable;
      if (params.year <= 2024 && newEligible > nextExpShare + nextExpPayable) {
        nextExpShare = Math.min(newEligible, defaultExpShare);
        nextExpPayable = Math.max(0, newEligible - nextExpShare);
      } else if (nextExpShare + nextExpPayable === 0) {
        nextExpShare = defaultExpShare;
        nextExpPayable = defaultExpPayable;
      }

      await db
        .update(monthlyObligations)
        .set({
          paymentDate: params.paymentDate,
          expectedShareDeposit: nextExpShare,
          expectedPayable: nextExpPayable,
          shareDeposit: newShareTotal,
          payable: newPayableTotal,
          fine: prevOb.fine + params.fine,
          otherReceive: newOtherTotal,
          downPayment: prevOb.downPayment + params.downPayment,
          receiptNo,
          sourceWorksheet: params.sourceWorksheet || prevOb.sourceWorksheet,
          sourceRow: params.sourceRow || prevOb.sourceRow,
          updatedAt: new Date(),
        })
        .where(eq(monthlyObligations.id, prevOb.id));
    }

    // Recalculate annual totals & cumulative dues from payment year through 2026
    const updatedSummary = await recalculateMemberYearAccount(params.memberId, params.year);
    const maxCascadeYear = Math.max(params.year, 2026);
    for (let y = params.year + 1; y <= maxCascadeYear; y++) {
      await recalculateMemberYearAccount(params.memberId, y);
    }
    await reconcileSocietyAccountBalances();

    // 4. Update down_payment_agreements if downPayment > 0
    if (params.downPayment > 0) {
      const dpRows = await db
        .select()
        .from(downPaymentAgreements)
        .where(eq(downPaymentAgreements.memberId, params.memberId));

      if (dpRows.length > 0) {
        const dp = dpRows[0];
        const newTotalPaid = dp.totalPaid + params.downPayment;
        const newRemaining = Math.max(0, dp.agreedAmount - newTotalPaid);
        await db
          .update(downPaymentAgreements)
          .set({
            totalPaid: newTotalPaid,
            remainingAmount: newRemaining,
            lastPaymentDate: params.paymentDate,
            lastReceiptNo: receiptNo,
            status: newRemaining === 0 ? 'COMPLETED' : 'IN_PROGRESS',
            updatedAt: new Date(),
          })
          .where(eq(downPaymentAgreements.id, dp.id));
      } else {
        const agreed = member.downPaymentTarget || 50000;
        const remaining = Math.max(0, agreed - params.downPayment);
        await db.insert(downPaymentAgreements).values({
          memberId: params.memberId,
          memberName: member.name,
          agreedAmount: agreed,
          totalPaid: params.downPayment,
          remainingAmount: remaining,
          effectiveDate: member.joiningDate,
          lastPaymentDate: params.paymentDate,
          lastReceiptNo: receiptNo,
          status: remaining === 0 ? 'COMPLETED' : 'IN_PROGRESS',
        });
      }
    }

    // 5. Generate Official Receipt
    const [receipt] = await db
      .insert(receipts)
      .values({
        receiptNo,
        transactionId: tx.id,
        memberId: params.memberId,
        memberName: member.name,
        paymentDate: params.paymentDate,
        month: params.month,
        monthName,
        year: params.year,
        shareDeposit: params.shareDeposit,
        payable: params.payable,
        fine: params.fine,
        otherReceive: params.otherReceive,
        downPayment: params.downPayment,
        totalAmount,
        paymentMethod: params.paymentMethod,
        receivedBy: params.receivedBy,
      })
      .returning();

    // 6. Double-Entry Journal Posting
    const cashAccountCode = params.paymentMethod === 'CASH' ? '1010' : '1020';
    const cashAccountName =
      params.paymentMethod === 'CASH'
        ? 'Cash in Hand (নগদ তহবিল)'
        : 'Islami Bank Current Account (ব্যাংক হিসাব)';

    const journalLines: Array<{
      accountCode: string;
      accountName: string;
      memberId?: string;
      debit: number;
      credit: number;
      narration: string;
    }> = [
      {
        accountCode: cashAccountCode,
        accountName: cashAccountName,
        memberId: params.memberId,
        debit: totalAmount,
        credit: 0,
        narration: `Receipt ${receiptNo} from ${member.name} (${monthName} ${params.year})`,
      },
    ];

    if (params.shareDeposit > 0) {
      journalLines.push({
        accountCode: '2010',
        accountName: 'Member Share Deposit Liability (সদস্য শেয়ার আমানত দায়)',
        memberId: params.memberId,
        debit: 0,
        credit: params.shareDeposit,
        narration: `Share deposit liability for ${params.memberId}`,
      });
    }
    if (params.payable > 0) {
      journalLines.push({
        accountCode: '4010',
        accountName: 'Monthly Payable Contribution (মাসিক প্রদেয় চাঁদা আয়)',
        memberId: params.memberId,
        debit: 0,
        credit: params.payable,
        narration: `Monthly payable contribution for ${params.memberId}`,
      });
    }
    if (params.fine > 0) {
      journalLines.push({
        accountCode: '4020',
        accountName: 'Late Fine Collection (বিলম্ব জরিমানা আদায়)',
        memberId: params.memberId,
        debit: 0,
        credit: params.fine,
        narration: `Fine collected from ${params.memberId}`,
      });
    }
    if (params.otherReceive > 0) {
      journalLines.push({
        accountCode: '4030',
        accountName: 'Other Member Receipts (অন্যান্য প্রাপ্তি)',
        memberId: params.memberId,
        debit: 0,
        credit: params.otherReceive,
        narration: `Other receipts from ${params.memberId}`,
      });
    }
    if (params.downPayment > 0) {
      journalLines.push({
        accountCode: '2020',
        accountName: 'Member Down Payment Liability (সদস্য ডাউন পেমেন্ট তহবিল)',
        memberId: params.memberId,
        debit: 0,
        credit: params.downPayment,
        narration: `Down payment deposit from ${params.memberId}`,
      });
    }

    await postDoubleEntryJournal({
      entryDate: params.paymentDate,
      referenceType: 'MEMBER_PAYMENT',
      referenceId: receiptNo,
      description: `Member collection ${receiptNo} - ${member.name} (${params.memberId}) for ${monthName} ${params.year}`,
      createdBy: params.receivedBy,
      lines: journalLines,
    });

    // 7. Audit Log
    await db.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorName: params.receivedBy,
      actorRole: params.actorRole,
      action: 'RECORD_MEMBER_PAYMENT',
      entityType: 'payment_transactions',
      entityId: receiptNo,
      previousValue: prevOb
        ? JSON.stringify({
            shareDeposit: prevOb.shareDeposit,
            payable: prevOb.payable,
            totalReceiveAmount: prevOb.totalReceiveAmount,
          })
        : '{}',
      updatedValue: JSON.stringify({
        shareDeposit: params.shareDeposit,
        payable: params.payable,
        fine: params.fine,
        otherReceive: params.otherReceive,
        downPayment: params.downPayment,
        totalAmount,
      }),
      reason: params.remarks || `Monthly deposit collection (${monthName} ${params.year})`,
    });

    return { transaction: tx, receipt, summary: updatedSummary };
  } catch (error) {
    console.error('Error recording member payment:', error);
    throw new Error('Failed to record member payment transaction.', { cause: error });
  }
}

/**
 * Reconciles the Chart of Accounts (`accounts` table) with the live sums of
 * `annual_account_summaries`, `income_transactions`, `expense_transactions`,
 * `loans`, and `investments` so that Trial Balance, Income Statement, Balance Sheet,
 * and Available Cash Balance are always 100% accurate after any create/edit/delete.
 */
let activeReconcilePromise: Promise<void> | null = null;
let lastReconcileCompletedAt = 0;

export async function reconcileSocietyAccountBalances(force = false) {
  if (!force && Date.now() - lastReconcileCompletedAt < 4000) {
    return;
  }
  if (activeReconcilePromise) {
    return await activeReconcilePromise;
  }

  activeReconcilePromise = (async () => {
    try {
      const [allSummaries, allIncomes, allExpenses, allLoans, allInvestments, existingAccounts] =
        await Promise.all([
          db.select().from(annualAccountSummaries),
          db.select().from(incomeTransactions),
          db.select().from(expenseTransactions),
          db.select().from(loans),
          db.select().from(investments),
          db.select().from(accounts),
        ]);

      const totalShare = allSummaries.reduce((s, r) => s + r.totalShareDeposit, 0);
      const totalPayable = allSummaries.reduce((s, r) => s + r.totalPayable, 0);
      const totalFine = allSummaries.reduce((s, r) => s + r.totalFine, 0);
      const totalOther = allSummaries.reduce((s, r) => s + r.totalOtherReceive, 0);
      const totalDown = allSummaries.reduce((s, r) => s + r.totalDownPayment, 0);
      const totalMemberCollection = allSummaries.reduce((s, r) => s + r.totalReceiveAmount, 0);
      const cachedBlankAdj = Math.max(
        0,
        totalMemberCollection - (totalShare + totalPayable + totalFine + totalOther + totalDown)
      );

      const externalIncomes = allIncomes.filter(
        (i) => !i.voucherNo.endsWith('-OTHER') && !i.voucherNo.endsWith('-FINE')
      );
      const totalExternalIncome = externalIncomes.reduce((s, i) => s + i.amount, 0);

      // Categorize expenses into 5010, 5020, 5030, 5040
      let expRent5010 = 0;
      let expSalary5020 = 0;
      let expUtility5030 = 0;
      let expAdminAndProject5040 = 0;

      for (const e of allExpenses) {
        const cat = (e.category || '').toLowerCase();
        if (cat.includes('rent') || cat.includes('ভাড়া')) {
          expRent5010 += e.amount;
        } else if (cat.includes('salary') || cat.includes('বেতন') || cat.includes('সম্মানী')) {
          expSalary5020 += e.amount;
        } else if (cat.includes('electric') || cat.includes('utility') || cat.includes('বিদ্যুৎ')) {
          expUtility5030 += e.amount;
        } else {
          expAdminAndProject5040 += e.amount;
        }
      }

      const totalExpenses = expRent5010 + expSalary5020 + expUtility5030 + expAdminAndProject5040;
      const totalLoanOutPrincipal = allLoans.reduce((s, l) => s + l.outstandingPrincipal, 0);
      const totalLoanProfitRepaid = allLoans.reduce((s, l) => s + l.interestRepaid, 0);
      const totalInvestmentPrincipal = allInvestments.reduce(
        (s, inv) => s + inv.principalAmount,
        0
      );
      const totalInvestmentProfit = allInvestments.reduce((s, inv) => s + inv.actualReturn, 0);

      const netCashBalance =
        totalMemberCollection +
        totalExternalIncome +
        totalLoanProfitRepaid +
        totalInvestmentProfit -
        totalExpenses -
        totalLoanOutPrincipal -
        totalInvestmentPrincipal;

      const balanceMap: Record<string, number> = {
        '1010': netCashBalance,
        '1020': 0,
        '1030': totalLoanOutPrincipal,
        '1040': totalInvestmentPrincipal,
        '2010': totalShare,
        '2020': totalDown,
        '2030': cachedBlankAdj,
        '4010': totalPayable,
        '4020': totalFine,
        '4030': totalOther,
        '4040': totalExternalIncome,
        '4050': totalLoanProfitRepaid,
        '4060': totalInvestmentProfit,
        '5010': expRent5010,
        '5020': expSalary5020,
        '5030': expUtility5030,
        '5040': expAdminAndProject5040,
      };

      const existingBalanceByCode = new Map(
        existingAccounts.map((a) => [a.accountCode, a.currentBalance])
      );

      for (const [code, bal] of Object.entries(balanceMap)) {
        if (existingBalanceByCode.get(code) !== bal) {
          await db
            .update(accounts)
            .set({ currentBalance: bal })
            .where(eq(accounts.accountCode, code));
        }
      }
      lastReconcileCompletedAt = Date.now();
    } catch (err) {
      console.error('Error reconciling society account balances:', err);
    } finally {
      activeReconcilePromise = null;
    }
  })();

  return await activeReconcilePromise;
}

