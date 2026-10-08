import { SkeletonPageHeader, SkeletonKpiRow } from "@/components/ui/skeletons";

export default function DashboardLoading() {
  return (
    <div>
      <SkeletonPageHeader buttonWidth="w-36" />
      <SkeletonKpiRow />
    </div>
  );
}
