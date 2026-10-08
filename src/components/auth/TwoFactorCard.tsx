import { type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export default function TwoFactorCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-dark to-navy p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col items-center gap-2 mb-1 text-white">
          <ShieldCheck className="w-14 h-14 drop-shadow-lg" strokeWidth={1.75} />
          <span className="text-2xl font-semibold tracking-tight">SentinelIAM</span>
        </div>
        <div className="text-center mb-4">
          <p className="text-gray-300 text-sm mt-1">Two-Factor Authentication</p>
        </div>

        <div className="bg-card text-card-foreground rounded-xl border shadow-2xl p-8">
          {children}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Identity &amp; Access Management Platform
        </p>
      </div>
    </div>
  );
}
