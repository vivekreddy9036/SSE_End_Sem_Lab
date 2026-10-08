import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function stagger(i: number, stepMs = 60): CSSProperties {
  return { animationDelay: `${i * stepMs}ms` };
}

export function SkeletonPageHeader({
  withButton = true,
  buttonWidth = "w-32",
}: {
  withButton?: boolean;
  buttonWidth?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <Skeleton className="h-8 w-40" />
      {withButton && <Skeleton className={cn("h-9 rounded-lg", buttonWidth)} />}
    </div>
  );
}

export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="py-4 animate-in fade-in duration-500" style={stagger(i)}>
          <CardContent className="pb-0 space-y-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1 max-w-[110px]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0 animate-in fade-in duration-500"
          style={stagger(i, 50)}
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32 hidden sm:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-28 hidden lg:block ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetailGrid({ lines = 8 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-1.5 animate-in fade-in duration-500" style={stagger(i, 50)}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SkeletonListCard({ title = true, items = 3 }: { title?: boolean; items?: number }) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        {title && <Skeleton className="h-5 w-44" />}
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {Array.from({ length: items }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border border-border animate-in fade-in duration-500"
            style={stagger(i, 60)}
          >
            <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
