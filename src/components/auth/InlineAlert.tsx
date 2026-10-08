import { type ReactNode } from "react";

const tones = {
  error: "bg-destructive/10 border-destructive/20 text-destructive",
  success: "bg-success/10 border-success/20 text-success",
  info: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300",
} as const;

export default function InlineAlert({
  tone,
  children,
  className = "",
}: {
  tone: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-3 border rounded-lg text-sm ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}
