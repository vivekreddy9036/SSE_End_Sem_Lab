import { Check } from "lucide-react";

const steps = [
  { num: 1, label: "Passkey" },
  { num: 2, label: "Auth App" },
  { num: 3, label: "Backup" },
] as const;

export default function SetupStepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s.num < currentStep
                  ? "bg-success text-success-foreground"
                  : s.num === currentStep
                  ? "bg-navy text-white dark:bg-blue-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.num < currentStep ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-10 h-0.5 mb-4 mx-1 ${s.num < currentStep ? "bg-success" : "bg-muted"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
