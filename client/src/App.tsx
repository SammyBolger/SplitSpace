import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { HouseholdProvider } from "@/lib/household-context";
import { AppHeader } from "@/components/app-header";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import AddExpensePage from "@/pages/add-expense";
import BalancesPage from "@/pages/balances";
import LedgerPage from "@/pages/ledger";
import SettlePage from "@/pages/settle";
import SettingsPage from "@/pages/settings";
import SetupUsernamePage from "@/pages/setup-username";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, skipUsernameCheck }: { component: () => JSX.Element; skipUsernameCheck?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!skipUsernameCheck && !user.user_metadata?.username) {
    return <Redirect to="/setup-username" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
      <Route path="/signup" component={() => <PublicRoute component={SignupPage} />} />
      <Route path="/setup-username" component={() => <ProtectedRoute component={SetupUsernamePage} skipUsernameCheck />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/add-expense" component={() => <ProtectedRoute component={AddExpensePage} />} />
      <Route path="/balances" component={() => <ProtectedRoute component={BalancesPage} />} />
      <Route path="/ledger" component={() => <ProtectedRoute component={LedgerPage} />} />
      <Route path="/settle" component={() => <ProtectedRoute component={SettlePage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <HouseholdProvider>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <Router />
      </div>
    </HouseholdProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
