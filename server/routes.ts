import type { Express } from "express";
import { createServer, type Server } from "http";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl,
      supabaseAnonKey,
    });
  });

  app.post("/api/leave-household", async (req, res) => {
    try {
      const { household_id, user_id, delete_household } = req.body;

      if (!household_id || !user_id) {
        return res.status(400).json({ message: "household_id and user_id required" });
      }

      const admin = getServiceClient();

      const { data: membership } = await admin
        .from("household_members")
        .select("id")
        .eq("household_id", household_id)
        .eq("user_id", user_id)
        .single();

      if (!membership) {
        return res.status(403).json({ message: "Not a member of this household" });
      }

      if (delete_household) {
        const { data: expRows } = await admin
          .from("expenses")
          .select("id")
          .eq("household_id", household_id);

        if (expRows && expRows.length > 0) {
          const expenseIds = expRows.map((e: any) => e.id);
          await admin.from("expense_splits").delete().in("expense_id", expenseIds);
        }

        await admin.from("expenses").delete().eq("household_id", household_id);
        await admin.from("settlements").delete().eq("household_id", household_id);
        await admin.from("household_members").delete().eq("household_id", household_id);
        await admin.from("households").delete().eq("id", household_id);
      } else {
        await admin
          .from("household_members")
          .delete()
          .eq("id", membership.id);
      }

      res.json({ message: delete_household ? "Household deleted" : "Left household" });
    } catch (err: any) {
      console.error("Leave household error:", err);
      res.status(500).json({ message: "Failed to leave household" });
    }
  });

  app.post("/api/demo-data", async (req, res) => {
    try {
      const { household_id, member_ids } = req.body;

      if (!household_id || !member_ids || !Array.isArray(member_ids) || member_ids.length < 2) {
        return res.status(400).json({ message: "Need household_id and at least 2 member_ids" });
      }

      if (typeof household_id !== "string" || household_id.length > 100) {
        return res.status(400).json({ message: "Invalid household_id" });
      }

      for (const id of member_ids) {
        if (typeof id !== "string" || id.length > 100) {
          return res.status(400).json({ message: "Invalid member_id" });
        }
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const demoExpenses = [
        {
          household_id,
          description: "Weekly groceries at Trader Joe's",
          amount_total: 87.43,
          category: "Groceries",
          payer_member_id: member_ids[0],
          expense_date: new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0],
        },
        {
          household_id,
          description: "Electric bill - January",
          amount_total: 124.50,
          category: "Utilities",
          payer_member_id: member_ids[1],
          expense_date: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
        },
        {
          household_id,
          description: "Pizza night at Joe's",
          amount_total: 45.00,
          category: "Dining",
          payer_member_id: member_ids[0],
          expense_date: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
        },
        {
          household_id,
          description: "Netflix subscription",
          amount_total: 15.99,
          category: "Entertainment",
          payer_member_id: member_ids[1 % member_ids.length],
          expense_date: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
        },
        {
          household_id,
          description: "Gas for road trip",
          amount_total: 52.30,
          category: "Gas",
          payer_member_id: member_ids[0],
          expense_date: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0],
        },
        {
          household_id,
          description: "Cleaning supplies",
          amount_total: 32.15,
          category: "Other",
          payer_member_id: member_ids[1 % member_ids.length],
          expense_date: new Date(Date.now() - 12 * 86400000).toISOString().split("T")[0],
        },
      ];

      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .insert(demoExpenses)
        .select();

      if (expError) throw expError;

      const splits: { expense_id: string; member_id: string; amount_owed: number }[] = [];
      for (const expense of expenses) {
        const perPerson = Math.round((Number(expense.amount_total) / member_ids.length) * 100) / 100;
        const remainder = Math.round((Number(expense.amount_total) - perPerson * member_ids.length) * 100) / 100;
        member_ids.forEach((mid: string, idx: number) => {
          splits.push({
            expense_id: expense.id,
            member_id: mid,
            amount_owed: idx === 0 ? perPerson + remainder : perPerson,
          });
        });
      }

      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(splits);

      if (splitError) throw splitError;

      const { error: settleError } = await supabase
        .from("settlements")
        .insert({
          household_id,
          from_member_id: member_ids[1],
          to_member_id: member_ids[0],
          amount: 25.00,
          date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
          note: "Venmo for groceries",
        });

      if (settleError) throw settleError;

      res.json({ message: "Demo data loaded successfully", count: expenses.length });
    } catch (err: any) {
      console.error("Demo data error:", err);
      res.status(500).json({ message: "Failed to load demo data" });
    }
  });

  return httpServer;
}
