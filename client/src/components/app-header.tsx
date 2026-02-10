import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useHousehold } from "@/lib/household-context";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Add Expense", path: "/add-expense" },
  { label: "Balances", path: "/balances" },
  { label: "Ledger", path: "/ledger" },
  { label: "Settle Up", path: "/settle" },
  { label: "Settings", path: "/settings" },
];

export function AppHeader() {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/">
            <span className="text-lg font-bold tracking-tight cursor-pointer shrink-0" data-testid="link-logo">
              Split<span className="text-primary">Space</span>
            </span>
          </Link>
          {user && <HouseholdSwitcher />}
        </div>

        {user ? (
          <>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <span
                    className={`px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
                      location === item.path
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover-elevate"
                    }`}
                    data-testid={`link-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button
                size="icon"
                variant="ghost"
                onClick={signOut}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-login">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" data-testid="link-signup">
                Sign up
              </Button>
            </Link>
          </div>
        )}
      </div>

      {user && mobileMenuOpen && (
        <nav className="md:hidden border-t bg-background px-4 py-2">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <span
                className={`block px-3 py-2 text-sm rounded-md cursor-pointer ${
                  location === item.path
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover-elevate"
                }`}
                onClick={() => setMobileMenuOpen(false)}
                data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function HouseholdSwitcher() {
  const { households, currentHousehold, setCurrentHouseholdId } = useHousehold();

  if (households.length <= 1) return null;

  return (
    <Select value={currentHousehold?.id || ""} onValueChange={setCurrentHouseholdId}>
      <SelectTrigger className="w-36 md:w-44" data-testid="select-household-switcher">
        <SelectValue placeholder="Select household" />
      </SelectTrigger>
      <SelectContent>
        {households.map((h) => (
          <SelectItem key={h.id} value={h.id} data-testid={`option-household-switcher-${h.id}`}>
            {h.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
