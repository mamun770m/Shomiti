import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 0. Users table (Required by Firebase Auth / Cloud SQL linkage)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 1. Roles
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // SUPER_ADMIN, ADMIN, ACCOUNTANT, MEMBER
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Permissions
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  roleName: text('role_name').notNull(),
  resource: text('resource').notNull(),
  canView: boolean('can_view').default(true).notNull(),
  canCreate: boolean('can_create').default(false).notNull(),
  canEdit: boolean('can_edit').default(false).notNull(),
  canApprove: boolean('can_approve').default(false).notNull(),
  canExport: boolean('can_export').default(false).notNull(),
});

// 3. Profiles
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  fullNameBn: text('full_name_bn').default('').notNull(),
  role: text('role').default('SUPER_ADMIN').notNull(), // SUPER_ADMIN | ADMIN | ACCOUNTANT | MEMBER
  memberId: text('member_id').default(''), // Links MEMBER user to their specific member record
  phone: text('phone').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Members
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull().unique(), // e.g., HF-001
  name: text('name').notNull(),
  nameBn: text('name_bn').default('').notNull(),
  fatherName: text('father_name').default('').notNull(),
  motherName: text('mother_name').default('').notNull(),
  mobile: text('mobile').notNull(),
  email: text('email').default('').notNull(),
  address: text('address').default('').notNull(),
  nidNumber: text('nid_number').default('').notNull(),
  bloodGroup: text('blood_group').default('').notNull(),
  occupation: text('occupation').default('').notNull(),
  joiningDate: text('joining_date').notNull(),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, INACTIVE, SUSPENDED
  monthlyShareDeposit: integer('monthly_share_deposit').default(2000).notNull(),
  monthlyPayableAmount: integer('monthly_payable_amount').default(500).notNull(),
  monthlyFinePolicy: integer('monthly_fine_policy').default(100).notNull(),
  otherPaymentSettings: text('other_payment_settings').default('Standard Cooperative Rules').notNull(),
  downPaymentTarget: integer('down_payment_target').default(50000).notNull(),
  advanceCreditBalance: integer('advance_credit_balance').default(0).notNull(),
  photoUrl: text('photo_url').default('').notNull(),
  loginPin: text('login_pin').default('1234').notNull(),
  // Nominee fields
  nomineeName: text('nominee_name').default('').notNull(),
  nomineeRelation: text('nominee_relation').default('').notNull(),
  nomineeMobile: text('nominee_mobile').default('').notNull(),
  nomineeNid: text('nominee_nid').default('').notNull(),
  nomineeSharePercent: integer('nominee_share_percent').default(100).notNull(),
  nomineePhotoUrl: text('nominee_photo_url').default('').notNull(),
  remarks: text('remarks').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Member Accounts (Year-wise headers)
