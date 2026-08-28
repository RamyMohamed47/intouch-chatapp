"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "@intouch/shared/auth";

import { BrandLockup, BrandSignature } from "@/components/brand/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import {
  forgotPassword,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "@/lib/auth/client";
import { getFormString } from "@/lib/utils";

const getRequestError = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "The request could not be completed";

function AuthActionShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-8 text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />
      <div className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/15 blur-3xl" />
      <section className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card/80 shadow-2xl backdrop-blur-xl md:grid md:grid-cols-[0.8fr_1.2fr]">
        <div className="hidden border-r border-border bg-background/35 p-8 md:flex md:flex-col">
          <BrandSignature preload />
          <BrandLockup className="my-auto h-56 w-full" preload />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Secure account recovery
          </p>
        </div>
        <div className="p-6 sm:p-10 lg:p-14">
          <Link
            href="/login"
            className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
            {description}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}

function EmailRequestForm({ mode }: { mode: "forgot" | "resend" }) {
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialEmail, setInitialEmail] = useState("");

  useEffect(() => {
    if (mode === "resend") {
      setInitialEmail(
        sessionStorage.getItem("intouch:verification-email") ?? "",
      );
    }
  }, [mode]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const email = getFormString(new FormData(event.currentTarget), "email");
    const schema =
      mode === "forgot" ? forgotPasswordSchema : resendVerificationSchema;
    const parsed = schema.safeParse({ email });
    setError(null);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Enter a valid email address",
      );
      return;
    }

    setPending(true);
    try {
      if (mode === "forgot") await forgotPassword(parsed.data);
      else await resendVerification(parsed.data);
      setAccepted(true);
    } catch (requestError) {
      setError(getRequestError(requestError));
    } finally {
      setPending(false);
    }
  };

  if (accepted) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-status/30 bg-status/10 p-5 text-status"
      >
        <div className="flex items-center gap-3 font-semibold">
          <CheckCircle2 className="size-5" /> Check your inbox
        </div>
        <p className="mt-2 text-sm leading-6">
          If that address is eligible, InTouch has queued an email with the next
          step.
        </p>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={initialEmail}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={initialEmail}
            className="pl-9"
            placeholder="you@company.com"
          />
        </div>
      </div>
      {error && <FormError>{error}</FormError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Requesting..."
          : mode === "forgot"
            ? "Send reset link"
            : "Resend confirmation"}
        {!pending && <ArrowRight />}
      </Button>
    </form>
  );
}

export function ForgotPasswordPage() {
  return (
    <AuthActionShell
      eyebrow="Account recovery"
      title="Reset your password."
      description="Enter your account email. For privacy, the response is the same whether or not the address can receive a reset link."
    >
      <EmailRequestForm mode="forgot" />
    </AuthActionShell>
  );
}

export function VerifyEmailPage() {
  const started = useRef(false);
  const [state, setState] = useState<
    "awaiting" | "checking" | "success" | "error"
  >("awaiting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    if (!token) return;

    window.history.replaceState(null, "", window.location.pathname);
    setState("checking");
    void verifyEmail({ token })
      .then(() => setState("success"))
      .catch((requestError: unknown) => {
        setError(getRequestError(requestError));
        setState("error");
      });
  }, []);

  return (
    <AuthActionShell
      eyebrow="Email confirmation"
      title={state === "success" ? "Email confirmed." : "Confirm your inbox."}
      description="Password accounts must confirm their email before they can enter an InTouch workspace."
    >
      {state === "checking" && (
        <p role="status" className="text-sm text-muted-foreground">
          Validating your confirmation link...
        </p>
      )}
      {state === "success" && (
        <div className="grid gap-5">
          <div
            role="status"
            className="rounded-2xl border border-status/30 bg-status/10 p-5 text-status"
          >
            <div className="flex items-center gap-3 font-semibold">
              <ShieldCheck className="size-5" /> Your account is ready.
            </div>
          </div>
          <Link
            className={buttonVariants({ size: "lg" })}
            href="/login?verified=1"
          >
            Continue to sign in <ArrowRight />
          </Link>
        </div>
      )}
      {state === "error" && (
        <div className="grid gap-5">
          <FormError>
            {error ?? "This confirmation link is invalid or expired."}
          </FormError>
          <EmailRequestForm mode="resend" />
        </div>
      )}
      {state === "awaiting" && (
        <div className="grid gap-6">
          <p className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-sm leading-6 text-muted-foreground">
            We queued a confirmation email. Open its link within 24 hours, or
            request another one below.
          </p>
          <EmailRequestForm mode="resend" />
        </div>
      )}
    </AuthActionShell>
  );
}

export function ResetPasswordPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setToken(params.get("token"));
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || pending) return;
    const form = new FormData(event.currentTarget);
    const password = getFormString(form, "password");
    const confirmation = getFormString(form, "confirmation");
    setError(null);
    if (password !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid password");
      return;
    }

    setPending(true);
    try {
      await resetPassword(parsed.data);
      setToken(null);
      setComplete(true);
    } catch (requestError) {
      setError(getRequestError(requestError));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthActionShell
      eyebrow="Password reset"
      title={complete ? "Password updated." : "Choose a new password."}
      description="Reset links are single-use and expire after 15 minutes. Completing this step also confirms control of your email address."
    >
      {complete ? (
        <div className="grid gap-5">
          <div
            role="status"
            className="rounded-2xl border border-status/30 bg-status/10 p-5 text-status"
          >
            Your existing refresh sessions have been revoked.
          </div>
          <Link
            className={buttonVariants({ size: "lg" })}
            href="/login?passwordReset=1"
          >
            Sign in again <ArrowRight />
          </Link>
        </div>
      ) : token === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your reset link...
        </p>
      ) : token ? (
        <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmation">Confirm password</Label>
            <Input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
            />
          </div>
          {error && <FormError>{error}</FormError>}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Updating..." : "Update password"}
            {!pending && <ArrowRight />}
          </Button>
        </form>
      ) : (
        <div className="grid gap-5">
          <FormError>
            This reset link is missing or has already been cleared from this
            browser.
          </FormError>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/forgot-password"
          >
            Request another link
          </Link>
        </div>
      )}
    </AuthActionShell>
  );
}
