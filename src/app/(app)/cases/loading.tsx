import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CasesLoading() {
  return (
    <div>
      <SkeletonPageHeader />
      <Skeleton className="h-16 rounded-xl mb-6" />
      <div className="rounded-xl border border-border overflow-hidden">
        <SkeletonTable rows={8} cols={7} />
      </div>
    </div>
  );
}
