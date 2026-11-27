import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Stepper.module.css";

export interface StepItem {
  id: string;
  label: ReactNode;
  summary?: ReactNode;
  disabled?: boolean;
}

export interface StepperProps {
  steps: StepItem[];
  current: string;
  /** Steps before the current one count as done. */
  onSelect: (id: string) => void;
  label?: string;
}

/** The wizard's steps, as a vertical list on wide screens and a row on narrow ones. */
export function Stepper({ steps, current, onSelect, label = "Steps" }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <nav aria-label={label}>
      <ol className={styles.stepper}>
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={step.disabled}
                aria-current={isCurrent ? "step" : undefined}
                className={[styles.step, isCurrent && styles.current, done && styles.done].filter(Boolean).join(" ")}
                onClick={() => onSelect(step.id)}
              >
                <span className={styles.number}>{done ? <Icon name="check" size={13} strokeWidth={3} /> : index + 1}</span>
                <span className={styles.label}>
                  {step.label}
                  {step.summary && <span className={styles.summary}>{step.summary}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
