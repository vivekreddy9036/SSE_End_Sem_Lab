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

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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

    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password, turnstileToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      // Reset Turnstile so user can get a fresh token
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
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-4 text-white">
          <ShieldCheck className="w-14 h-14 drop-shadow-lg" strokeWidth={1.75} />
          <span className="text-2xl font-semibold tracking-tight">SentinelIAM</span>
        </div>

        {/* Login Card */}
        <div className="bg-card text-card-foreground rounded-xl border shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            Sign In
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sentineliam.test"
                className="h-11 px-4 focus-visible:border-navy focus-visible:ring-navy/30 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-400/30"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-navy dark:hover:text-blue-400">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-11 px-4 focus-visible:border-navy focus-visible:ring-navy/30 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-400/30"
                required
              />
            </div>

            {/* Cloudflare Turnstile CAPTCHA */}
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
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need an account?{" "}
            <Link href="/register" className="text-navy dark:text-blue-400 font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-6">
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
          <p>Secure Access — Identity &amp; Access Management Platform</p>
        </div>
      </div>
    </div>
    </>
  );
}
