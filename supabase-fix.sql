-- Fix recursive RLS policy on household_members
-- This creates a security definer function to avoid infinite recursion

-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
DROP POLICY IF EXISTS "Users can view their own households" ON households;
DROP POLICY IF EXISTS "Users can view expenses in their households" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses in their households" ON expenses;
DROP POLICY IF EXISTS "Users can view settlements in their households" ON settlements;
DROP POLICY IF EXISTS "Users can create settlements in their households" ON settlements;
DROP POLICY IF EXISTS "Users can view splits in their households" ON expense_splits;
DROP POLICY IF EXISTS "Users can create splits in their households" ON expense_splits;

-- Step 2: Create a security definer function that bypasses RLS
CREATE OR REPLACE FUNCTION get_my_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$;

-- Step 3: Recreate policies using the function

-- Households: users can only see households they are a member of
CREATE POLICY "Users can view their own households"
  ON households FOR SELECT
  USING (id IN (SELECT get_my_household_ids()));

-- Household members: users can see members of their households
CREATE POLICY "Users can view members of their households"
  ON household_members FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

-- Expenses: users can view/create expenses in their households
CREATE POLICY "Users can view expenses in their households"
  ON expenses FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Users can create expenses in their households"
  ON expenses FOR INSERT
  WITH CHECK (household_id IN (SELECT get_my_household_ids()));

-- Expense splits: users can view/create splits in their households
CREATE POLICY "Users can view splits in their households"
  ON expense_splits FOR SELECT
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE household_id IN (SELECT get_my_household_ids())
    )
  );

CREATE POLICY "Users can create splits in their households"
  ON expense_splits FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT id FROM expenses WHERE household_id IN (SELECT get_my_household_ids())
    )
  );

-- Settlements: users can view/create settlements in their households
CREATE POLICY "Users can view settlements in their households"
  ON settlements FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Users can create settlements in their households"
  ON settlements FOR INSERT
  WITH CHECK (household_id IN (SELECT get_my_household_ids()));
