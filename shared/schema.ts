import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Dining",
  "Gas",
  "Entertainment",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  role: "admin" | "member";
  created_at: string;
}

export interface Expense {
  id: string;
  household_id: string;
  description: string;
  amount_total: number;
  category: ExpenseCategory;
  payer_member_id: string;
  expense_date: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount_owed: number;
}

export interface Settlement {
  id: string;
  household_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

export const joinHouseholdSchema = z.object({
  invite_code: z.string().min(1, "Invite code is required"),
});

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200, "Description too long"),
  amount_total: z.number().positive("Amount must be greater than 0").max(999999, "Amount too large"),
  category: z.enum(EXPENSE_CATEGORIES),
  payer_member_id: z.string().min(1, "Payer is required"),
  expense_date: z.string().min(1, "Date is required"),
  participant_ids: z.array(z.string()).min(1, "Select at least one participant"),
  split_type: z.enum(["equal", "custom"]),
  custom_amounts: z.record(z.string(), z.number()).optional(),
});

export const createSettlementSchema = z.object({
  from_member_id: z.string().min(1, "From member is required"),
  to_member_id: z.string().min(1, "To member is required"),
  amount: z.number().positive("Amount must be greater than 0").max(999999, "Amount too large"),
  date: z.string().min(1, "Date is required"),
  note: z.string().max(200, "Note too long").optional(),
});

export type CreateHousehold = z.infer<typeof createHouseholdSchema>;
export type JoinHousehold = z.infer<typeof joinHouseholdSchema>;
export type CreateExpense = z.infer<typeof createExpenseSchema>;
export type CreateSettlement = z.infer<typeof createSettlementSchema>;

export interface BalanceSummary {
  memberId: string;
  memberName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface DebtSimplification {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface LedgerEntry {
  id: string;
  type: "expense" | "settlement";
  date: string;
  description: string;
  amount: number;
  category?: ExpenseCategory;
  payerName?: string;
  fromName?: string;
  toName?: string;
  created_at: string;
}
