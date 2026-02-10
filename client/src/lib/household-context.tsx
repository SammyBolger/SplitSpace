import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { getSupabase } from "./supabase";
import type { Household, HouseholdMember } from "@shared/schema";

interface HouseholdContextType {
  households: Household[];
  currentHousehold: Household | null;
  members: HouseholdMember[];
  currentMember: HouseholdMember | null;
  setCurrentHouseholdId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentHouseholdId, setCurrentHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setHouseholds([]);
      setMembers([]);
      setCurrentHouseholdId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();

      const { data: memberRows, error: memberErr } = await supabase
        .from("household_members")
        .select("*")
        .eq("user_id", user.id);

      if (memberErr) {
        console.error("Failed to load household_members", memberErr);
      }

      if (!memberRows || memberRows.length === 0) {
        setHouseholds([]);
        setMembers([]);
        setCurrentHouseholdId(null);
        return;
      }

      const householdIds = memberRows.map((m: HouseholdMember) => m.household_id);
      const { data: householdRows, error: hhErr } = await supabase
        .from("households")
        .select("*")
        .in("id", householdIds);

      if (hhErr) {
        console.error("Failed to load households", hhErr);
      }

      const hh = (householdRows || []) as Household[];
      setHouseholds(hh);

      const savedId = localStorage.getItem("splitspace-household");
      const validId = savedId && hh.find((h) => h.id === savedId) ? savedId : hh[0]?.id || null;
      setCurrentHouseholdId(validId);

      if (validId) {
        const { data: allMembers } = await supabase.rpc("get_household_members", {
          p_household_id: validId,
        });
        setMembers((allMembers || []) as HouseholdMember[]);
      }
    } catch (err) {
      console.error("Failed to load households", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user]);

  useEffect(() => {
    if (currentHouseholdId) {
      localStorage.setItem("splitspace-household", currentHouseholdId);
      const supabase = getSupabase();
      supabase.rpc("get_household_members", {
        p_household_id: currentHouseholdId,
      }).then(({ data }) => {
        setMembers((data || []) as HouseholdMember[]);
      });
    }
  }, [currentHouseholdId]);

  const currentHousehold = households.find((h) => h.id === currentHouseholdId) || null;
  const currentMember = members.find((m) => m.user_id === user?.id) || null;

  return (
    <HouseholdContext.Provider
      value={{
        households,
        currentHousehold,
        members,
        currentMember,
        setCurrentHouseholdId,
        loading,
        refresh,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
