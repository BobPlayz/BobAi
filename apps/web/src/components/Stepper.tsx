"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import "./Stepper.css";

type StepperProps = {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  renderStepNavigation?: (currentStep: number, goTo: (step: number) => void) => ReactNode;
  backButtonText?: string;
  nextButtonText?: string;
};

export default function Stepper({ children, initialStep = 1, onStepChange, onFinalStepCompleted, renderStepNavigation, backButtonText = "Back", nextButtonText = "Continue" }: StepperProps) {
  const steps = Children.toArray(children);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [height, setHeight] = useState<number>();
  const isComplete = currentStep > steps.length;

  useEffect(() => onStepChange?.(currentStep), [currentStep, onStepChange]);

  function goTo(step: number) {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  }

  function handleNext() {
    if (currentStep === steps.length) {
      setCurrentStep(steps.length + 1);
      onFinalStepCompleted?.();
      return;
    }
    goTo(currentStep + 1);
  }

  return (
    <section className="stepper" aria-label="Onboarding progress">
      {renderStepNavigation ? renderStepNavigation(currentStep, goTo) : <div className="stepper-progress">
        {steps.map((_, index) => {
          const step = index + 1;
          const status = currentStep > step ? "complete" : currentStep === step ? "active" : "upcoming";
          return <div className="stepper-progress-item" key={step}>
            <button type="button" className={`stepper-indicator ${status}`} onClick={() => currentStep <= step && goTo(step)} aria-label={`Go to step ${step}`} aria-current={status === "active" ? "step" : undefined}>
              {status === "complete" ? "✓" : `0${step}`}
            </button>
            {index < steps.length - 1 && <span className={`stepper-connector ${currentStep > step ? "complete" : ""}`} />}
          </div>;
        })}
      </div>}
      <div className="stepper-viewport" style={{ height }}>
        {!isComplete && <div className="stepper-slide" key={currentStep} data-direction={direction} ref={(element) => { if (element) setHeight(element.offsetHeight); }}>{steps[currentStep - 1]}</div>}
      </div>
      {!isComplete && <footer className="stepper-footer">
        {currentStep > 1 && <button type="button" className="stepper-back" onClick={() => goTo(currentStep - 1)}>{backButtonText}</button>}
        <button type="button" className="stepper-next" onClick={handleNext}>{currentStep === steps.length ? "Complete setup" : nextButtonText}<span aria-hidden="true">→</span></button>
      </footer>}
    </section>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}