"use client";

import { useAuth } from "@/components/AuthProvider";

export default function PrintLetterhead({ title }: { title: string }) {
  const { user } = useAuth();
  const now = new Date();

  return (
    <div className="mb-6 pb-4 border-b-2 border-navy">
      <div className="flex items-center gap-3">
        <img src="/coats_icon_header.png" alt="CoATS" className="h-10 w-auto object-contain" />
        <div>
          <p className="text-sm font-bold text-navy">Anti Terrorism Squad</p>
          <p className="text-xs text-muted-foreground">Government of Tamil Nadu</p>
        </div>
      </div>
      <h1 className="text-xl font-bold text-foreground mt-4">{title}</h1>
      <p className="text-xs text-muted-foreground mt-1">
        Generated on {now.toLocaleString("en-IN")}
        {user && ` by ${user.fullName} (${user.username})`}
      </p>
    </div>
  );
}
