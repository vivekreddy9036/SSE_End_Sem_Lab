"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <TriangleAlert className="h-7 w-7 text-destructive" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        SentinelIAM ran into an unexpected error. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 px-4 py-2 bg-navy hover:bg-navy-light text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
