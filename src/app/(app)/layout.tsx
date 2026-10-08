"use client";

import { useAuth, AuthProvider } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/layout/Header";
import AppSidebar from "@/components/layout/Sidebar";
import Spinner from "@/components/ui/Spinner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="print:hidden contents">
        <AppSidebar />
      </div>
      <SidebarInset className="print:m-0 print:shadow-none">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="p-6 print:p-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
