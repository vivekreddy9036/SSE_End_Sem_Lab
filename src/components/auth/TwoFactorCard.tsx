import { type ReactNode } from "react";

export default function TwoFactorCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-dark to-navy p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex justify-center mb-1">
          <img
            src="/coats_login.png"
            alt="CoATS — Cases of Anti Terrorism Squad"
            className="w-72 object-contain drop-shadow-lg"
          />
        </div>
        <div className="text-center mb-4">
          <p className="text-gray-300 text-sm mt-1">Two-Factor Authentication</p>
        </div>

        <div className="bg-card text-card-foreground rounded-xl border shadow-2xl p-8">
          {children}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Anti Terrorism Squad - Government of Tamil Nadu
        </p>
      </div>
    </div>
  );
}
