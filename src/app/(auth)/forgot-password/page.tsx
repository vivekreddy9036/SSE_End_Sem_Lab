"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
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
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), turnstileToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Request failed");
      setSubmitted(true);
      if (json.data?.devToken) {
        setDevLink(`/reset-password?token=${json.data.devToken}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
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
            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
              Reset your password
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Enter your account email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                {error}
              </div>
            )}

            {submitted ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  If an account exists for that email, a reset link has been sent.
                </p>
                {devLink && (
                  <div className="text-left text-xs bg-muted/40 border border-border rounded-lg p-3">
                    <p className="font-medium mb-1">Dev mode — no mail service configured:</p>
                    <Link href={devLink} className="text-navy dark:text-blue-400 underline break-all">
                      {devLink}
                    </Link>
                  </div>
                )}
                <Button asChild className="w-full h-11 bg-navy hover:bg-navy-light text-white">
                  <Link href="/login">Back to Sign In</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
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
                    autoFocus
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
                  {loading ? "Sending..." : "Send reset link"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="text-navy dark:text-blue-400 font-medium hover:underline">
                    Back to Sign In
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
