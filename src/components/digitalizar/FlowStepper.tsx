import { CheckCircle2 } from "lucide-react";

export type FlowStep = {
  label: string;
  description: string;
  done: boolean;
  active?: boolean;
};

export function FlowStepper({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-5">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={`rounded-lg border p-3 ${step.active ? "border-primary bg-primary/5" : step.done ? "bg-muted/30" : "bg-background"}`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={`flex size-6 items-center justify-center rounded-full text-xs ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step.done ? <CheckCircle2 className="size-3.5" /> : index + 1}
            </span>
            {step.label}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
