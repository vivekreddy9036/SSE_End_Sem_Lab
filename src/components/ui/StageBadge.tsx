import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const stageStyles: Record<string, string> = {
  UI: "bg-stage-ui/12 text-stage-ui border-stage-ui/20",
  PT: "bg-stage-pt/15 text-stage-pt border-stage-pt/25",
  HC: "bg-stage-hc/12 text-stage-hc border-stage-hc/20",
  SC: "bg-stage-sc/12 text-stage-sc border-stage-sc/20",
};

const stageLabels: Record<string, string> = {
  UI: "Under Investigation",
  PT: "Pending Trial",
  HC: "High Court",
  SC: "Supreme Court",
};

interface StageBadgeProps {
  code: string;
  showFullName?: boolean;
}

export default function StageBadge({ code, showFullName = false }: StageBadgeProps) {
  const style = stageStyles[code];
  const label = showFullName ? stageLabels[code] || code : code;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", style)}
    >
      {label}
    </Badge>
  );
}
