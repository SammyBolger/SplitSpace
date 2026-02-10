-- SplitSpace Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  invite_code TEXT NOT NULL UNIQUE CHECK (char_length(invite_code) >= 16),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Household members table
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  display_name TEXT NOT NULL CHECK (char_length(display_name) <= 50),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(description) <= 200),
  amount_total NUMERIC(10, 2) NOT NULL CHECK (amount_total > 0 AND amount_total <= 999999),
  category TEXT NOT NULL CHECK (category IN ('Groceries', 'Rent', 'Utilities', 'Dining', 'Gas', 'Entertainment', 'Other')),
  payer_member_id UUID NOT NULL REFERENCES household_members(id),
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expense splits table
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id),
  amount_owed NUMERIC(10, 2) NOT NULL CHECK (amount_owed >= 0),
  UNIQUE(expense_id, member_id)
);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES household_members(id),
  to_member_id UUID NOT NULL REFERENCES household_members(id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0 AND amount <= 999999),
  date DATE NOT NULL,
  note TEXT CHECK (char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (from_member_id != to_member_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_household ON expenses(household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member ON expense_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_household ON settlements(household_id);
CREATE INDEX IF NOT EXISTS idx_households_invite_code ON households(invite_code);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Households: users can only see households they are a member of
CREATE POLICY "Users can view their own households"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create households"
  ON households FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Household members: users can see members of their households
CREATE POLICY "Users can view members of their households"
  ON household_members FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members AS hm WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join households"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own membership"
  ON household_members FOR UPDATE
  USING (user_id = auth.uid());

-- Expenses: users can CRUD expenses in their households
CREATE POLICY "Users can view expenses in their households"
  ON expenses FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create expenses in their households"
  ON expenses FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Expense splits: users can CRUD splits in their households
CREATE POLICY "Users can view splits in their households"
  ON expense_splits FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN household_members hm ON hm.household_id = e.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create splits in their households"
  ON expense_splits FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN household_members hm ON hm.household_id = e.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

-- Settlements: users can CRUD settlements in their households
CREATE POLICY "Users can view settlements in their households"
  ON settlements FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create settlements in their households"
  ON settlements FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );
