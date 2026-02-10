import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useHousehold } from "@/lib/household-context";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Copy, Users, Plus, LogIn, Settings as SettingsIcon, LogOut as LogOutIcon, User } from "lucide-react";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { households, currentHousehold, members, currentMember, setCurrentHouseholdId, refresh } = useHousehold();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState(currentMember?.display_name || "");
  const [username, setUsername] = useState(user?.user_metadata?.username || "");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const generateInviteCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 24; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) {
      toast({ title: "Enter a household name", variant: "destructive" });
      return;
    }
    setCreateLoading(true);
    try {
      const supabase = getSupabase();
      const code = generateInviteCode();

      const { data: household, error: hhError } = await supabase
        .from("households")
        .insert({
          name: newHouseholdName.trim(),
          invite_code: code,
          created_by: user!.id,
        })
        .select()
        .single();

      if (hhError) throw hhError;

      const { error: memError } = await supabase
        .from("household_members")
        .insert({
          household_id: household.id,
          user_id: user!.id,
          display_name: user!.user_metadata?.username || user!.email?.split("@")[0] || "Me",
          role: "admin",
        });

      if (memError) throw memError;

      toast({ title: "Household created!" });
      setNewHouseholdName("");
      await refresh();
      setCurrentHouseholdId(household.id);
    } catch (err: any) {
      toast({ title: "Failed to create household", description: err.message, variant: "destructive" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast({ title: "Enter an invite code", variant: "destructive" });
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase.rpc("join_household_by_invite", {
        p_invite_code: inviteCode.trim(),
      });

      if (error) {
        toast({ title: "Invalid invite code", description: "No household found with that code.", variant: "destructive" });
        return;
      }

      toast({ title: "Joined household!" });
      setInviteCode("");
      await refresh();
      if (data) {
        setCurrentHouseholdId(data);
      }
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Invalid invite code", description: "No household found with that code.", variant: "destructive" });
    } finally {
      setJoinLoading(false);
    }
  };

  useEffect(() => {
    if (currentMember?.display_name && !displayName) {
      setDisplayName(currentMember.display_name);
    }
  }, [currentMember]);

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setNameLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc("set_my_display_name", {
        p_display_name: displayName.trim(),
      });

      if (error) throw error;
      toast({ title: "Display name updated!" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed to update name", description: err.message, variant: "destructive" });
    } finally {
      setNameLoading(false);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) {
      toast({ title: "Username must be at least 2 characters", variant: "destructive" });
      return;
    }
    setUsernameLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({
        data: { username: trimmed },
      });
      if (error) throw error;
      await refreshUser();
      toast({ title: "Username updated!" });
    } catch (err: any) {
      toast({ title: "Failed to update username", description: err.message, variant: "destructive" });
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleCopyInviteCode = () => {
    if (currentHousehold) {
      navigator.clipboard.writeText(currentHousehold.invite_code);
      toast({ title: "Invite code copied!" });
    }
  };

  const handleLeaveHousehold = async () => {
    if (!currentHousehold || !currentMember || !user) return;
    setLeaveLoading(true);
    try {
      const householdId = currentHousehold.id;

      const resp = await fetch("/api/leave-household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          household_id: householdId,
          user_id: user.id,
          delete_household: isOnlyMember,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.message || "Failed to leave household");
      }

      toast({ title: isOnlyMember ? "Household deleted" : "Left household" });
      await refresh();
      const remaining = households.filter((h) => h.id !== householdId);
      if (remaining.length > 0) {
        setCurrentHouseholdId(remaining[0].id);
      }
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Failed to leave household", description: err.message, variant: "destructive" });
    } finally {
      setLeaveLoading(false);
    }
  };

  const isOnlyMember = members.length === 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your households and profile</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Username</CardTitle>
              <CardDescription>Your display name across SplitSpace</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateUsername} className="flex gap-3">
            <Input
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              data-testid="input-username"
            />
            <Button type="submit" disabled={usernameLoading} data-testid="button-update-username">
              {usernameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Create Household</CardTitle>
              <CardDescription>Start a new expense-sharing group</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateHousehold} className="flex gap-3">
            <Input
              placeholder="e.g. Apartment 4B"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              maxLength={100}
              data-testid="input-household-name"
            />
            <Button type="submit" disabled={createLoading} data-testid="button-create-household">
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-chart-3/10">
              <LogIn className="h-4 w-4 text-chart-3" />
            </div>
            <div>
              <CardTitle className="text-base">Join Household</CardTitle>
              <CardDescription>Enter an invite code from your roommate</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoinHousehold} className="flex gap-3">
            <Input
              placeholder="Paste invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              data-testid="input-invite-code"
            />
            <Button type="submit" disabled={joinLoading} data-testid="button-join-household">
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {currentHousehold && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{currentHousehold.name}</CardTitle>
                  <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Invite Code</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all" data-testid="text-invite-code">
                    {currentHousehold.invite_code}
                  </code>
                  <Button size="icon" variant="outline" onClick={handleCopyInviteCode} data-testid="button-copy-invite">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Members</Label>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2" data-testid={`member-${m.id}`}>
                      <span className="text-sm">{m.display_name}</span>
                      <Badge variant="secondary">{m.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive" disabled={leaveLoading} data-testid="button-leave-household">
                      {leaveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOutIcon className="mr-2 h-4 w-4" />}
                      {isOnlyMember ? "Delete Household" : "Leave Household"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle data-testid="text-leave-dialog-title">
                        {isOnlyMember ? "Delete this household?" : "Leave this household?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {isOnlyMember
                          ? "You are the only member. Leaving will permanently delete this household and all its expenses, settlements, and data."
                          : "You'll lose access to expenses and balances for this household. Other members will still have access."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-leave">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleLeaveHousehold}
                        className="bg-destructive text-destructive-foreground"
                        data-testid="button-confirm-leave"
                      >
                        {isOnlyMember ? "Delete Household" : "Leave Household"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {currentMember && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <SettingsIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Your Profile</CardTitle>
                    <CardDescription>Update your display name</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateDisplayName} className="flex gap-3">
                  <Input
                    placeholder="Enter display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    data-testid="input-display-name"
                  />
                  <Button type="submit" disabled={nameLoading} data-testid="button-update-name">
                    {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}
