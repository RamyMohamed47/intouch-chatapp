"use client";

import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleMark() {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-white font-mono text-xs font-black text-[#4285f4]">
      G
    </span>
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";
  const submit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background px-4 py-5 text-foreground sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-5 lg:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />
      <section className="relative hidden min-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-[2.2rem] border border-border bg-card/60 p-10 shadow-2xl backdrop-blur-xl lg:flex lg:flex-col">
        <div className="absolute -top-20 -left-24 size-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[-8rem] bottom-[-8rem] size-[28rem] rounded-full border-[5rem] border-primary/10" />
        <Link href="/login" className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary font-mono text-sm font-black text-primary-foreground">
            IN
          </span>
          <span>
            <span className="block text-sm font-semibold">InTouch</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Work in context
            </span>
          </span>
        </Link>

        <div className="relative my-auto max-w-xl py-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            <Sparkles className="size-3.5" /> Focused collaboration
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.045em] xl:text-6xl">
            Clarity for teams that move.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Keep conversations, decisions, and the people behind them in one
            calm workspace.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              "Private by design",
              "Built for focus",
              "Context stays close",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-border bg-background/30 p-4 text-sm"
              >
                <Check className="mb-4 size-4 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Frontend experience preview
        </p>
      </section>

      <section className="relative flex min-h-[calc(100dvh-2.5rem)] items-center justify-center py-10">
        <div className="absolute top-0 right-0">
          <ThemeSwitcher />
        </div>
        <div className="w-full max-w-md">
          <Link
            href="/login"
            className="mb-10 flex items-center gap-3 lg:hidden"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary font-mono text-xs font-black text-primary-foreground">
              IN
            </span>
            <span className="font-semibold">InTouch</span>
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            {isRegister ? "Create your account" : "Welcome back"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {isRegister
              ? "Start with a calmer workspace."
              : "Pick up where the work is."}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isRegister
              ? "Build your profile now. Your first workspace comes next."
              : "Sign in to return to your organizations and conversations."}
          </p>

          <form className="mt-8 grid gap-5" onSubmit={submit}>
            {isRegister && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <div className="relative">
                    <UserRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="displayName"
                      name="displayName"
                      className="pl-9"
                      placeholder="Alex Rivera"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    placeholder="alexrivera"
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="pl-9"
                  placeholder="you@company.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isRegister && (
                  <span className="text-xs text-muted-foreground">
                    Recovery coming later
                  </span>
                )}
              </div>
              <div className="relative">
                <LockKeyhole className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  className="px-9"
                  placeholder={
                    isRegister ? "At least 8 characters" : "Enter your password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="h-11 rounded-xl">
              {isRegister ? "Create account" : "Sign in"} <ArrowRight />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or continue with
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
          >
            <GoogleMark /> Google
          </Button>
          <p className="mt-7 text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account?" : "New to InTouch?"}{" "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-semibold text-primary hover:underline"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Preview mode - authentication is not connected
          </p>
        </div>
      </section>
    </main>
  );
}
