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
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type SubmitEvent } from "react";
import { loginSchema, registerSchema } from "@intouch/shared/auth";

import { BrandLockup, BrandSignature } from "@/components/brand/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { ApiError } from "@/lib/api/client";
import { startGoogleSignIn } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/provider";
import { getSafeReturnPath } from "@/lib/auth/return-path";
import { getFormString } from "@/lib/utils";

type FieldErrors = Partial<
  Record<"displayName" | "username" | "email" | "password", string>
>;

function GoogleMark() {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-white font-mono text-xs font-black text-[#4285f4]">
      G
    </span>
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login, register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerificationRequired, setEmailVerificationRequired] =
    useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isRegister = mode === "register";
  const returnPath = getSafeReturnPath(searchParams.get("next"));
  const successMessage =
    !isRegister && searchParams.get("verified") === "1"
      ? "Email confirmed. You can sign in now."
      : !isRegister && searchParams.get("passwordReset") === "1"
        ? "Password updated. Sign in with your new password."
        : null;

  useEffect(() => {
    if (status === "authenticated") router.replace(returnPath);
  }, [returnPath, router, status]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const input = isRegister
      ? {
          displayName: getFormString(form, "displayName"),
          username: getFormString(form, "username"),
          email: getFormString(form, "email"),
          password: getFormString(form, "password"),
        }
      : {
          email: getFormString(form, "email"),
          password: getFormString(form, "password"),
        };
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse(input);

    setError(null);
    setEmailVerificationRequired(false);
    setFieldErrors({});
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in errors)) {
          errors[field as keyof FieldErrors] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setPending(true);
    try {
      if (isRegister) {
        const result = await register(registerSchema.parse(input));
        sessionStorage.setItem("intouch:verification-email", result.email);
        router.replace("/verify-email");
        return;
      } else {
        await login(loginSchema.parse(input));
      }
      router.replace(returnPath);
    } catch (requestError) {
      if (
        !isRegister &&
        requestError instanceof ApiError &&
        requestError.code === "EMAIL_VERIFICATION_REQUIRED"
      ) {
        sessionStorage.setItem(
          "intouch:verification-email",
          loginSchema.parse(input).email,
        );
        setEmailVerificationRequired(true);
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Authentication could not be completed",
      );
    } finally {
      setPending(false);
    }
  };

  const googleSignIn = () => {
    sessionStorage.setItem("intouch:auth-return-path", returnPath);
    startGoogleSignIn();
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background px-4 py-5 text-foreground sm:px-6 lg:grid lg:h-dvh lg:grid-cols-[1.05fr_0.95fr] lg:gap-5 lg:overflow-hidden lg:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />
      <section className="relative hidden min-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-[2.2rem] border border-border bg-card/60 p-[clamp(1.5rem,4vh,2.5rem)] shadow-2xl backdrop-blur-xl lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <div className="absolute -top-20 -left-24 size-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[-8rem] bottom-[-8rem] size-[28rem] rounded-full border-[5rem] border-primary/10" />
        <Link
          href="/login"
          className="relative w-fit"
          aria-label="InTouch home"
        >
          <BrandSignature preload />
        </Link>

        <div className="relative my-auto w-full py-[clamp(1rem,4vh,4rem)]">
          <BrandLockup
            className="mx-auto mb-[clamp(0.75rem,2vh,1.75rem)] h-[clamp(7rem,18vh,13rem)] w-full max-w-sm"
            preload
          />
          <div className="max-w-xl">
            <div className="mb-[clamp(0.75rem,2vh,1.75rem)] inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3.5" /> Focused collaboration
            </div>
            <h1 className="text-balance text-[clamp(2.4rem,5.4vh,3.75rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
              Clarity for teams that move.
            </h1>
            <p className="mt-[clamp(0.75rem,2vh,1.5rem)] max-w-lg text-[clamp(0.95rem,1.8vh,1.125rem)] leading-[clamp(1.5rem,3vh,2rem)] text-muted-foreground">
              Keep conversations, decisions, and the people behind them in one
              calm workspace.
            </p>
            <div className="mt-[clamp(1rem,3vh,2.5rem)] grid gap-3 sm:grid-cols-3 [@media(max-height:740px)]:hidden">
              {[
                "Private by design",
                "Built for focus",
                "Context stays close",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border bg-background/30 p-[clamp(0.75rem,1.8vh,1rem)] text-sm"
                >
                  <Check className="mb-[clamp(0.5rem,1.5vh,1rem)] size-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="relative font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Secure collaboration workspace
        </p>
      </section>

      <section className="relative flex min-h-[calc(100dvh-2.5rem)] items-start justify-center py-10 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:py-[clamp(1rem,4vh,2.5rem)]">
        <div className="absolute top-0 right-0">
          <ThemeSwitcher />
        </div>
        <div className="my-auto w-full max-w-md">
          <Link
            href="/login"
            className="mb-10 inline-flex lg:hidden"
            aria-label="InTouch home"
          >
            <BrandSignature preload />
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            {isRegister ? "Create your account" : "Welcome back"}
          </p>
          <h2 className="mt-[clamp(0.5rem,1.5vh,0.75rem)] text-[clamp(1.75rem,3.5vh,1.875rem)] leading-tight font-semibold tracking-tight">
            {isRegister
              ? "Start with a calmer workspace."
              : "Pick up where the work is."}
          </h2>
          <p className="mt-[clamp(0.5rem,1.5vh,0.75rem)] text-sm leading-6 text-muted-foreground [@media(max-height:700px)]:hidden">
            {isRegister
              ? "Build your profile now. Your first workspace comes next."
              : "Sign in to return to your organizations and conversations."}
          </p>

          <form
            className="mt-[clamp(1rem,3vh,2rem)] grid gap-[clamp(0.75rem,2vh,1.25rem)]"
            onSubmit={(event) => void submit(event)}
          >
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
                      aria-invalid={Boolean(fieldErrors.displayName)}
                    />
                    {fieldErrors.displayName && (
                      <p className="mt-1 text-xs text-destructive">
                        {fieldErrors.displayName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    placeholder="alexrivera"
                    aria-invalid={Boolean(fieldErrors.username)}
                  />
                  {fieldErrors.username && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.username}
                    </p>
                  )}
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
                  aria-invalid={Boolean(fieldErrors.email)}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isRegister && (
                  <Link
                    href={`/forgot-password?next=${encodeURIComponent(returnPath)}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
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
                  aria-invalid={Boolean(fieldErrors.password)}
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
              {fieldErrors.password && (
                <p className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            {successMessage && (
              <p
                role="status"
                className="rounded-xl border border-status/30 bg-status/10 px-3 py-2 text-sm text-status"
              >
                {successMessage}
              </p>
            )}
            {error && <FormError>{error}</FormError>}
            {emailVerificationRequired && (
              <Link
                href="/verify-email"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Resend your confirmation email
              </Link>
            )}
            <Button
              type="submit"
              size="lg"
              className="h-11 rounded-xl"
              disabled={pending || status === "loading"}
            >
              {pending
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}{" "}
              {!pending && <ArrowRight />}
            </Button>
          </form>

          <div className="my-[clamp(0.75rem,2.5vh,1.5rem)] flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or continue with
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={googleSignIn}
            disabled={pending}
          >
            <GoogleMark /> Google
          </Button>
          <p className="mt-[clamp(1rem,2.5vh,1.75rem)] text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account?" : "New to InTouch?"}{" "}
            <Link
              href={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(returnPath)}`}
              className="font-semibold text-primary hover:underline"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
