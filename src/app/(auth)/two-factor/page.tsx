"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint, Smartphone, KeyRound, Lock, Check } from "lucide-react";
import TwoFactorCard from "@/components/auth/TwoFactorCard";
import StepShell from "@/components/auth/StepShell";
import MethodChoiceCard from "@/components/auth/MethodChoiceCard";
import SetupStepIndicator from "@/components/auth/SetupStepIndicator";
import InlineAlert from "@/components/auth/InlineAlert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Step =
  // ── First-time mandatory setup (both required) ──
  | "setup-passkey"     // Step 1: register passkey
  | "setup-totp"        // Step 2: set up authenticator app
  | "recovery-codes"    // Step 3: save recovery codes
  // ── Returning login (choose one) ──
  | "choose-method"     // pick Passkey vs TOTP
  | "verify"            // OTP input
  | "passkey-verify"    // passkey prompt
  | "recovery-input";   // recovery code fallback

export default function TwoFactorPage() {
  const {
    twoFactorPending,
    verify2FA,
    verify2FARecovery,
    complete2FASetup,
    getPasskeyRegistrationOptions,
    completePasskeyRegistration,
    getPasskeyAuthOptions,
    verifyPasskey,
  } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("choose-method");
  const [otpCode, setOtpCode] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup state
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCodesSaved, setRecoveryCodesSaved] = useState(false);

  // Passkey setup state
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyDone, setPasskeyDone] = useState(false);

  useEffect(() => {
    if (!twoFactorPending) {
      router.push("/login");
      return;
    }

    const { totpEnabled, passkeyEnabled } = twoFactorPending;

    if (!totpEnabled && !passkeyEnabled) {
      // Fresh account — start full mandatory setup
      setStep("setup-passkey");
    } else if (totpEnabled && passkeyEnabled) {
      // Both done — choose a method to verify
      setStep("choose-method");
    } else if (passkeyEnabled && !totpEnabled) {
      // Passkey registered but TOTP not completed (e.g. refreshed mid-setup)
      // Force them back to TOTP setup to finish the mandatory wizard.
      setPasskeyDone(true);
      setStep("setup-totp");
      fetchSetup();
    } else if (totpEnabled && !passkeyEnabled) {
      // TOTP done but passkey not registered (e.g. refreshed mid-setup)
      setStep("setup-passkey");
    } else {
      setStep("verify");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSetup() {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error);
      setQrCode(json.data.qrCode);
      setManualSecret(json.data.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 2FA setup");
    }
  }

  // ── Passkey Setup (Step 1 of mandatory setup) ──
  async function handlePasskeySetup() {
    setError("");
    setLoading(true);

    if (!browserSupportsWebAuthn()) {
      setError(
        "Passkey is not supported in this browser. " +
        "WebAuthn requires HTTPS or localhost. " +
        "If you're on a phone, please use HTTPS to access this site."
      );
      setLoading(false);
      return;
    }

    try {
      const options = await getPasskeyRegistrationOptions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credential = await startRegistration({ optionsJSON: options as any });
      // setupOnly=true: registers passkey but keeps 2fa_pending alive for TOTP setup
      await completePasskeyRegistration(credential, passkeyName || undefined, true);
      setPasskeyDone(true);
      // Proceed to TOTP setup
      setStep("setup-totp");
      fetchSetup();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey registration was cancelled. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Passkey setup failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── TOTP Setup Verify (Step 2 of mandatory setup) ──
  async function handleSetupVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await complete2FASetup(otpCode.trim());
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery-codes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  // ── OTP Verification (returning login) ──
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verify2FA(otpCode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  // ── Passkey Verification (returning login) ──
  async function handlePasskeyVerify() {
    setError("");
    setLoading(true);

    if (!browserSupportsWebAuthn()) {
      setError(
        "Passkey is not supported in this browser. " +
        "WebAuthn requires HTTPS or localhost. " +
        "Please use the authenticator app or a recovery code instead."
      );
      setLoading(false);
      return;
    }

    try {
      const options = await getPasskeyAuthOptions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credential = await startAuthentication({ optionsJSON: options as any });
      const result = await verifyPasskey(credential);
      // Passkey verified but TOTP setup was never finished — resume setup wizard
      if (result?.setupRequired) {
        setPasskeyDone(true);
        setStep("setup-totp");
        fetchSetup();
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey verification was cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Passkey verification failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Recovery Code (returning login) ──
  async function handleRecoverySubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verify2FARecovery(recoveryInput.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setLoading(false);
    }
  }

  function handleContinueAfterCodes() {
    router.push("/cases");
  }

  function copyRecoveryCodes() {
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
  }

  // ── Render ──────────────────────────────────────

  return (
    <TwoFactorCard>
      {/* ══════════════════════════════════════════════
           FIRST-TIME SETUP — Step 1: Register Passkey
         ══════════════════════════════════════════════ */}
      {step === "setup-passkey" && (
        <>
          <SetupStepIndicator currentStep={1} />
          <StepShell
            icon={Fingerprint}
            tone="blue"
            title="Step 1: Register a Passkey"
            subtitle="Your device will prompt you to use fingerprint, face, or a security key"
          />

          {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="passkeyName">Name this passkey (optional)</Label>
              <Input
                id="passkeyName"
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder='e.g. "Work Laptop", "iPhone"'
                maxLength={100}
              />
            </div>

            <Button
              onClick={handlePasskeySetup}
              disabled={loading}
              className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Waiting for device...
                </>
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" strokeWidth={1.75} />
                  Register Passkey
                </>
              )}
            </Button>
          </div>

          <InlineAlert tone="info" className="mt-5">
            <strong>Both methods are required.</strong> You&apos;ll set up a passkey first, then an authenticator app.
            This ensures you can always log in, even from a different device.
          </InlineAlert>
        </>
      )}

      {/* ══════════════════════════════════════════════
           FIRST-TIME SETUP — Step 2: TOTP Setup
         ══════════════════════════════════════════════ */}
      {step === "setup-totp" && (
        <>
          <SetupStepIndicator currentStep={2} />
          <StepShell
            icon={Smartphone}
            tone="purple"
            title="Step 2: Set Up Authenticator App"
            subtitle="Scan the QR code with Google Authenticator or any TOTP app"
          />

          {passkeyDone && (
            <InlineAlert tone="success" className="mb-4 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              Passkey registered successfully!
            </InlineAlert>
          )}

          {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}

          {qrCode && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  className="w-48 h-48 border rounded-lg"
                />
              </div>

              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1 text-center">
                  Can&apos;t scan? Enter this code manually:
                </p>
                <p className="text-sm font-mono text-center tracking-wider text-foreground select-all break-all">
                  {manualSecret}
                </p>
              </div>

              <form onSubmit={handleSetupVerify} className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-3 text-center">
                    Enter the 6-digit code from your app
                  </p>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={loading}
                      autoComplete="one-time-code"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium"
                >
                  {loading ? "Verifying..." : "Verify & Enable 2FA"}
                </Button>
              </form>
            </div>
          )}

          {!qrCode && !error && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-navy dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
           FIRST-TIME SETUP — Step 3: Recovery Codes
         ══════════════════════════════════════════════ */}
      {step === "recovery-codes" && (
        <>
          {/* Show step indicator only during first-time setup */}
          {passkeyDone && <SetupStepIndicator currentStep={3} />}

          <StepShell
            icon={KeyRound}
            tone="amber"
            title={passkeyDone ? "Step 3: Save Recovery Codes" : "Save Your Recovery Codes"}
            subtitle="Store these codes in a safe place. Each code can only be used once."
          />

          <div className="bg-muted rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, i) => (
                <div
                  key={i}
                  className="font-mono text-sm text-foreground bg-card rounded px-3 py-2 text-center border"
                >
                  {code}
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={copyRecoveryCodes}
            variant="outline"
            className="w-full h-10 mb-3 font-medium"
          >
            Copy All Codes
          </Button>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="saved"
              checked={recoveryCodesSaved}
              onChange={(e) => setRecoveryCodesSaved(e.target.checked)}
              className="w-4 h-4 accent-navy"
            />
            <label htmlFor="saved" className="text-sm text-muted-foreground">
              I have saved these recovery codes
            </label>
          </div>

          <Button
            onClick={handleContinueAfterCodes}
            disabled={!recoveryCodesSaved}
            className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium"
          >
            Continue to SentinelIAM
          </Button>
        </>
      )}

      {/* ══════════════════════════════════════════════
           RETURNING LOGIN — Choose Method
         ══════════════════════════════════════════════ */}
      {step === "choose-method" && (
        <>
          <StepShell icon={Lock} title="Verify Your Identity" subtitle="Choose how you'd like to verify" />

          <div className="space-y-3">
            <MethodChoiceCard
              icon={Fingerprint}
              tone="blue"
              title="Passkey"
              description="Fingerprint, face, or security key"
              recommended
              selected
              onClick={() => setStep("passkey-verify")}
            />
            <MethodChoiceCard
              icon={Smartphone}
              tone="purple"
              title="Authenticator App"
              description="Enter a 6-digit code"
              onClick={() => setStep("verify")}
            />
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setError(""); setStep("recovery-input"); }}
              className="text-sm text-navy hover:underline dark:text-blue-400 cursor-pointer"
            >
              Use a recovery code instead
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
           RETURNING LOGIN — Passkey Verify
         ══════════════════════════════════════════════ */}
      {step === "passkey-verify" && (
        <>
          <StepShell
            icon={Fingerprint}
            tone="blue"
            title="Verify with Passkey"
            subtitle="Use your fingerprint, face recognition, or security key"
          />

          {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}

          <Button
            onClick={handlePasskeyVerify}
            disabled={loading}
            className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Waiting for passkey...
              </>
            ) : (
              <>
                <Fingerprint className="w-5 h-5" strokeWidth={1.75} />
                Verify with Passkey
              </>
            )}
          </Button>

          <div className="mt-4 space-y-2 text-center">
            {twoFactorPending?.totpEnabled && (
              <button
                onClick={() => { setError(""); setStep("verify"); }}
                className="text-sm text-navy hover:underline dark:text-blue-400 cursor-pointer block mx-auto"
              >
                Use authenticator app instead
              </button>
            )}
            <button
              onClick={() => { setError(""); setStep("recovery-input"); }}
              className="text-sm text-navy hover:underline dark:text-blue-400 cursor-pointer block mx-auto"
            >
              Use a recovery code
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
           RETURNING LOGIN — OTP Verification
         ══════════════════════════════════════════════ */}
      {step === "verify" && (
        <>
          <StepShell
            icon={Lock}
            title="Enter Verification Code"
            subtitle="Open your authenticator app and enter the 6-digit code"
          />

          {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={setOtpCode}
                disabled={loading}
                autoFocus
                autoComplete="one-time-code"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium"
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            {twoFactorPending?.passkeyEnabled && (
              <button
                onClick={() => { setError(""); setStep("passkey-verify"); }}
                className="text-sm text-navy hover:underline dark:text-blue-400 cursor-pointer block mx-auto"
              >
                Use passkey instead
              </button>
            )}
            <button
              onClick={() => { setError(""); setStep("recovery-input"); }}
              className="text-sm text-navy hover:underline dark:text-blue-400 cursor-pointer block mx-auto"
            >
              Use a recovery code instead
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
           RETURNING LOGIN — Recovery Code Input
         ══════════════════════════════════════════════ */}
      {step === "recovery-input" && (
        <>
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Recovery Code</h2>
            <p className="text-muted-foreground text-sm mt-1">Enter one of your recovery codes</p>
          </div>

          {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}

          <form onSubmit={handleRecoverySubmit} className="space-y-5">
            <div>
              <Input
                ref={inputRef}
                type="text"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                className="h-12 text-center text-lg font-mono tracking-widest focus-visible:border-navy focus-visible:ring-navy/30 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-400/30"
                placeholder="XXXX-XXXX"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !recoveryInput.trim()}
              className="w-full h-11 bg-navy hover:bg-navy-light text-white font-medium"
            >
              {loading ? "Verifying..." : "Verify Recovery Code"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setError("");
                setStep("choose-method");
              }}
              className="text-sm text-navy hover:underline dark:text-blue-400 cursor-pointer"
            >
              Back to verification
            </button>
          </div>
        </>
      )}
    </TwoFactorCard>
  );
}