export const memberAccounts = pgTable('member_accounts', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull(),
  year: integer('year').notNull(),
  openingOutstanding: integer('opening_outstanding').default(0).notNull(),
  openingCredit: integer('opening_credit').default(0).notNull(),
  status: text('status').default('OPEN').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Member Payment Policies
export const memberPaymentPolicies = pgTable('member_payment_policies', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull(),
  effectiveYear: integer('effective_year').notNull(),
  effectiveMonth: integer('effective_month').default(1).notNull(),
  expectedShareDeposit: integer('expected_share_deposit').default(2000).notNull(),
  expectedPayable: integer('expected_payable').default(500).notNull(),
  fineRate: integer('fine_rate').default(100).notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Monthly Obligations (Core January–December Member Accounting Grid)
export const monthlyObligations = pgTable('monthly_obligations', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1 to 12
  monthName: text('month_name').notNull(), // January to December
  paymentDate: text('payment_date').default('').notNull(),
  expectedShareDeposit: integer('expected_share_deposit').default(2000).notNull(),
  expectedPayable: integer('expected_payable').default(500).notNull(),
  shareDeposit: integer('share_deposit').default(0).notNull(),
  payable: integer('payable').default(0).notNull(),
  fine: integer('fine').default(0).notNull(),
  otherReceive: integer('other_receive').default(0).notNull(),
  downPayment: integer('down_payment').default(0).notNull(),
  totalReceiveAmount: integer('total_receive_amount').default(0).notNull(),
  monthlyDue: integer('monthly_due').default(0).notNull(),
  advanceCredit: integer('advance_credit').default(0).notNull(),
  cumulativeDue: integer('cumulative_due').default(0).notNull(),
  receiptNo: text('receipt_no').default('').notNull(),
  status: text('status').default('DUE').notNull(), // PAID, PARTIAL, DUE, ADVANCE
  sourceWorksheet: text('source_worksheet').default('').notNull(),
  sourceRow: integer('source_row').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 8. Payment Transactions
export const paymentTransactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  transactionCode: text('transaction_code').notNull().unique(),
  receiptNo: text('receipt_no').notNull().unique(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  monthName: text('month_name').notNull(),
  paymentDate: text('payment_date').notNull(),
  shareDeposit: integer('share_deposit').default(0).notNull(),
  payable: integer('payable').default(0).notNull(),
  fine: integer('fine').default(0).notNull(),
  otherReceive: integer('other_receive').default(0).notNull(),
  downPayment: integer('down_payment').default(0).notNull(),
  totalAmount: integer('total_amount').default(0).notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(),
  approvalStatus: text('approval_status').default('APPROVED').notNull(), // APPROVED, PENDING, REVERSED
  receivedBy: text('received_by').notNull(),
  approvedBy: text('approved_by').default('').notNull(),
  reversalOfId: integer('reversal_of_id').default(0).notNull(),
  remarks: text('remarks').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Payment Allocations
export const paymentAllocations = pgTable('payment_allocations', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').notNull(),
  memberId: text('member_id').notNull(),
  category: text('category').notNull(), // SHARE_DEPOSIT, PAYABLE, FINE, OTHER_RECEIVE, DOWN_PAYMENT
  amount: integer('amount').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Annual Account Summaries (Computed from underlying transactions)
export const annualAccountSummaries = pgTable('annual_account_summaries', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull(),
  year: integer('year').notNull(),
  totalShareDeposit: integer('total_share_deposit').default(0).notNull(),
  totalPayable: integer('total_payable').default(0).notNull(),
  totalFine: integer('total_fine').default(0).notNull(),
  totalOtherReceive: integer('total_other_receive').default(0).notNull(),
  totalDownPayment: integer('total_down_payment').default(0).notNull(),
  totalReceiveAmount: integer('total_receive_amount').default(0).notNull(),
  previousYearOutstanding: integer('previous_year_outstanding').default(0).notNull(),
  currentYearObligation: integer('current_year_obligation').default(0).notNull(),
  totalOutstanding: integer('total_outstanding').default(0).notNull(),
  advanceCredit: integer('advance_credit').default(0).notNull(),
  lastCalculatedAt: timestamp('last_calculated_at').defaultNow(),
});

// 11. Down Payment Agreements
export const downPaymentAgreements = pgTable('down_payment_agreements', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull().unique(),
  memberName: text('member_name').notNull(),
  agreedAmount: integer('agreed_amount').default(50000).notNull(),
  totalPaid: integer('total_paid').default(0).notNull(),
  remainingAmount: integer('remaining_amount').default(50000).notNull(),
  effectiveDate: text('effective_date').notNull(),
  lastPaymentDate: text('last_payment_date').default('').notNull(),
  lastReceiptNo: text('last_receipt_no').default('').notNull(),
  status: text('status').default('IN_PROGRESS').notNull(), // COMPLETED, IN_PROGRESS, PENDING
  remarks: text('remarks').default('').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 12. Loans
export const loans = pgTable('loans', {
  id: serial('id').primaryKey(),
  loanCode: text('loan_code').notNull().unique(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  principalAmount: integer('principal_amount').notNull(),
  interestRate: integer('interest_rate').default(8).notNull(),
  totalInterestAmount: integer('total_interest_amount').notNull(),
  totalPayableAmount: integer('total_payable_amount').notNull(),
  principalRepaid: integer('principal_repaid').default(0).notNull(),
  interestRepaid: integer('interest_repaid').default(0).notNull(),
  outstandingPrincipal: integer('outstanding_principal').notNull(),
  outstandingBalance: integer('outstanding_balance').notNull(),
  applicationDate: text('application_date').notNull(),
  approvalDate: text('approval_date').default('').notNull(),
  disbursementDate: text('disbursement_date').default('').notNull(),
  tenureMonths: integer('tenure_months').default(12).notNull(),
  monthlyInstallment: integer('monthly_installment').notNull(),
  status: text('status').default('ACTIVE').notNull(), // PENDING, APPROVED, ACTIVE, CLOSED, REJECTED
  approvedBy: text('approved_by').default('').notNull(),
  purpose: text('purpose').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 13. Loan Repayments
export const loanRepayments = pgTable('loan_repayments', {
  id: serial('id').primaryKey(),
  loanId: integer('loan_id').notNull(),
  loanCode: text('loan_code').notNull(),
  memberId: text('member_id').notNull(),
  repaymentDate: text('repayment_date').notNull(),
  principalComponent: integer('principal_component').notNull(),
  interestComponent: integer('interest_component').default(0).notNull(),
  fineComponent: integer('fine_component').default(0).notNull(),
  totalPaid: integer('total_paid').notNull(),
  receiptNo: text('receipt_no').notNull(),
  receivedBy: text('received_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 14. Income Transactions
export const incomeTransactions = pgTable('income_transactions', {
  id: serial('id').primaryKey(),
  voucherNo: text('voucher_no').notNull().unique(),
  category: text('category').notNull(), // Membership Fees, Admission Fees, Loan Interest, Investment Profit, Other Income
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  transactionDate: text('transaction_date').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(),
  approvalStatus: text('approval_status').default('APPROVED').notNull(),
  recordedBy: text('recorded_by').notNull(),
  approvedBy: text('approved_by').default('').notNull(),
  remarks: text('remarks').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 15. Expense Transactions
export const expenseTransactions = pgTable('expense_transactions', {
  id: serial('id').primaryKey(),
  voucherNo: text('voucher_no').notNull().unique(),
  category: text('category').notNull(), // Office Rent, Salary, Electricity, Transportation, Maintenance, Administrative Costs, Other Expenses
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  transactionDate: text('transaction_date').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(),
  approvalStatus: text('approval_status').default('APPROVED').notNull(),
  recordedBy: text('recorded_by').notNull(),
  approvedBy: text('approved_by').default('').notNull(),
  remarks: text('remarks').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 16. Investments
export const investments = pgTable('investments', {
  id: serial('id').primaryKey(),
  investmentCode: text('investment_code').notNull().unique(),
  investmentName: text('investment_name').notNull(),
  principalAmount: integer('principal_amount').notNull(),
  investmentDate: text('investment_date').notNull(),
  maturityDate: text('maturity_date').notNull(),
  expectedReturn: integer('expected_return').notNull(),
  actualReturn: integer('actual_return').default(0).notNull(),
  profitLoss: integer('profit_loss').default(0).notNull(),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, MATURED, CLOSED
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 17. Accounts (Double-Entry Chart of Accounts)
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  accountCode: text('account_code').notNull().unique(),
  accountName: text('account_name').notNull(),
  accountNameBn: text('account_name_bn').default('').notNull(),
  accountType: text('account_type').notNull(), // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  normalBalance: text('normal_balance').notNull(), // DEBIT, CREDIT
  currentBalance: integer('current_balance').default(0).notNull(),
  isSystemAccount: boolean('is_system_account').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 18. Journal Entries
export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  entryNumber: text('entry_number').notNull().unique(),
  entryDate: text('entry_date').notNull(),
  referenceType: text('reference_type').notNull(), // MEMBER_PAYMENT, INCOME, EXPENSE, LOAN_DISBURSEMENT, LOAN_REPAYMENT, INVESTMENT, REVERSAL, ADJUSTMENT
  referenceId: text('reference_id').notNull(),
  description: text('description').notNull(),
  totalDebit: integer('total_debit').notNull(),
  totalCredit: integer('total_credit').notNull(),
  status: text('status').default('POSTED').notNull(), // POSTED, REVERSED
  createdBy: text('created_by').notNull(),
  approvedBy: text('approved_by').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 19. Journal Entry Lines
export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').notNull(),
  entryNumber: text('entry_number').notNull(),
  accountCode: text('account_code').notNull(),
  accountName: text('account_name').notNull(),
  memberId: text('member_id').default('').notNull(),
  debit: integer('debit').default(0).notNull(),
  credit: integer('credit').default(0).notNull(),
  narration: text('narration').default('').notNull(),
  entryDate: text('entry_date').notNull(),
});

// 20. Receipts
export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  receiptNo: text('receipt_no').notNull().unique(),
  transactionId: integer('transaction_id').notNull(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  paymentDate: text('payment_date').notNull(),
  month: integer('month').notNull(),
  monthName: text('month_name').notNull(),
  year: integer('year').notNull(),
  shareDeposit: integer('share_deposit').default(0).notNull(),
  payable: integer('payable').default(0).notNull(),
  fine: integer('fine').default(0).notNull(),
  otherReceive: integer('other_receive').default(0).notNull(),
  downPayment: integer('down_payment').default(0).notNull(),
  totalAmount: integer('total_amount').notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(),
  receivedBy: text('received_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 21. Import Batches
export const importBatches = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  batchCode: text('batch_code').notNull().unique(),
  fileName: text('file_name').notNull(),
  totalWorksheets: integer('total_worksheets').default(0).notNull(),
  detectedMembers: integer('detected_members').default(0).notNull(),
  totalMonthlyRecords: integer('total_monthly_records').default(0).notNull(),
  validRecords: integer('valid_records').default(0).notNull(),
  warningRecords: integer('warning_records').default(0).notNull(),
  errorRecords: integer('error_records').default(0).notNull(),
  duplicateRecords: integer('duplicate_records').default(0).notNull(),
  approvedRecords: integer('approved_records').default(0).notNull(),
  importedRecords: integer('imported_records').default(0).notNull(),
  status: text('status').default('STAGED').notNull(), // STAGED, APPROVED, IMPORTED, ROLLED_BACK
  uploadedBy: text('uploaded_by').notNull(),
  approvedBy: text('approved_by').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 22. Import Rows
export const importRows = pgTable('import_rows', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').notNull(),
  worksheetName: text('worksheet_name').notNull(),
  rowNumber: integer('row_number').notNull(),
  year: integer('year').notNull(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  month: integer('month').notNull(),
  monthName: text('month_name').notNull(),
  rawDate: text('raw_date').default('').notNull(),
  parsedDate: text('parsed_date').default('').notNull(),
  shareDeposit: integer('share_deposit').default(0).notNull(),
  payable: integer('payable').default(0).notNull(),
  fine: integer('fine').default(0).notNull(),
  otherReceive: integer('other_receive').default(0).notNull(),
  downPayment: integer('down_payment').default(0).notNull(),
  totalReceiveAmount: integer('total_receive_amount').default(0).notNull(),
  due: integer('due').default(0).notNull(),
  validationStatus: text('validation_status').default('VALID').notNull(), // VALID, WARNING, ERROR, DUPLICATE
  validationMessages: text('validation_messages').default('').notNull(),
  isApproved: boolean('is_approved').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 23. Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  targetRole: text('target_role').default('ALL').notNull(),
  targetMemberId: text('target_member_id').default('').notNull(),
  type: text('type').default('ANNOUNCEMENT').notNull(), // ANNOUNCEMENT, PAYMENT_CONFIRMATION, DUE_REMINDER, APPROVAL_ALERT
  isRead: boolean('is_read').default(false).notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 24. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  previousValue: text('previous_value').default('').notNull(),
  updatedValue: text('updated_value').default('').notNull(),
  reason: text('reason').default('').notNull(),
  ipAddress: text('ip_address').default('127.0.0.1').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 25. Approval Requests
export const approvalRequests = pgTable('approval_requests', {
  id: serial('id').primaryKey(),
  requestCode: text('request_code').notNull().unique(),
  requestType: text('request_type').notNull(), // PAYMENT, INCOME, EXPENSE, LOAN, ADJUSTMENT, REVERSAL, EXCEL_IMPORT
  referenceId: text('reference_id').notNull(),
  summary: text('summary').notNull(),
  amount: integer('amount').default(0).notNull(),
  requestedBy: text('requested_by').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  reviewedBy: text('reviewed_by').default('').notNull(),
  reviewReason: text('review_reason').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 26. System Settings
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: text('setting_value').notNull(),
  description: text('description').default('').notNull(),
  updatedBy: text('updated_by').default('System').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 27. App Users (Username and Password Authentication created & managed by Super Admin)
export const appUsers = pgTable('app_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  fullNameBn: text('full_name_bn').default('').notNull(),
  role: text('role').default('MEMBER').notNull(), // SUPER_ADMIN | ADMIN | MEMBER
  memberId: text('member_id').default('').notNull(), // Linked Member ID (e.g., '02', '09')
  phone: text('phone').default('').notNull(),
  email: text('email').default('').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes').default('').notNull(),
  createdBy: text('created_by').default('Super Admin').notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
