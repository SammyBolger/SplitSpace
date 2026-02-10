import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useHousehold } from "@/lib/household-context";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_CATEGORIES } from "@shared/schema";
import { Loader2, Receipt } from "lucide-react";

export default function AddExpensePage() {
  const { user } = useAuth();
  const { currentHousehold, members, currentMember } = useHousehold();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [payerId, setPayerId] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAllParticipants = () => {
    if (participantIds.length === members.length) {
      setParticipantIds([]);
    } else {
      setParticipantIds(members.map((m) => m.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);

    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Enter a valid amount greater than 0", variant: "destructive" });
      return;
    }
    if (amountNum > 999999) {
      toast({ title: "Amount is too large", variant: "destructive" });
      return;
    }
    if (!payerId) {
      toast({ title: "Select who paid", variant: "destructive" });
      return;
    }
    if (participantIds.length === 0) {
      toast({ title: "Select at least one participant", variant: "destructive" });
      return;
    }

    let splits: { member_id: string; amount_owed: number }[] = [];

    if (splitType === "equal") {
      const perPerson = Math.round((amountNum / participantIds.length) * 100) / 100;
      const remainder = Math.round((amountNum - perPerson * participantIds.length) * 100) / 100;
      splits = participantIds.map((id, idx) => ({
        member_id: id,
        amount_owed: idx === 0 ? perPerson + remainder : perPerson,
      }));
    } else {
      let total = 0;
      for (const id of participantIds) {
        const val = parseFloat(customAmounts[id] || "0");
        if (isNaN(val) || val < 0) {
          toast({ title: `Invalid amount for ${members.find((m) => m.id === id)?.display_name}`, variant: "destructive" });
          return;
        }
        total += val;
        splits.push({ member_id: id, amount_owed: val });
      }
      if (Math.abs(total - amountNum) > 0.01) {
        toast({
          title: "Custom amounts don't add up",
          description: `Total: $${total.toFixed(2)}, Expected: $${amountNum.toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert({
          household_id: currentHousehold!.id,
          description: description.trim(),
          amount_total: amountNum,
          category,
          payer_member_id: payerId,
          expense_date: expenseDate,
        })
        .select()
        .single();

      if (expError) throw expError;

      const splitRows = splits.map((s) => ({
        expense_id: expense.id,
        member_id: s.member_id,
        amount_owed: s.amount_owed,
      }));

      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(splitRows);

      if (splitError) throw splitError;

      toast({ title: "Expense added!" });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Failed to add expense", description: err.message || "Something went wrong", variant: "destructive" });
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

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="text-add-expense-title">Add Expense</CardTitle>
              <CardDescription>Record a shared expense</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Groceries at Trader Joe's"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  data-testid="input-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paid by</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger data-testid="select-payer">
                  <SelectValue placeholder="Who paid?" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id} data-testid={`option-payer-${m.id}`}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Split between</Label>
                <Button type="button" variant="ghost" size="sm" onClick={selectAllParticipants} data-testid="button-select-all">
                  {participantIds.length === members.length ? "Deselect all" : "Select all"}
                </Button>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid={`checkbox-participant-${m.id}`}
                  >
                    <Checkbox
                      checked={participantIds.includes(m.id)}
                      onCheckedChange={() => toggleParticipant(m.id)}
                    />
                    <span className="text-sm">{m.display_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Split type</Label>
              <Select value={splitType} onValueChange={(v) => setSplitType(v as "equal" | "custom")}>
                <SelectTrigger data-testid="select-split-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal split</SelectItem>
                  <SelectItem value="custom">Custom amounts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {splitType === "equal" && participantIds.length > 0 && amount && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  Each person pays:{" "}
                  <span className="font-medium text-foreground">
                    ${(parseFloat(amount || "0") / participantIds.length).toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            {splitType === "custom" && participantIds.length > 0 && (
              <div className="space-y-2">
                {participantIds.map((id) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 min-w-0 truncate">{member?.display_name}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-28"
                        value={customAmounts[id] || ""}
                        onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                        data-testid={`input-custom-amount-${id}`}
                      />
                    </div>
                  );
                })}
                {amount && (
                  <p className="text-xs text-muted-foreground">
                    Remaining: $
                    {(
                      parseFloat(amount || "0") -
                      participantIds.reduce((s, id) => s + parseFloat(customAmounts[id] || "0"), 0)
                    ).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-expense">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Expense
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
