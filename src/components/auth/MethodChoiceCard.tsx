import { type LucideIcon } from "lucide-react";

const iconTones: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
};

interface MethodChoiceCardProps {
  icon: LucideIcon;
  tone: keyof typeof iconTones;
  title: string;
  description: string;
  recommended?: boolean;
  selected?: boolean;
  onClick: () => void;
}

export default function MethodChoiceCard({
  icon: Icon,
  tone,
  title,
  description,
  recommended,
  selected,
  onClick,
}: MethodChoiceCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-all duration-200 cursor-pointer group hover:shadow-md hover:-translate-y-0.5 ${
        selected
          ? "border-navy bg-navy/5 hover:bg-navy/10 dark:border-blue-400 dark:bg-blue-500/10 dark:hover:bg-blue-500/15"
          : "border-border hover:border-navy hover:bg-navy/5 dark:hover:border-blue-400 dark:hover:bg-blue-500/10"
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconTones[tone]}`}>
        <Icon className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <div className="text-left">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {recommended && (
        <span className="text-xs bg-navy text-white px-2 py-0.5 rounded-full ml-auto">Recommended</span>
      )}
    </button>
  );
}
