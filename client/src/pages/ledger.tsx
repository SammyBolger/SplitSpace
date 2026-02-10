import { useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Handshake, Search } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@shared/schema";
import type { Expense, Settlement, LedgerEntry } from "@shared/schema";

export default function LedgerPage() {
  const { currentHousehold, members } = useHousehold();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMember, setFilterMember] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    if (!currentHousehold) {
      setLoading(false);
      return;
    }
    loadLedger();
  }, [currentHousehold, members]);

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.display_name || "Unknown";

  const loadLedger = async () => {
    if (!currentHousehold) return;
    setLoading(true);
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

      const ledger: LedgerEntry[] = [
        ...allExpenses.map((e) => ({
          id: e.id,
          type: "expense" as const,
          date: e.expense_date,
          description: e.description,
          amount: Number(e.amount_total),
          category: e.category,
          payerName: getMemberName(e.payer_member_id),
          created_at: e.created_at,
        })),
        ...allSettlements.map((s) => ({
          id: s.id,
          type: "settlement" as const,
          date: s.date,
          description: s.note || "Settlement",
          amount: Number(s.amount),
          fromName: getMemberName(s.from_member_id),
          toName: getMemberName(s.to_member_id),
          created_at: s.created_at,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEntries(ledger);
    } catch (err) {
      console.error("Ledger load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = entries.filter((entry) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesDesc = entry.description.toLowerCase().includes(q);
      const matchesPayer = entry.payerName?.toLowerCase().includes(q);
      const matchesFrom = entry.fromName?.toLowerCase().includes(q);
      const matchesTo = entry.toName?.toLowerCase().includes(q);
      if (!matchesDesc && !matchesPayer && !matchesFrom && !matchesTo) return false;
    }
    if (filterCategory !== "all" && entry.type === "expense" && entry.category !== filterCategory) return false;
    if (filterMember !== "all") {
      if (entry.type === "expense") {
        const expense = (entries as any[]).find((e) => e.id === entry.id);
        if (entry.payerName !== members.find((m) => m.id === filterMember)?.display_name) return false;
      }
    }
    if (filterDateFrom && entry.date < filterDateFrom) return false;
    if (filterDateTo && entry.date > filterDateTo) return false;
    return true;
  });

  if (!currentHousehold) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted-foreground">Join or create a household first.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-ledger-title">Ledger</h1>
        <p className="text-sm text-muted-foreground">All expenses and settlements</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search transactions..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-ledger"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-36" data-testid="select-filter-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMember} onValueChange={setFilterMember}>
              <SelectTrigger className="w-36" data-testid="select-filter-member">
                <SelectValue placeholder="Member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-36"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="From"
              data-testid="input-filter-date-from"
            />
            <Input
              type="date"
              className="w-36"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="To"
              data-testid="input-filter-date-to"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {entries.length === 0 ? "No transactions yet." : "No matching transactions found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <Card key={entry.id} data-testid={`ledger-entry-${entry.id}`}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  entry.type === "expense" ? "bg-primary/10" : "bg-chart-3/10"
                }`}>
                  {entry.type === "expense" ? (
                    <Receipt className="h-4 w-4 text-primary" />
                  ) : (
                    <Handshake className="h-4 w-4 text-chart-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.type === "expense"
                      ? `Paid by ${entry.payerName}`
                      : `${entry.fromName} paid ${entry.toName}`}
                    {" \u00B7 "}
                    {new Date(entry.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">${entry.amount.toFixed(2)}</p>
                  {entry.category && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5">
                      {entry.category}
                    </Badge>
                  )}
                  {entry.type === "settlement" && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5 bg-chart-3/10 text-chart-3">
                      Settlement
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
