import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Shield,
  Rocket,
  Palette,
  Command,
  Sparkles,
  Layers,
  MessageCircle,
} from "lucide-react";
import { COMPANY_NAME, COMPANY_DESCRIPTION } from "@/lib/constants";

const features = [
  {
    title: "Batteries-included",
    description:
      "Auth, billing, theming, and routing wired up with sensible defaults.",
    icon: Rocket,
  },
  {
    title: "Shadcn + Tailwind",
    description:
      "Composable UI primitives that are easy to restyle and extend.",
    icon: Palette,
  },
  {
    title: "Supabase Auth",
    description:
      "Email magic links and OAuth preconfigured for a smooth start.",
    icon: Shield,
  },
  {
    title: "AI-Friendly",
    description:
      "Clear structure and semantic class names so AI can edit safely.",
    icon: Sparkles,
  },
  {
    title: "CLI/API Ready",
    description: "First-class API routes and utilities for rapid iteration.",
    icon: Command,
  },
  {
    title: "Scales with you",
    description: "From idea to production without rewrites or vendor lock-in.",
    icon: Layers,
  },
];

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <header className="container mx-auto max-w-6xl px-4 py-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{COMPANY_NAME}</Badge>
          <span className="text-sm text-muted-foreground">Next.js Starter</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeSwitcher />
          {/* Auth-aware actions */}
          {/* Server component */}
          <AuthButton />
        </div>
      </header>

      <section className="container mx-auto max-w-6xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 w-fit">
          <Badge>New</Badge>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent break-words">
          Lumen NextJS boilerplate
        </h1>
        <p className="mt-4 text-lg md:text-xl text-muted-foreground mx-auto max-w-[70ch] break-words">
          {COMPANY_DESCRIPTION}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="https://getlumen.dev/login" target="_blank">
              Get started
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="w-full sm:w-auto"
          >
            <Link href="https://getlumen.dev/pricing" target="_blank">
              View pricing
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          No credit card required
        </p>
      </section>

      {/* AI Chat Example Card */}
      <section className="container mx-auto max-w-6xl px-4 py-8">
        <Card className="max-w-2xl mx-auto border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="text-center">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">AI Chat Example</CardTitle>
            <CardDescription className="text-base">
              Try out the AI-powered chat feature built with Lumen integration
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/chat">See AI Chat Example</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto max-w-6xl px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <Card key={idx} className="h-full">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base break-words">
                      {f.title}
                    </CardTitle>
                    <CardDescription className="break-words">
                      {f.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {/* Edit this copy to explain your product. Keep it brief. */}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="container mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {COMPANY_NAME}
        </span>
      </footer>
    </main>
  );
}
