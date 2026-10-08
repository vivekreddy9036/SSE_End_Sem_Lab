"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    onTurnstileSuccess: (token: string) => void;
    onTurnstileExpired: () => void;
    turnstile?: { reset: (widgetId?: string) => void };
    _turnstileWidgetId?: string;
  }
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    window.onTurnstileExpired = () => setTurnstileToken("");
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA challenge.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim(), turnstileToken);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      window.turnstile?.reset(window._turnstileWidgetId);
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-dark to-navy p-4">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-col items-center gap-2 mb-4 text-white">
            <ShieldCheck className="w-14 h-14 drop-shadow-lg" strokeWidth={1.75} />
            <span className="text-2xl font-semibold tracking-tight">SentinelIAM</span>
          </div>

          <div className="bg-card text-card-foreground rounded-xl border shadow-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
              Create Account
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                {error}
              </div>
            )}

            {success ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Account created. You start with no resource access — use{" "}
                  <strong>My Access Requests</strong> after signing in to request access to a
                  resource.
                </p>
                <Button asChild className="w-full h-11 bg-navy hover:bg-navy-light text-white">
                  <Link href="/login">Go to Sign In</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="h-11 px-4"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@sentineliam.test"
                    className="h-11 px-4"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    className="h-11 px-4"
                    required
                    minLength={10}
                  />
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-2 flex justify-center">
                  <div
                    ref={turnstileRef}
                    className="cf-turnstile"
                    data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    data-callback="onTurnstileSuccess"
                    data-expired-callback="onTurnstileExpired"
                    data-theme="light"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !turnstileToken}
                  className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium transition-colors"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            )}

            {!success && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-navy dark:text-blue-400 font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
