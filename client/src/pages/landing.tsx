import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Users, BarChart3, ArrowRight, Zap, Shield, Smartphone } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Shared Households",
    description: "Create or join a household with roommates using a simple invite code. Track expenses together effortlessly.",
  },
  {
    icon: DollarSign,
    title: "Smart Splitting",
    description: "Split expenses equally or with custom amounts. SplitSpace calculates exactly who owes what.",
  },
  {
    icon: BarChart3,
    title: "Clear Balances",
    description: "See net balances at a glance and settle debts with one tap. No more awkward money conversations.",
  },
];

const highlights = [
  { icon: Zap, label: "Instant sync" },
  { icon: Shield, label: "Secure by default" },
  { icon: Smartphone, label: "Mobile-ready" },
];

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Zap className="h-3 w-3" />
            Expense splitting made simple
          </div>
          <h1
            className="mb-4 text-4xl font-bold tracking-tight md:text-6xl"
            data-testid="text-hero-title"
          >
            Split expenses,{" "}
            <span className="text-primary">not friendships</span>
          </h1>
          <p
            className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl"
            data-testid="text-hero-subtitle"
          >
            SplitSpace makes it easy for roommates to track shared expenses, see
            who owes what, and settle up — all in one clean, modern app.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg" data-testid="button-get-started">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" data-testid="button-login-hero">
                I have an account
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6">
            {highlights.map((h) => (
              <div key={h.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <h.icon className="h-3.5 w-3.5 text-primary" />
                {h.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-2xl font-bold md:text-3xl" data-testid="text-features-heading">
              Everything you need
            </h2>
            <p className="text-muted-foreground">
              From tracking groceries to splitting rent — we&apos;ve got you covered.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature, idx) => (
              <Card key={idx} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold" data-testid={`text-feature-title-${idx}`}>
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t py-12">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-3 text-xl font-bold md:text-2xl">
            Ready to stop the awkward IOU texts?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Sign up free and create your first household in seconds.
          </p>
          <Link href="/signup">
            <Button data-testid="button-cta-bottom">
              Create free account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-5xl px-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <span>SplitSpace &mdash; Built for roommates who like things fair.</span>
          <a
            href="http://www.sammybolger.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover-elevate rounded-md px-2 py-1 transition-colors"
            data-testid="link-creator-website"
          >
            sammybolger.com
          </a>
        </div>
      </footer>
    </div>
  );
}
