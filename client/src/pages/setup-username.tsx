import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User } from "lucide-react";

export default function SetupUsernamePage() {
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  if (user?.user_metadata?.username) {
    return <Redirect to="/dashboard" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      toast({ title: "Please enter a username", variant: "destructive" });
      return;
    }
    if (trimmed.length < 2) {
      toast({ title: "Username must be at least 2 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({
        data: { username: trimmed },
      });
      if (error) throw error;
      await refreshUser();
      toast({ title: "Username set!" });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Failed to set username", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl" data-testid="text-setup-username-title">Choose a username</CardTitle>
          <CardDescription>This is how your roommates will see you</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="e.g. sammy"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                autoFocus
                disabled={loading}
                data-testid="input-setup-username"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-save-username">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
