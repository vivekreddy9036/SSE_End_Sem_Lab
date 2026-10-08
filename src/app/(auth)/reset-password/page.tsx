"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing or invalid reset link.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Reset failed");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-dark to-navy p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col items-center gap-2 mb-4 text-white">
          <ShieldCheck className="w-14 h-14 drop-shadow-lg" strokeWidth={1.75} />
          <span className="text-2xl font-semibold tracking-tight">SentinelIAM</span>
        </div>

        <div className="bg-card text-card-foreground rounded-xl border shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            Set a new password
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">Password updated successfully.</p>
              <Button asChild className="w-full h-11 bg-navy hover:bg-navy-light text-white">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          ) : !token ? (
            <p className="text-sm text-destructive text-center">
              This link is missing its reset token. Please request a new one from the{" "}
              <Link href="/forgot-password" className="underline">forgot password</Link> page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 10 characters"
                  className="h-11 px-4"
                  required
                  minLength={10}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="h-11 px-4"
                  required
                  minLength={10}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium transition-colors"
              >
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
