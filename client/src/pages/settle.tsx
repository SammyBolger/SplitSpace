import { useState } from "react";
import { useLocation } from "wouter";
import { useHousehold } from "@/lib/household-context";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Handshake } from "lucide-react";

export default function SettlePage() {
  const { currentHousehold, members } = useHousehold();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);

    if (!fromId) {
      toast({ title: "Select who is paying", variant: "destructive" });
      return;
    }
    if (!toId) {
      toast({ title: "Select who is receiving", variant: "destructive" });
      return;
    }
    if (fromId === toId) {
      toast({ title: "Payer and receiver must be different", variant: "destructive" });
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (amountNum > 999999) {
      toast({ title: "Amount is too large", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("settlements")
        .insert({
          household_id: currentHousehold!.id,
          from_member_id: fromId,
          to_member_id: toId,
          amount: amountNum,
          date,
          note: note.trim() || null,
        });

      if (error) throw error;

      toast({ title: "Settlement recorded!" });
      setLocation("/balances");
    } catch (err: any) {
      toast({ title: "Failed to record settlement", description: err.message || "Something went wrong", variant: "destructive" });
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
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-chart-3/10">
              <Handshake className="h-4 w-4 text-chart-3" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="text-settle-title">Settle Up</CardTitle>
              <CardDescription>Record a payment between members</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Who is paying?</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger data-testid="select-from-member">
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Who is receiving?</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger data-testid="select-to-member">
                  <SelectValue placeholder="Select receiver" />
                </SelectTrigger>
                <SelectContent>
                  {members.filter((m) => m.id !== fromId).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="settle-amount">Amount ($)</Label>
                <Input
                  id="settle-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-settle-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-date">Date</Label>
                <Input
                  id="settle-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="input-settle-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settle-note">Note (optional)</Label>
              <Textarea
                id="settle-note"
                placeholder="e.g. Venmo payment for groceries"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                className="resize-none"
                data-testid="input-settle-note"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-settlement">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Settlement
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
