"use client";

import { Check } from "lucide-react";

type Props = {
  eyebrow: string;
  steps: string[];
  currentStep: number;
  instruction: string;
  onStepChange: (step: number) => void;
};

export function WorkflowEditor({
  eyebrow,
  steps,
  currentStep,
  instruction,
  onStepChange,
}: Props) {
  return (
    <section className="edit-workflow-card">
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>Quy trình xử lý</h2>
        </div>
        <strong>{steps[currentStep]}</strong>
      </header>

      <div className="edit-workflow-steps">
        {steps.map((step, index) => (
          <div
            className={
              index === currentStep
                ? "current"
                : index < currentStep
                  ? "completed"
                  : ""
            }
            key={step}
          >
            <button
              type="button"
              aria-pressed={index === currentStep}
              onClick={() => onStepChange(index)}
            >
              <i>{index < currentStep ? <Check /> : index + 1}</i>
              <span>{step}</span>
            </button>
          </div>
        ))}
      </div>

      <p>{instruction}</p>
    </section>
  );
}
