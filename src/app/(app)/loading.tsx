import { SkeletonPageHeader, SkeletonKpiRow } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonKpiRow />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
