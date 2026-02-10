import { useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import type { BalanceSummary, DebtSimplification, Expense, Settlement } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function BalancesPage() {
  const { currentHousehold, members, currentMember } = useHousehold();
  const [balances, setBalances] = useState<BalanceSummary[]>([]);
  const [debts, setDebts] = useState<DebtSimplification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentHousehold || members.length === 0) {
      setLoading(false);
      return;
    }
    loadBalances();
  }, [currentHousehold, members]);

  const loadBalances = async () => {
    if (!currentHousehold) return;
    setLoading(true);
    try {
      const supabase = getSupabase();

      const { data: expenseRows } = await supabase
        .from("expenses")
        .select("*")
        .eq("household_id", currentHousehold.id);

      const { data: settlementRows } = await supabase
        .from("settlements")
        .select("*")
        .eq("household_id", currentHousehold.id);

      const allExpenses = (expenseRows || []) as Expense[];
      const allSettlements = (settlementRows || []) as Settlement[];

      const expenseIds = allExpenses.map((e) => e.id);
      let splits: { expense_id: string; member_id: string; amount_owed: number }[] = [];
      if (expenseIds.length > 0) {
        const { data: splitRows } = await supabase
          .from("expense_splits")
          .select("*")
          .in("expense_id", expenseIds);
        splits = splitRows || [];
      }

      const balanceMap: Record<string, number> = {};
      for (const m of members) {
        balanceMap[m.id] = 0;
      }

      for (const e of allExpenses) {
        balanceMap[e.payer_member_id] = (balanceMap[e.payer_member_id] || 0) + Number(e.amount_total);
      }

      for (const s of splits) {
        balanceMap[s.member_id] = (balanceMap[s.member_id] || 0) - Number(s.amount_owed);
      }

      for (const s of allSettlements) {
        balanceMap[s.from_member_id] = (balanceMap[s.from_member_id] || 0) - Number(s.amount);
        balanceMap[s.to_member_id] = (balanceMap[s.to_member_id] || 0) + Number(s.amount);
      }

      const summaries: BalanceSummary[] = members.map((m) => {
        const net = balanceMap[m.id] || 0;
        return {
          memberId: m.id,
          memberName: m.display_name,
          totalPaid: 0,
          totalOwed: 0,
          netBalance: Math.round(net * 100) / 100,
        };
      });

      setBalances(summaries);

      const debtors = summaries.filter((b) => b.netBalance < -0.01).map((b) => ({ ...b }));
      const creditors = summaries.filter((b) => b.netBalance > 0.01).map((b) => ({ ...b }));

      debtors.sort((a, b) => a.netBalance - b.netBalance);
      creditors.sort((a, b) => b.netBalance - a.netBalance);

      const simplifiedDebts: DebtSimplification[] = [];
      let i = 0;
      let j = 0;

      while (i < debtors.length && j < creditors.length) {
        const debtAmt = Math.abs(debtors[i].netBalance);
        const creditAmt = creditors[j].netBalance;
        const transfer = Math.min(debtAmt, creditAmt);

        if (transfer > 0.01) {
          simplifiedDebts.push({
            from: debtors[i].memberId,
            fromName: debtors[i].memberName,
            to: creditors[j].memberId,
            toName: creditors[j].memberName,
            amount: Math.round(transfer * 100) / 100,
          });
        }

        debtors[i].netBalance += transfer;
        creditors[j].netBalance -= transfer;

        if (Math.abs(debtors[i].netBalance) < 0.01) i++;
        if (Math.abs(creditors[j].netBalance) < 0.01) j++;
      }

      setDebts(simplifiedDebts);
    } catch (err) {
      console.error("Balance load error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentHousehold) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted-foreground">Join or create a household first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-balances-title">Balances</h1>
        <p className="text-sm text-muted-foreground">See who owes what in {currentHousehold.name}</p>
      </div>

      {balances.length > 0 && balances.every((b) => Math.abs(b.netBalance) < 0.01) && debts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-chart-3" />
            <h2 className="text-lg font-semibold mb-1" data-testid="text-all-settled">All settled up</h2>
            <p className="text-sm text-muted-foreground">
              No outstanding balances. Add an expense to get started.
            </p>
            <Link href="/add-expense">
              <Button variant="outline" size="sm" className="mt-4" data-testid="button-add-expense-from-balances">Add Expense</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Member Balances</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            {balances.map((b) => (
              <div
                key={b.memberId}
                className="flex items-center justify-between gap-2"
                data-testid={`balance-member-${b.memberId}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {b.netBalance > 0.01 ? (
                    <TrendingUp className="h-4 w-4 text-chart-3 shrink-0" />
                  ) : b.netBalance < -0.01 ? (
                    <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm truncate ${b.memberId === currentMember?.id ? "font-semibold" : ""}`}>
                    {b.memberId === currentMember?.id ? "You" : b.memberName}
                  </span>
                </div>
                <span
                  className={`text-sm font-medium shrink-0 ${
                    b.netBalance > 0.01
                      ? "text-chart-3"
                      : b.netBalance < -0.01
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {b.netBalance > 0.01
                    ? `+$${b.netBalance.toFixed(2)}`
                    : b.netBalance < -0.01
                    ? `-$${Math.abs(b.netBalance).toFixed(2)}`
                    : "Settled"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Suggested Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {debts.length === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-chart-3" />
                <p className="text-sm text-muted-foreground">Everyone is settled up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {debts.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border p-3"
                    data-testid={`debt-suggestion-${idx}`}
                  >
                    <span className="text-sm font-medium truncate">
                      {d.from === currentMember?.id ? "You" : d.fromName}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {d.to === currentMember?.id ? "You" : d.toName}
                    </span>
                    <span className="ml-auto text-sm font-bold text-primary shrink-0">
                      ${d.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                <Link href="/settle">
                  <Button variant="outline" size="sm" className="w-full mt-2" data-testid="button-settle-from-balances">
                    Settle Up
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
