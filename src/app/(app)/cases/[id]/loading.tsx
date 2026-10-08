import { SkeletonDetailGrid, SkeletonListCard } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CaseDetailLoading() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="mb-6">
        <SkeletonDetailGrid lines={10} />
      </div>
      <div className="mb-6">
        <SkeletonListCard items={3} />
      </div>
      <SkeletonListCard items={4} />
    </div>
  );
}
