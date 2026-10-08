import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function AllCasesLoading() {
  return (
    <div>
      <SkeletonPageHeader withButton={false} />
      <Skeleton className="h-16 rounded-xl mb-6" />
      <div className="rounded-xl border border-border overflow-hidden">
        <SkeletonTable rows={10} cols={8} />
      </div>
    </div>
  );
}
