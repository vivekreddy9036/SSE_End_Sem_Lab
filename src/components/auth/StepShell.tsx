import { type LucideIcon } from "lucide-react";

const iconTones: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  navy: "bg-navy/10 text-navy dark:bg-blue-500/15 dark:text-blue-300",
};

interface StepShellProps {
  icon: LucideIcon;
  tone?: keyof typeof iconTones;
  title: string;
  subtitle?: string;
}

export default function StepShell({ icon: Icon, tone = "navy", title, subtitle }: StepShellProps) {
  return (
    <div className="text-center mb-6">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${iconTones[tone]}`}>
        <Icon className="w-7 h-7" strokeWidth={1.75} />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
