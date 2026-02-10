import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useHousehold } from "@/lib/household-context";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowUpRight, ArrowDownLeft, TrendingUp, Receipt, Handshake, Loader2, Sparkles, Trash2, Info } from "lucide-react";
import type { Expense, Settlement, HouseholdMember, BalanceSummary } from "@shared/schema";
import { EXPENSE_CATEGORIES } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CHART_COLORS = [
  "hsl(213, 94%, 42%)",
  "hsl(280, 75%, 40%)",
  "hsl(160, 70%, 35%)",
  "hsl(30, 90%, 45%)",
  "hsl(340, 85%, 42%)",
  "hsl(50, 80%, 40%)",
  "hsl(190, 70%, 35%)",
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { households, currentHousehold, members, currentMember, setCurrentHouseholdId, loading, refresh } = useHousehold();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(null);
  const [categoryData, setCategoryData] = useState<{ name: string; amount: number }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [demoHouseholdLoading, setDemoHouseholdLoading] = useState(false);
  const [clearDemoLoading, setClearDemoLoading] = useState(false);

  const generateInviteCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 24; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateDemoHousehold = async () => {
    if (!user) return;
    setDemoHouseholdLoading(true);
    try {
      const supabase = getSupabase();
      const displayName = user.user_metadata?.username || user.email?.split("@")[0] || "Me";

      const { data: household, error: hhError } = await supabase
        .from("households")
        .insert({
          name: "Demo Household",
          invite_code: generateInviteCode(),
          created_by: user.id,
        })
        .select()
        .single();

      if (hhError) throw hhError;

      const { data: member, error: memError } = await supabase
        .from("household_members")
        .insert({
          household_id: household.id,
          user_id: user.id,
          display_name: displayName,
          role: "admin",
        })
        .select()
        .single();

      if (memError) throw memError;

      const today = new Date();
      const demoExpenses = [
        { description: "Weekly Groceries", amount_total: 85.50, category: "Groceries", days_ago: 1 },
        { description: "Electric Bill", amount_total: 120.00, category: "Utilities", days_ago: 3 },
        { description: "Monthly Rent", amount_total: 1500.00, category: "Rent", days_ago: 5 },
        { description: "Pizza Night", amount_total: 42.00, category: "Dining", days_ago: 7 },
        { description: "Netflix Subscription", amount_total: 15.99, category: "Entertainment", days_ago: 10 },
        { description: "Gas for Road Trip", amount_total: 55.00, category: "Gas", days_ago: 12 },
      ];

      for (const exp of demoExpenses) {
        const expenseDate = new Date(today);
        expenseDate.setDate(expenseDate.getDate() - exp.days_ago);

        const { data: expense, error: expError } = await supabase
          .from("expenses")
          .insert({
            household_id: household.id,
            description: exp.description,
            amount_total: exp.amount_total,
            category: exp.category,
            payer_member_id: member.id,
            expense_date: expenseDate.toISOString().split("T")[0],
          })
          .select()
          .single();

        if (expError) throw expError;

        const { error: splitError } = await supabase
          .from("expense_splits")
          .insert({
            expense_id: expense.id,
            member_id: member.id,
            amount_owed: exp.amount_total,
          });

        if (splitError) throw splitError;
      }

      toast({ title: "Demo household created!", description: "Explore the app with sample data." });
      await refresh();
      setCurrentHouseholdId(household.id);
    } catch (err: any) {
      toast({ title: "Failed to create demo household", description: err.message, variant: "destructive" });
    } finally {
      setDemoHouseholdLoading(false);
    }
  };

  const handleClearDemoData = async () => {
    if (!currentHousehold || !user) return;
    setClearDemoLoading(true);
    try {
      const resp = await fetch("/api/leave-household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          household_id: currentHousehold.id,
          user_id: user.id,
          delete_household: true,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.message || "Failed to clear demo data");
      }

      setExpenses([]);
      setSettlements([]);
      setBalanceSummary(null);
      setCategoryData([]);
      setCurrentHouseholdId("");
      toast({ title: "Demo data cleared!" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed to clear demo data", description: err.message, variant: "destructive" });
    } finally {
      setClearDemoLoading(false);
    }
  };

  useEffect(() => {
    if (!currentHousehold || !currentMember) {
      setDataLoading(false);
      return;
    }
    loadDashboardData();
  }, [currentHousehold, currentMember, members]);

  const loadDashboardData = async () => {
    if (!currentHousehold || !currentMember) return;
    setDataLoading(true);
    try {
      const supabase = getSupabase();

      const { data: expenseRows } = await supabase
        .from("expenses")
        .select("*")
        .eq("household_id", currentHousehold.id)
        .order("expense_date", { ascending: false });

      const { data: settlementRows } = await supabase
        .from("settlements")
        .select("*")
        .eq("household_id", currentHousehold.id)
        .order("date", { ascending: false });

      const allExpenses = (expenseRows || []) as Expense[];
      const allSettlements = (settlementRows || []) as Settlement[];
      setExpenses(allExpenses);
      setSettlements(allSettlements);

      const expenseIds = allExpenses.map((e) => e.id);
      let splits: { expense_id: string; member_id: string; amount_owed: number }[] = [];
      if (expenseIds.length > 0) {
        const { data: splitRows } = await supabase
          .from("expense_splits")
          .select("*")
          .in("expense_id", expenseIds);
        splits = splitRows || [];
      }

      const totalPaid = allExpenses
        .filter((e) => e.payer_member_id === currentMember.id)
        .reduce((sum, e) => sum + Number(e.amount_total), 0);

      const totalOwed = splits
        .filter((s) => s.member_id === currentMember.id)
        .reduce((sum, s) => sum + Number(s.amount_owed), 0);

      const settledReceived = allSettlements
        .filter((s) => s.to_member_id === currentMember.id)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      const settledPaid = allSettlements
        .filter((s) => s.from_member_id === currentMember.id)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      const netBalance = totalPaid - totalOwed + settledReceived - settledPaid;

      setBalanceSummary({
        memberId: currentMember.id,
        memberName: currentMember.display_name,
        totalPaid: totalPaid - settledPaid,
        totalOwed: totalOwed - settledReceived,
        netBalance,
      });

      const catMap: Record<string, number> = {};
      for (const e of allExpenses) {
        catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount_total);
      }
      setCategoryData(
        Object.entries(catMap)
          .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
      );
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.display_name || "Unknown";

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (households.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-md bg-primary/10">
          <Plus className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-bold" data-testid="text-no-household">No household yet</h2>
        <p className="mb-6 text-muted-foreground">Create or join a household to start tracking expenses.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/settings">
            <Button data-testid="button-create-household">
              <Plus className="mr-2 h-4 w-4" />
              Create household
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" data-testid="button-join-household">Join with invite code</Button>
          </Link>
        </div>
        <div className="mt-6 border-t pt-6">
          <p className="mb-3 text-sm text-muted-foreground">Or try the app with sample data</p>
          <Button
            variant="outline"
            onClick={handleCreateDemoHousehold}
            disabled={demoHouseholdLoading}
            data-testid="button-create-demo-household"
          >
            {demoHouseholdLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Create Demo Household
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your shared expenses</p>
        </div>
        {households.length > 1 && (
          <Select value={currentHousehold?.id || ""} onValueChange={setCurrentHouseholdId}>
            <SelectTrigger className="w-48" data-testid="select-household">
              <SelectValue placeholder="Select household" />
            </SelectTrigger>
            <SelectContent>
              {households.map((h) => (
                <SelectItem key={h.id} value={h.id} data-testid={`option-household-${h.id}`}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {currentHousehold?.name === "Demo Household" && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                You're viewing demo data. Clear it when you're done exploring.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDemoData}
              disabled={clearDemoLoading}
              data-testid="button-clear-demo-data"
            >
              {clearDemoLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
              Clear Demo Data
            </Button>
          </CardContent>
        </Card>
      )}

      {dataLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">You owe</p>
                    <p className="text-2xl font-bold text-destructive" data-testid="text-you-owe">
                      ${Math.max(0, -(balanceSummary?.netBalance || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10">
                    <ArrowUpRight className="h-4 w-4 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">You're owed</p>
                    <p className="text-2xl font-bold text-chart-3" data-testid="text-youre-owed">
                      ${Math.max(0, balanceSummary?.netBalance || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-chart-3/10">
                    <ArrowDownLeft className="h-4 w-4 text-chart-3" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Net balance</p>
                    <p className={`text-2xl font-bold ${(balanceSummary?.netBalance || 0) >= 0 ? "text-chart-3" : "text-destructive"}`} data-testid="text-net-balance">
                      {(balanceSummary?.netBalance || 0) >= 0 ? "+" : ""}${(balanceSummary?.netBalance || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                <Link href="/ledger">
                  <Button variant="ghost" size="sm" data-testid="button-view-all-activity">View all</Button>
                </Link>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {expenses.length === 0 && settlements.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No activity yet. Add your first expense!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[
                      ...expenses.slice(0, 5).map((e) => ({
                        id: e.id,
                        type: "expense" as const,
                        icon: Receipt,
                        title: e.description,
                        subtitle: `Paid by ${getMemberName(e.payer_member_id)}`,
                        amount: `$${Number(e.amount_total).toFixed(2)}`,
                        date: e.expense_date,
                        category: e.category,
                      })),
                      ...settlements.slice(0, 3).map((s) => ({
                        id: s.id,
                        type: "settlement" as const,
                        icon: Handshake,
                        title: `${getMemberName(s.from_member_id)} paid ${getMemberName(s.to_member_id)}`,
                        subtitle: s.note || "Settlement",
                        amount: `$${Number(s.amount).toFixed(2)}`,
                        date: s.date,
                        category: undefined,
                      })),
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 6)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3"
                          data-testid={`activity-item-${item.id}`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            item.type === "expense" ? "bg-primary/10" : "bg-chart-3/10"
                          }`}>
                            <item.icon className={`h-4 w-4 ${
                              item.type === "expense" ? "text-primary" : "text-chart-3"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{item.amount}</p>
                            {item.category && (
                              <Badge variant="secondary" className="text-[10px] mt-0.5">
                                {item.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {categoryData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No expenses recorded yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                      <XAxis type="number" tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Total"]} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {categoryData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/add-expense">
              <Button data-testid="button-add-expense-cta">
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </Link>
            <Link href="/settle">
              <Button variant="outline" data-testid="button-settle-cta">
                <Handshake className="mr-2 h-4 w-4" />
                Settle Up
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
