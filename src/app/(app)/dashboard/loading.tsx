import { SkeletonPageHeader, SkeletonKpiRow, SkeletonChartCard } from "@/components/ui/skeletons";

export default function DashboardLoading() {
  return (
    <div>
      <SkeletonPageHeader buttonWidth="w-36" />
      <SkeletonKpiRow />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SkeletonChartCard shape="donut" delay={0} />
        <SkeletonChartCard shape="bars" delay={1} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChartCard shape="radar" delay={2} />
        <SkeletonChartCard shape="area" delay={3} />
      </div>
    </div>
  );
}
