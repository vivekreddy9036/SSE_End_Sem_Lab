"use client";

import { AuthProvider } from "@/components/AuthProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
